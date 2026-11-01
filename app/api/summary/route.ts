import { z } from 'zod';
import { route } from '@/lib/server';
import { must } from '@/lib/ops';
import { isoDate } from '@/lib/schemas';
export const dynamic = 'force-dynamic';
export const GET = (req: Request) => route(async ({ db }) => {
  const sp = new URL(req.url).searchParams;
  const p = z.object({ from: isoDate, to: isoDate }).parse({ from: sp.get('from'), to: sp.get('to') });
  return must(await db.rpc('summary', { p_from: p.from, p_to: p.to, p_category: null, p_account: null }));
});
