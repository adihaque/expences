import { ZodError } from 'zod';
import { callGemini, type Call } from './gemini';
import { HttpError, UserError } from './errors';
import { detectLang, T } from './i18n';
import { monthEnd, monthStart, resolveRange, todayDhaka } from './date';
import { createCategory, findTx, loadContext, must, TX_SELECT, type Ctx } from './ops';
import { defaultAccount, findAccount, findCategory } from './resolve';
import { AccountArgs, AddArgs, BudgetArgs, DeleteArgs, QueryArgs, stripNulls, UpdateArgs } from './schemas';
import type { Account, AssistantMsg, Card, Category, Lang, Tx } from './types';

const save = (db: any, role: 'user' | 'assistant', content: string, payload?: unknown) =>
  db.from('chat_messages').insert({ role, content, payload: payload ?? null });

async function addPending(db: any, payload: any): Promise<string> {
  return must(await db.from('pending_actions').insert({ payload }).select('id').single()).id;
}

export async function runChat(db: any, text: string): Promise<AssistantMsg> {
  const lang = detectLang(text), L = T(lang), today = todayDhaka();
  const done = async (m: Omit<AssistantMsg, 'lang'>) => {
    const msg = { ...m, lang } as AssistantMsg;
    await save(db, 'assistant', msg.content, { cards: msg.cards, pending: msg.pending, lang });
    return msg;
  };
  const requestStarted = Date.now();
  const rateLimitStarted = Date.now();
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await db.from('chat_messages').select('id', { count: 'exact', head: true }).eq('role', 'user').gte('created_at', since);
  console.info('[Chat] rate limit checked', { elapsedMs: Date.now() - rateLimitStarted });
  if ((count ?? 0) >= 10) return { content: L.rate, lang };

  const contextStarted = Date.now();
  const [ctx, h] = await Promise.all([
    loadContext(db, false),
    db.from('chat_messages').select('role,content').order('created_at', { ascending: false }).limit(4),
  ]);
  const hist = (h.data ?? []).reverse();
  console.info('[Chat] context ready', { elapsedMs: Date.now() - contextStarted });

  let calls: Call[];
  try {
    const [savedUser, geminiResult] = await Promise.allSettled([
      save(db, 'user', text),
      callGemini({ text, hist, accounts: ctx.accounts, categories: ctx.categories, today }),
    ]);
    if (savedUser.status === 'rejected' || savedUser.value.error) {
      throw new HttpError(500, 'Could not save your message. Please try again.');
    }
    if (geminiResult.status === 'rejected') throw geminiResult.reason;
    calls = geminiResult.value;
    console.info('[Chat] model and user message ready', { elapsedMs: Date.now() - requestStarted });
  } catch (e) {
    console.error('[Chat] Gemini stage failed', { elapsedMs: Date.now() - requestStarted, error: e });
    if (e instanceof HttpError) throw e;
    throw new HttpError(503, L.aiDown);
  }

  const opsStarted = Date.now();
  const lines: string[] = [], cards: Card[] = [];
  let pending: AssistantMsg['pending'] = null;
  for (const c of calls.slice(0, 5)) {
    try { pending = (await exec(db, ctx, c, lang, today, lines, cards)) ?? pending; }
    catch (e) {
      if (e instanceof UserError) lines.push('⚠️ ' + L.err(e.code, e.arg));
      else if (e instanceof ZodError) lines.push('⚠️ ' + L.invalid);
      else { console.error('exec', c.name, e); lines.push('⚠️ ' + L.fail); }
    }
  }
  const result = await done({ content: lines.join('\n') || L.invalid, cards: cards.length ? cards : undefined, pending });
  console.info('[Chat] request completed', { operationsAndSaveMs: Date.now() - opsStarted, totalMs: Date.now() - requestStarted });
  return result;
}

