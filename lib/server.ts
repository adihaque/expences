import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { HttpError } from './errors';
import { supabaseServer } from './supabase/server';

export async function route(fn: (c: { db: any; user: { id: string } }) => Promise<unknown>) {
  try {
    const db = await supabaseServer();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json(await fn({ db, user }));
  } catch (e) {
    if (e instanceof ZodError) return NextResponse.json({ error: e.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') || 'Invalid input' }, { status: 400 });
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
