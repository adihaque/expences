import { route } from '@/lib/server';
import { must } from '@/lib/ops';
import { AccountBody } from '@/lib/schemas';
export const POST = (req: Request) => route(async ({ db }) => must(await db.from('accounts').insert(AccountBody.parse(await req.json())).select().single()));
