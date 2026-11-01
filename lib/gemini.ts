import { PRESETS, weekdayName } from './date';
import type { Account, Category } from './types';
import { HttpError } from './errors';

export type Call = { name: string; args: any };
const S = (description?: string, e?: readonly string[]) => ({ type: 'STRING', ...(description ? { description } : {}), ...(e ? { enum: [...e] } : {}) });
const N = (description?: string) => ({ type: 'NUMBER', ...(description ? { description } : {}) });
const TYPES = ['expense', 'income', 'transfer'];
const RANGE = { type: 'OBJECT', properties: { preset: S('relative period', PRESETS), from: S('YYYY-MM-DD'), to: S('YYYY-MM-DD') } };
const FILTER = {
  type: 'OBJECT', description: 'Selects existing transactions',
  properties: { last: { type: 'BOOLEAN', description: 'the most recently added entry' }, text: S('note keyword'), category: S(), account: S(), type: S('', TYPES), amount: N('exact amount'), min_amount: N(), max_amount: N(), range: RANGE },
};
const DECLS = [
  { name: 'say', description: 'Reply with text only: ask ONE short clarifying question when required info (e.g. amount) is missing, or answer non-finance chat. Never include financial figures.', parameters: { type: 'OBJECT', properties: { text: S() }, required: ['text'] } },
  { name: 'add_transactions', description: 'Record new expense/income/transfer entries.', parameters: { type: 'OBJECT', properties: { items: { type: 'ARRAY', items: { type: 'OBJECT', properties: { type: S('', TYPES), amount: N('BDT, plain number'), account: S('source account; omit if not said'), to_account: S('transfer destination'), category: S(), note: S('short, in the user language'), date: S('YYYY-MM-DD; omit for today') }, required: ['type', 'amount'] } } }, required: ['items'] } },
  { name: 'update_transaction', description: 'Edit existing transaction(s).', parameters: { type: 'OBJECT', properties: { target: FILTER, changes: { type: 'OBJECT', properties: { amount: N(), account: S(), category: S(), note: S(), date: S('YYYY-MM-DD'), type: S('', ['expense', 'income']) } } }, required: ['target', 'changes'] } },
  { name: 'delete_transactions', description: 'Delete transaction(s). The server asks the user to confirm.', parameters: { type: 'OBJECT', properties: { target: FILTER }, required: ['target'] } },
  { name: 'query', description: 'Look up data. list=transactions, summary=income/expense totals for a period (optionally filtered by category/account), balance=account balances, budget=budget status.', parameters: { type: 'OBJECT', properties: { kind: S('', ['list', 'summary', 'balance', 'budget']), range: RANGE, filter: FILTER }, required: ['kind'] } },
  { name: 'set_budget', description: 'Set a monthly budget. Omit category for the overall budget.', parameters: { type: 'OBJECT', properties: { category: S(), amount: N() }, required: ['amount'] } },
  { name: 'create_account', description: 'Create a custom account/wallet.', parameters: { type: 'OBJECT', properties: { name: S(), opening_balance: N() }, required: ['name'] } },
];

const SYSTEM = `You turn Bangla, English and Banglish messages for a BDT personal finance tracker into function calls. Rules:
- Always call a function. Never compute totals/balances and never state numbers yourself; the server does that.
- Use account and category names EXACTLY from the lists below. nagad/nogod/নগদ=Nagad, bikash/বিকাশ=bKash, ক্যাশ/hate=Cash.
- Convert Bangla digits. "k"/হাজার=1000, lakh/লাখ=100000. Amounts are BDT.
- salary/received/পেলাম=income; paid/spent/খরচ/কিনলাম=expense; moving money between own accounts=transfer.
- Omit account if the user did not say. Dates as YYYY-MM-DD, omit for today; relative periods use range.preset.
- "last entry/ta/টা" -> target.last=true. If amount is missing for a new entry, use say to ask.`;

export async function callGemini(p: { text: string; hist: { role: string; content: string }[]; accounts: Account[]; categories: Category[]; today: string }): Promise<Call[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new HttpError(503, 'AI is not configured. Check GEMINI_API_KEY.');

  const names = (t: string) => [...new Set(p.categories.filter((c) => c.type === t).map((c) => c.name))].join(', ');
  const sys = `${SYSTEM}\nToday: ${p.today} (${weekdayName(p.today)}), Asia/Dhaka.\nAccounts: ${p.accounts.filter((a) => !a.archived).map((a) => a.name).join(', ')}\nExpense categories: ${names('expense')}\nIncome categories: ${names('income')}`;
  const hist = p.hist.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content.slice(0, 200) }] }));
  while (hist.length && hist[0].role !== 'user') hist.shift();

  const body = {
    systemInstruction: { parts: [{ text: sys }] },
    contents: [...hist, { role: 'user', parts: [{ text: p.text }] }],
    tools: [{ functionDeclarations: DECLS }],
    toolConfig: { functionCallingConfig: { mode: 'ANY' } },
    generationConfig: {
      maxOutputTokens: 2048,
      thinkingConfig: { thinkingLevel: 'low' },
    },
  };

  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const started = Date.now();

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(22000),
    });
  } catch (error) {
    const elapsed = Date.now() - started;
    console.error('[Gemini] request failed', { model, elapsedMs: elapsed, error: error instanceof Error ? error.message : String(error) });
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new HttpError(504, 'The AI took too long to respond. Please try again.');
    }
    throw new HttpError(503, 'Could not reach the AI service. Please try again.');
  }

  const elapsedMs = Date.now() - started;
  if (!response.ok) {
    const details = await response.text();
    console.error('[Gemini] API error', { model, status: response.status, elapsedMs, details: details.slice(0, 1200) });
    if (response.status === 429) throw new HttpError(503, 'The AI service is busy. Please try again shortly.');
    if (response.status >= 500) throw new HttpError(503, 'The AI service is temporarily unavailable. Please try again.');
    throw new HttpError(502, 'The AI request was rejected. Check the Gemini model and API configuration.');
  }

  const result = await response.json();
  const candidate = result.candidates?.[0];
  const parts: any[] = candidate?.content?.parts ?? [];
  const calls = parts
    .filter((part) => part.functionCall)
    .map((part) => ({ name: part.functionCall.name as string, args: part.functionCall.args ?? {} }));

  console.info('[Gemini] request completed', {
    model,
    elapsedMs,
    finishReason: candidate?.finishReason ?? 'UNKNOWN',
    promptTokens: result.usageMetadata?.promptTokenCount,
    outputTokens: result.usageMetadata?.candidatesTokenCount,
    thoughtsTokens: result.usageMetadata?.thoughtsTokenCount,
  });

  if (calls.length) return calls;
  const txt = parts.map((part) => part.text).filter(Boolean).join(' ');
  if (txt) return [{ name: 'say', args: { text: txt } }];

  console.error('[Gemini] empty response', { model, finishReason: candidate?.finishReason, blockReason: result.promptFeedback?.blockReason });
  throw new HttpError(502, 'The AI returned an empty response. Please try again.');
}
