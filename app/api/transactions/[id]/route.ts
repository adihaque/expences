import { z } from 'zod';
import { route } from '@/lib/server';
import { must, TX_SELECT } from '@/lib/ops';
import { TxPatchBody } from '@/lib/schemas';
type P = { params: Promise<{ id: string }> };
export const PATCH = (req: Request, { params }: P) => route(async ({ db }) => {
  const id = z.string().uuid().parse((await params).id);
  const b = TxPatchBody.parse(await req.json());
  return must(await db.from('transactions').update(b).eq('id', id).select(TX_SELECT).single());
});
export const DELETE = (_: Request, { params }: P) => route(async ({ db }) => {
  const id = z.string().uuid().parse((await params).id);
  must(await db.from('transactions').delete().eq('id', id));
  return { ok: true };
});
