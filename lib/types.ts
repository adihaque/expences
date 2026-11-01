export type Lang = 'en' | 'bn';
export type TxType = 'expense' | 'income' | 'transfer';
export type Account = { id: string; name: string; kind: string; opening_balance: number; balance?: number; archived: boolean };
export type Category = { id: string; name: string; name_bn: string | null; type: 'expense' | 'income' };
export type Tx = {
  id: string; type: TxType; amount: number; account_id: string; to_account_id: string | null; category_id: string | null;
  note: string | null; occurred_on: string; created_at: string; source?: string;
  account?: { id: string; name: string } | null; to_account?: { id: string; name: string } | null;
  category?: { id: string; name: string; name_bn: string | null } | null;
};
export type CatTotal = { name: string; name_bn: string | null; type: string; total: number; count: number };
export type Summary = { income: number; expense: number; net: number; count: number; by_category: CatTotal[]; daily: { date: string; income: number; expense: number }[] };
export type BudgetRow = { id: string; category_id: string | null; name: string; name_bn: string | null; amount: number; spent: number; remaining: number; pct: number | null };
export type Card =
  | { kind: 'transactions'; rows: Tx[]; total: number }
  | ({ kind: 'summary'; from: string; to: string } & Summary)
  | { kind: 'balances'; rows: { id: string; name: string; balance: number }[] }
  | { kind: 'budgets'; rows: BudgetRow[] };
export type AssistantMsg = { content: string; lang: Lang; cards?: Card[]; pending?: { id: string; summary: string } | null };
