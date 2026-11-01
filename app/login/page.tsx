'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';

type Mode = 'in' | 'up' | 'forgot';

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      const sb = supabaseBrowser();
      if (mode === 'forgot') {
        const { error } = await sb.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        });
        setMsg(error ? error.message : 'Password reset link sent. Check your inbox and spam folder.');
        return;
      }
      if (mode === 'in') {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) setMsg(error.message);
        else { router.replace('/'); router.refresh(); }
      } else {
        const { data, error } = await sb.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) setMsg(error.message);
        else if (data.session) { router.replace('/'); router.refresh(); }
        else setMsg('Check your email to confirm your account, then sign in.');
      }
    } catch {
      setMsg('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const title = mode === 'in' ? 'Sign in' : mode === 'up' ? 'Create account' : 'Reset password';
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-2xl text-white">৳</div>
        <h1 className="text-xl font-semibold">খরচ · AI Expense Tracker</h1>
        <p className="text-sm text-slate-500">Bangla · English · Banglish</p>
      </div>
      <form onSubmit={submit} className="card space-y-3">
        <h2 className="text-base font-semibold">{title}</h2>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {mode !== 'forgot' && (
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" className="input" type="password" required minLength={8}
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        )}
        {msg && <p role="status" className="text-sm text-amber-600">{msg}</p>}
        <button className="btn w-full" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'forgot' ? 'Send reset link' : title}
        </button>
        {mode === 'in' && <button type="button" className="w-full text-sm text-slate-500 underline" onClick={() => { setMode('forgot'); setMsg(''); }}>Forgot password?</button>}
        <button type="button" className="w-full text-sm text-slate-500 underline" onClick={() => { setMode(mode === 'up' ? 'in' : 'up'); setMsg(''); }}>
          {mode === 'up' ? 'Have an account? Sign in' : 'New here? Create an account'}
        </button>
        {mode === 'forgot' && <button type="button" className="w-full text-sm text-slate-500 underline" onClick={() => { setMode('in'); setMsg(''); }}>Back to sign in</button>}
      </form>
    </main>
  );
}
