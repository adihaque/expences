import { z } from 'zod';
import { route } from '@/lib/server';
import { confirmPending } from '@/lib/chat';
export const POST = (req: Request) => route(async ({ db }) => {
  const b = z.object({ id: z.string().uuid(), approve: z.boolean() }).parse(await req.json());
  return confirmPending(db, b.id, b.approve);
});