async function exec(db: any, ctx: Ctx, call: Call, lang: Lang, today: string, lines: string[], cards: Card[]): Promise<{ id: string; summary: string } | undefined> {
  const L = T(lang), args = stripNulls(call.args ?? {});
  switch (call.name) {
    case 'say': { if (typeof args.text === 'string') lines.push(args.text.slice(0, 400)); return; }

    case 'add_transactions': {
      const { items } = AddArgs.parse(args);
      const rows: any[] = [], extra: string[] = [];
      for (const it of items) {
        const acc = it.account ? findAccount(ctx.accounts, it.account) : defaultAccount(ctx.accounts);
        if (!acc) throw new UserError('noAccount', it.account ?? '');
        let to: Account | null = null;
        if (it.type === 'transfer') {
          if (!it.to_account) throw new UserError('needTo');
          to = findAccount(ctx.accounts, it.to_account);
          if (!to || to.id === acc.id) throw new UserError('badTo');
        }
        let cat: Category | null = null;
        if (it.type !== 'transfer' && it.category) {
          cat = findCategory(ctx.categories, it.category, it.type);
          if (!cat) { cat = await createCategory(db, it.category, it.type); ctx.categories.push(cat); extra.push(L.newCat(cat.name)); }
        }
        rows.push({ type: it.type, amount: it.amount, account_id: acc.id, to_account_id: to?.id ?? null, category_id: cat?.id ?? null, note: it.note ?? null, occurred_on: it.date ?? today, source: 'ai' });
      }
      const saved: Tx[] = must(await db.from('transactions').insert(rows).select(TX_SELECT));
      lines.push(...saved.map(L.saved), ...extra);
      return;
    }

    case 'update_transaction': {
      const { target, changes } = UpdateArgs.parse(args);
      if (!Object.keys(target).length) throw new UserError('needTarget');
      const { rows } = await findTx(db, ctx, target, today, 26);
      if (!rows.length) throw new UserError('none');
      if (rows.length > 25) throw new UserError('tooMany');
      const patch: any = {}; const desc: string[] = [];
      if (changes.amount) { patch.amount = changes.amount; desc.push(L.money(changes.amount)); }
      if (changes.note) { patch.note = changes.note; desc.push(changes.note); }
      if (changes.date) { patch.occurred_on = changes.date; desc.push(changes.date); }
      if (changes.account) { const a = findAccount(ctx.accounts, changes.account); if (!a) throw new UserError('noAccount', changes.account); patch.account_id = a.id; desc.push(a.name); }
      if (changes.type) { patch.type = changes.type; desc.push(L.type[changes.type]); }
      if (changes.category) {
        if (rows.some((r) => r.type === 'transfer')) throw new UserError('noTransferEdit');
        const t = (changes.type ?? rows[0].type) as 'expense' | 'income';
        let cat = findCategory(ctx.categories, changes.category, t);
        if (!cat) { cat = await createCategory(db, changes.category, t); ctx.categories.push(cat); }
        patch.category_id = cat.id; desc.push(cat.name);
      }
      if (changes.type && rows.some((r) => r.type === 'transfer')) throw new UserError('noTransferEdit');
      if (!Object.keys(patch).length) throw new UserError('nothing');
      const ids = rows.map((r) => r.id);
      if (rows.length === 1) {
        const up: Tx[] = must(await db.from('transactions').update(patch).in('id', ids).select(TX_SELECT));
        lines.push(L.updated(up[0]));
        return;
      }
      const id = await addPending(db, { kind: 'update', ids, patch, lang });
      const summary = L.confirmUpdate(rows, desc.join(', '));
      lines.push(summary);
      return { id, summary };
    }

    case 'delete_transactions': {
      const { target } = DeleteArgs.parse(args);
      if (!Object.keys(target).length) throw new UserError('needTarget');
      const { rows } = await findTx(db, ctx, target, today, 51);
      if (!rows.length) throw new UserError('none');
      if (rows.length > 50) throw new UserError('tooMany');
      const id = await addPending(db, { kind: 'delete', ids: rows.map((r) => r.id), lang });
      const summary = L.confirmDelete(rows);
      lines.push(summary);
      return { id, summary };
    }

    case 'query': {
      const q = QueryArgs.parse(args);
      const f = { ...(q.filter ?? {}), range: q.filter?.range ?? q.range };
      if (q.kind === 'list') {
        const { rows, count } = await findTx(db, ctx, f, today, 10, true);
        if (!rows.length) throw new UserError('none');
        cards.push({ kind: 'transactions', rows, total: count });
        lines.push(L.listHead(rows.length, count));
      } else if (q.kind === 'summary') {
        const r = resolveRange(f.range ?? { preset: 'this_month' }, today);
        const cat = f.category ? findCategory(ctx.categories, f.category) : null;
        if (f.category && !cat) throw new UserError('catNotFound', f.category);
        const acc = f.account ? findAccount(ctx.accounts, f.account) : null;
        if (f.account && !acc) throw new UserError('noAccount', f.account);
        const s = must(await db.rpc('summary', { p_from: r.from, p_to: r.to, p_category: cat?.id ?? null, p_account: acc?.id ?? null }));
        cards.push({ kind: 'summary', from: r.from, to: r.to, ...s, by_category: s.by_category.slice(0, 6) });
        lines.push(L.summary(r.from, r.to, s));
      } else if (q.kind === 'balance') {
        const acc = f.account ? findAccount(ctx.accounts, f.account) : null;
        if (f.account && !acc) throw new UserError('noAccount', f.account);
        const balances = must(await db.from('account_balances').select('id,name,balance,archived').order('name')) ?? [];
        const rows = balances.filter((a: any) => !a.archived && (!acc || a.id === acc.id)).map((a: any) => ({ id: a.id, name: a.name, balance: Number(a.balance ?? 0) }));
        cards.push({ kind: 'balances', rows });
        lines.push(L.balances);
      } else {
        const rows = must(await db.rpc('budget_status', { p_from: monthStart(today), p_to: monthEnd(today) }));
        if (!rows.length) { lines.push(L.noBudgets); return; }
        cards.push({ kind: 'budgets', rows });
        lines.push(L.budgets);
      }
      return;
    }

    case 'set_budget': {
      const b = BudgetArgs.parse(args);
      let catId: string | null = null, label = lang === 'bn' ? 'সামগ্রিক' : 'Overall';
      if (b.category) { const c = findCategory(ctx.categories, b.category, 'expense'); if (!c) throw new UserError('catNotFound', b.category); catId = c.id; label = c.name; }
      await upsertBudget(db, catId, b.amount);
      lines.push(L.budgetSet(label, b.amount));
      return;
    }

    case 'create_account': {
      const a = AccountArgs.parse(args);
      const r = await db.from('accounts').insert({ name: a.name, kind: 'custom', opening_balance: a.opening_balance ?? 0 });
      if (r.error?.code === '23505') throw new UserError('dup');
      must(r);
      lines.push(L.accountCreated(a.name));
      return;
    }
    default: throw new ZodError([]);
  }
}

