import { HttpError, UserError } from './errors';
import { resolveRange } from './date';
import { findAccount, findCategory } from './resolve';
import type { Filter } from './schemas';
import type { Account, Category, Tx } from './types';

export type Ctx = { accounts: Account[]; categories: Category[] };
export const TX_SELECT = '*, account:accounts!account_id(id,name), to_account:accounts!to_account_id(id,name), category:categories!category_id(id,name,name_bn)';

export function must(r: { data: any; error: any }): any {
  if (r.error) {
    const c = r.error.code;
    if (c === '23505') throw new HttpError(409, 'Already exists');
    if (c === '23503') throw new HttpError(409, 'In use by other records');
    throw new HttpError(400, r.error.message);
  }
  return r.data;
}

export async function loadContext(db: any, includeBalances = true): Promise<Ctx> {
  const accountQuery = includeBalances
    ? db.from('account_balances').select('id,name,kind,opening_balance,archived,balance').order('name')
    : db.from('accounts').select('id,name,kind,opening_balance,archived').order('name');
  const [a, c] = await Promise.all([
    accountQuery,
    db.from('categories').select('id,name,name_bn,type').order('name'),
  ]);
  return { accounts: must(a) ?? [], categories: must(c) ?? [] };
}

export async function createCategory(db: any, name: string, type: 'expense' | 'income'): Promise<Category> {
  return must(await db.from('categories').insert({ name: name.trim().slice(0, 60), type }).select('id,name,name_bn,type').single());
}

/** Find transactions by a (validated) filter. Names are resolved to ids server-side. */
export async function findTx(db: any, ctx: Ctx, f: Filter, today: string, limit = 25, withCount = false): Promise<{ rows: Tx[]; count: number }> {
  let q = db.from('transactions').select(TX_SELECT, withCount ? { count: 'exact' } : undefined);
  if (f.range) { const r = resolveRange(f.range, today); q = q.gte('occurred_on', r.from).lte('occurred_on', r.to); }
  if (f.type) q = q.eq('type', f.type);
  if (f.account) { const a = findAccount(ctx.accounts, f.account); if (!a) throw new UserError('noAccount', f.account); q = q.or(`account_id.eq.${a.id},to_account_id.eq.${a.id}`); }
  if (f.category) { const c = findCategory(ctx.categories, f.category, f.type === 'income' || f.type === 'expense' ? f.type : undefined); if (!c) throw new UserError('catNotFound', f.category); q = q.eq('category_id', c.id); }
  if (f.amount) q = q.eq('amount', f.amount);
  if (f.min_amount) q = q.gte('amount', f.min_amount);
  if (f.max_amount) q = q.lte('amount', f.max_amount);
  if (f.text) q = q.ilike('note', `%${f.text.replace(/[%_,()\\]/g, ' ')}%`);
  q = q.order(f.last ? 'created_at' : 'occurred_on', { ascending: false }).order('created_at', { ascending: false }).limit(f.last ? 1 : limit);
  const r = await q;
  const rows = must(r) ?? [];
  return { rows, count: r.count ?? rows.length };
}
