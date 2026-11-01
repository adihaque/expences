import { route } from '@/lib/server';
import { loadContext } from '@/lib/ops';
export const dynamic = 'force-dynamic';
export const GET = () => route(({ db }) => loadContext(db));