export async function upsertBudget(db: any, categoryId: string | null, amount: number) {
  const q = db.from('budgets').select('id');
  const { data } = await (categoryId ? q.eq('category_id', categoryId) : q.is('category_id', null)).maybeSingle();
  if (data) must(await db.from('budgets').update({ amount }).eq('id', data.id));
  else must(await db.from('budgets').insert({ category_id: categoryId, amount }));
}

/** Executes or cancels a stored destructive action. */
export async function confirmPending(db: any, id: string, approve: boolean): Promise<AssistantMsg> {
  const p = must(await db.from('pending_actions').select('*').eq('id', id).maybeSingle());
  if (!p) return { content: T('en').expired, lang: 'en' };
  await db.from('pending_actions').delete().eq('id', id);
  const { kind, ids, patch, lang } = p.payload as { kind: string; ids: string[]; patch?: any; lang: Lang };
  const L = T(lang ?? 'en');
  let content: string;
  if (Date.now() - new Date(p.created_at).getTime() > 10 * 60_000) content = L.expired;
  else if (!approve) content = L.cancelled;
  else if (kind === 'delete') content = L.deleted(must(await db.from('transactions').delete().in('id', ids).select('id')).length);
  else content = L.updatedN(must(await db.from('transactions').update(patch).in('id', ids).select('id')).length);
  const msg: AssistantMsg = { content, lang: lang ?? 'en' };
  await save(db, 'assistant', content, { lang: msg.lang });
  return msg;
}
