import { z } from 'zod';
import { route } from '@/lib/server';
import { must } from '@/lib/ops';
export const DELETE = (_: Request, { params }: { params: Promise<{ id: string }> }) => route(async ({ db }) => {
  must(await db.from('categories').delete().eq('id', z.string().uuid().parse((await params).id)));
  return { ok: true };
});
