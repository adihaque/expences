import { z } from 'zod';
import { route } from '@/lib/server';
import { must } from '@/lib/ops';
import { amt, isoDate, TxType } from '@/lib/schemas';
export const maxDuration = 60;

const nm = z.string().trim().min(1).max(60);
const Backup = z.object({
  accounts: z.array(z.object({ name: nm, kind: z.enum(['cash', 'bkash', 'nagad', 'bank', 'custom']).default('custom'), opening_balance: z.coerce.number().default(0), archived: z.boolean().default(false) })).max(200),
  categories: z.array(z.object({ name: nm, name_bn: z.string().max(60).nullish(), type: z.enum(['expense', 'income']) })).max(500),
  transactions: z.array(z.object({ type: TxType, amount: amt, account: nm, to_account: nm.nullish(), category: nm.nullish(), note: z.string().max(200).nullish(), occurred_on: isoDate })).max(20000),
});
/** Restores a JSON backup by ADDING its data (existing accounts/categories are matched by name). */
export const POST = (req: Request) => route(async ({ db }) => {
  const b = Backup.parse(await req.json());
  const accs = new Map<string, string>(must(await db.from('accounts').select('id,name')).map((a: any) => [a.name, a.id]));
  for (const a of b.accounts) if (!accs.has(a.name)) accs.set(a.name, must(await db.from('accounts').insert(a).select('id').single()).id);
  const cats = new Map<string, string>(must(await db.from('categories').select('id,name,type')).map((c: any) => [c.type + '|' + c.name, c.id]));
  for (const c of b.categories) if (!cats.has(c.type + '|' + c.name)) cats.set(c.type + '|' + c.name, must(await db.from('categories').insert(c).select('id').single()).id);
  const rows = b.transactions.map((t) => {
    const account_id = accs.get(t.account);
    if (!account_id) throw new Error('unknown account');
    const to = t.type === 'transfer' ? accs.get(t.to_account ?? '') : null;
    const ck = t.type === 'transfer' ? null : t.type + '|' + (t.category ?? '');
    return { type: t.type, amount: t.amount, account_id, to_account_id: to ?? null, category_id: ck ? cats.get(ck) ?? null : null, note: t.note ?? null, occurred_on: t.occurred_on, source: 'import' };
  });
  for (let i = 0; i < rows.length; i += 500) must(await db.from('transactions').insert(rows.slice(i, i + 500)));
  return { imported: rows.length };
});
