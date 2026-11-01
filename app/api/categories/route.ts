import { route } from '@/lib/server';
import { must } from '@/lib/ops';
import { CategoryBody } from '@/lib/schemas';
export const POST = (req: Request) => route(async ({ db }) => must(await db.from('categories').insert(CategoryBody.parse(await req.json())).select().single()));
