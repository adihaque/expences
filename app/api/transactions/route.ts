import { z } from 'zod';
import { route } from '@/lib/server';
import { must, TX_SELECT } from '@/lib/ops';
import { isoDate, TxBody } from '@/lib/schemas';
export const dynamic = 'force-dynamic';

const Q = z.object({
  from: isoDate.optional(), to: isoDate.optional(), type: z.enum(['expense', 'income', 'transfer']).optional(),
  account_id: z.string().uuid().optional(), category_id: z.string().uuid().optional(), q: z.string().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30), offset: z.coerce.number().int().min(0).default(0),
});
export const GET = (req: Request) => route(async ({ db }) => {
  const p = Q.parse(Object.fromEntries(Object.entries(Object.fromEntries(new URL(req.url).searchParams)).filter(([, v]) => v !== '')));
  let q = db.from('transactions').select(TX_SELECT, { count: 'exact' });
  if (p.from) q = q.gte('occurred_on', p.from);
  if (p.to) q = q.lte('occurred_on', p.to);
  if (p.type) q = q.eq('type', p.type);
  if (p.account_id) q = q.or(`account_id.eq.${p.account_id},to_account_id.eq.${p.account_id}`);
  if (p.category_id) q = q.eq('category_id', p.category_id);
  if (p.q) q = q.ilike('note', `%${p.q.replace(/[%_,()\\]/g, ' ')}%`);
  const r = await q.order('occurred_on', { ascending: false }).order('created_at', { ascending: false }).range(p.offset, p.offset + p.limit - 1);
  return { rows: must(r), count: r.count ?? 0 };
});
export const POST = (req: Request) => route(async ({ db }) => {
  const b = TxBody.parse(await req.json());
  return must(await db.from('transactions').insert({ ...b, source: 'manual' }).select(TX_SELECT).single());
});
