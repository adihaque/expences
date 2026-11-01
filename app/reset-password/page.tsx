'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    if (password.length < 8) { setMsg('Use at least 8 characters.'); return; }
    if (password !== confirm) { setMsg('Passwords do not match.'); return; }
    setBusy(true);
    try {
      const { error } = await supabaseBrowser().auth.updateUser({ password });
      if (error) setMsg(error.message);
      else setDone(true);
    } catch {
      setMsg('Something went wrong. Request a new reset link and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-2xl text-white">৳</div>
        <h1 className="text-xl font-semibold">Set a new password</h1>
        <p className="text-sm text-slate-500">Choose a new password for your account.</p>
      </div>
      {done ? (
        <div className="card space-y-3">
          <p className="text-sm text-emerald-600">Your password has been updated.</p>
          <button className="btn w-full" onClick={() => { router.replace('/'); router.refresh(); }}>Continue to app</button>
        </div>
      ) : (
        <form onSubmit={submit} className="card space-y-3">
          <div>
            <label className="label" htmlFor="new-password">New password</label>
            <input id="new-password" className="input" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="confirm-password">Confirm new password</label>
            <input id="confirm-password" className="input" type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          {msg && <p role="alert" className="text-sm text-amber-600">{msg}</p>}
          <button className="btn w-full" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button>
        </form>
      )}
    </main>
  );
}
