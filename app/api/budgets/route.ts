import { z } from 'zod';
import { route } from '@/lib/server';
import { must } from '@/lib/ops';
import { upsertBudget } from '@/lib/chat';
import { monthEnd, todayDhaka } from '@/lib/date';
import { BudgetBody } from '@/lib/schemas';
export const dynamic = 'force-dynamic';
export const GET = (req: Request) => route(async ({ db }) => {
  const m = z.string().regex(/^\d{4}-\d{2}$/).default(todayDhaka().slice(0, 7)).parse(new URL(req.url).searchParams.get('month') ?? undefined);
  return must(await db.rpc('budget_status', { p_from: m + '-01', p_to: monthEnd(m + '-01') }));
});
export const PUT = (req: Request) => route(async ({ db }) => { const b = BudgetBody.parse(await req.json()); await upsertBudget(db, b.category_id, b.amount); return { ok: true }; });
export const DELETE = (req: Request) => route(async ({ db }) => {
  must(await db.from('budgets').delete().eq('id', z.string().uuid().parse(new URL(req.url).searchParams.get('id'))));
  return { ok: true };
});
