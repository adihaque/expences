'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Download, LogOut, Trash2, Upload } from 'lucide-react';
import { useMeta } from '@/components/Meta';
import { api } from '@/lib/client';
import { catName, formatBDT } from '@/lib/format';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function SettingsPage() {
  const { accounts, categories, reload } = useMeta();
  const { theme, setTheme } = useTheme(); const router = useRouter();
  const [mounted, setMounted] = useState(false); useEffect(() => setMounted(true), []);
  const [msg, setMsg] = useState('');
  const [acc, setAcc] = useState({ name: '', opening_balance: '' });
  const [editing, setEditing] = useState<{ id: string; name: string; opening_balance: string } | null>(null);
  const [cat, setCat] = useState({ name: '', name_bn: '', type: 'expense' });
  const run = async (fn: () => Promise<unknown>, ok = '') => { setMsg(''); try { await fn(); await reload(); if (ok) setMsg(ok); } catch (e: any) { setMsg('⚠️ ' + e.message); } };

  async function importFile(file: File) {
    if (!confirm('Restore this backup? Its data is ADDED to your current data (duplicates are possible if you already have it).')) return;
    await run(async () => { const r = await api('/api/import', { method: 'POST', body: await file.text() }); setMsg(`Imported ${r.imported} transactions.`); });
  }
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Settings</h1>
      {msg && <p className="card !p-3 text-sm">{msg}</p>}

      <section className="card"><h2 className="mb-2 text-sm font-medium">Theme</h2><div className="flex gap-2">{['system', 'light', 'dark'].map((t) => <button key={t} onClick={() => setTheme(t)} className={`btn-ghost capitalize ${mounted && theme === t ? '!border-emerald-600 !text-emerald-600' : ''}`}>{t}</button>)}</div></section>

      <section className="card"><h2 className="mb-2 text-sm font-medium">Accounts</h2>
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">{accounts.map((a) => (
          <li key={a.id} className="flex items-center gap-2 py-2 text-sm">
            {editing?.id === a.id ? (<>
              <input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              <input className="input !w-32" type="number" step="0.01" value={editing.opening_balance} onChange={(e) => setEditing({ ...editing, opening_balance: e.target.value })} title="Opening balance" />
              <button className="btn !px-3" onClick={() => run(async () => { await api(`/api/accounts/${a.id}`, { method: 'PATCH', body: JSON.stringify({ name: editing.name, opening_balance: Number(editing.opening_balance) }) }); setEditing(null); })}>Save</button></>
            ) : (<>
              <span className="flex-1">{a.name}{a.archived && <em className="ml-1 text-xs text-slate-500">(archived)</em>}<span className="block text-xs text-slate-500">Opening {formatBDT(a.opening_balance)}</span></span>
              <b>{formatBDT(Number(a.balance ?? 0))}</b>
              <button className="text-xs underline" onClick={() => setEditing({ id: a.id, name: a.name, opening_balance: String(a.opening_balance) })}>Edit</button>
              {a.archived ? <button className="text-xs underline" onClick={() => run(() => api(`/api/accounts/${a.id}`, { method: 'PATCH', body: JSON.stringify({ archived: false }) }))}>Restore</button>
                : <button aria-label="Delete" className="text-slate-400 hover:text-rose-600" onClick={() => confirm(`Remove ${a.name}? If it has transactions it will be archived instead.`) && run(() => api(`/api/accounts/${a.id}`, { method: 'DELETE' }))}><Trash2 size={16} /></button>}</>)}
          </li>))}</ul>
        <form className="mt-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); run(async () => { await api('/api/accounts', { method: 'POST', body: JSON.stringify({ name: acc.name, opening_balance: Number(acc.opening_balance || 0) }) }); setAcc({ name: '', opening_balance: '' }); }); }}>
          <input className="input min-w-[8rem] flex-1" placeholder="New account (e.g. Rocket, Savings)" required value={acc.name} onChange={(e) => setAcc({ ...acc, name: e.target.value })} />
          <input className="input !w-32" type="number" step="0.01" placeholder="Opening ৳" value={acc.opening_balance} onChange={(e) => setAcc({ ...acc, opening_balance: e.target.value })} />
          <button className="btn">Add</button></form></section>

      <section className="card"><h2 className="mb-2 text-sm font-medium">Categories</h2>
        {(['expense', 'income'] as const).map((t) => (<div key={t} className="mb-2"><div className="mb-1 text-xs uppercase text-slate-500">{t}</div><div className="flex flex-wrap gap-1.5">{categories.filter((c) => c.type === t).map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs dark:bg-slate-800">{catName(c)}{c.name_bn ? ` · ${c.name_bn}` : ''}
            <button aria-label={`Delete ${c.name}`} className="text-slate-400 hover:text-rose-600" onClick={() => confirm(`Delete category ${c.name}? Existing transactions keep their amounts but become uncategorized.`) && run(() => api(`/api/categories/${c.id}`, { method: 'DELETE' }))}>×</button></span>))}</div></div>))}
        <form className="mt-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); run(async () => { await api('/api/categories', { method: 'POST', body: JSON.stringify({ ...cat, name_bn: cat.name_bn || null }) }); setCat({ ...cat, name: '', name_bn: '' }); }); }}>
          <input className="input min-w-[7rem] flex-1" placeholder="Name" required value={cat.name} onChange={(e) => setCat({ ...cat, name: e.target.value })} />
          <input className="input min-w-[7rem] flex-1" placeholder="বাংলা নাম (optional)" value={cat.name_bn} onChange={(e) => setCat({ ...cat, name_bn: e.target.value })} />
          <select className="input !w-28" value={cat.type} onChange={(e) => setCat({ ...cat, type: e.target.value })}><option value="expense">Expense</option><option value="income">Income</option></select>
          <button className="btn">Add</button></form></section>

      <section className="card"><h2 className="mb-2 text-sm font-medium">Export &amp; backup</h2>
        <div className="flex flex-wrap gap-2">
          <a className="btn-ghost" href="/api/export?format=json" download><Download size={16} />Full backup (JSON)</a>
          <a className="btn-ghost" href="/api/export?format=csv" download><Download size={16} />Transactions (CSV)</a>
          <label className="btn-ghost cursor-pointer"><Upload size={16} />Restore backup<input type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importFile(f); }} /></label></div></section>

      <button className="btn-ghost" onClick={async () => { await supabaseBrowser().auth.signOut(); router.replace('/login'); router.refresh(); }}><LogOut size={16} />Sign out</button>
    </div>
  );
}
