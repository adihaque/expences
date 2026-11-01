import { z } from 'zod';
import { route } from '@/lib/server';
import { must } from '@/lib/ops';
import { AccountPatch } from '@/lib/schemas';
type P = { params: Promise<{ id: string }> };
export const PATCH = (req: Request, { params }: P) => route(async ({ db }) => {
  const id = z.string().uuid().parse((await params).id);
  return must(await db.from('accounts').update(AccountPatch.parse(await req.json())).eq('id', id).select().single());
});
/** Deletes an unused account; if it has transactions it is archived instead (history is preserved). */
export const DELETE = (_: Request, { params }: P) => route(async ({ db }) => {
  const id = z.string().uuid().parse((await params).id);
  const r = await db.from('accounts').delete().eq('id', id);
  if (r.error?.code === '23503') { must(await db.from('accounts').update({ archived: true }).eq('id', id)); return { archived: true }; }
  must(r);
  return { deleted: true };
});
