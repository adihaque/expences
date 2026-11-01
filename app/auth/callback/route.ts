import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next');
  const destination = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

  if (code) {
    const db = await supabaseServer();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent('The link is invalid or expired. Request a new one.')}`, url.origin));
    }
  }
  return NextResponse.redirect(new URL(destination, url.origin));
}
