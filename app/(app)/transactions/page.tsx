'use client';
import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { sign, tone, txTitle } from '@/components/Cards';
import { useMeta } from '@/components/Meta';
import { TxForm } from '@/components/TxForm';
import { api } from '@/lib/client';
import { monthEnd } from '@/lib/date';
import { catName, fmtDate, formatBDT } from '@/lib/format';
import type { Tx } from '@/lib/types';

const PAGE = 30;
export default function History() {
  const { accounts, categories, reload } = useMeta();
  const [rows, setRows] = useState<Tx[]>([]); const [count, setCount] = useState(0); const [loading, setLoading] = useState(true);
  const [f, setF] = useState({ month: '', type: '', account_id: '', category_id: '', q: '' });
  const [edit, setEdit] = useState<Tx | null | 'new'>(null); const [err, setErr] = useState('');

  const load = useCallback(async (offset = 0) => {
    setLoading(true); setErr('');
    const p = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
    if (f.month) { p.set('from', f.month + '-01'); p.set('to', monthEnd(f.month + '-01')); }
    (['type', 'account_id', 'category_id', 'q'] as const).forEach((k) => f[k] && p.set(k, f[k]));
    try { const d = await api(`/api/transactions?${p}`); setRows((r) => (offset ? [...r, ...d.rows] : d.rows)); setCount(d.count); }
    catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  }, [f]);
  useEffect(() => { const t = setTimeout(() => load(0), 250); return () => clearTimeout(t); }, [load]);

  async function del(t: Tx) {
    if (!confirm(`Delete this ${t.type} of ${formatBDT(t.amount)}? This cannot be undone.`)) return;
    try { await api(`/api/transactions/${t.id}`, { method: 'DELETE' }); setRows((r) => r.filter((x) => x.id !== t.id)); setCount((c) => c - 1); reload(); } catch (e: any) { setErr(e.message); }
  }
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  let lastDate = '';
  return (
    <div>
      <div className="mb-3 flex items-center justify-between"><h1 className="text-lg font-semibold">History <span className="text-sm font-normal text-slate-500">({count})</span></h1>
        <button className="btn" onClick={() => setEdit('new')}><Plus size={16} />Add</button></div>
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <input className="input" type="month" value={f.month} onChange={(e) => set('month', e.target.value)} aria-label="Month" />
        <select className="input" value={f.type} onChange={(e) => set('type', e.target.value)}><option value="">All types</option><option value="expense">Expense</option><option value="income">Income</option><option value="transfer">Transfer</option></select>
        <select className="input" value={f.account_id} onChange={(e) => set('account_id', e.target.value)}><option value="">All accounts</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        <select className="input" value={f.category_id} onChange={(e) => set('category_id', e.target.value)}><option value="">All categories</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}</select>
        <input className="input col-span-2 sm:col-span-1" placeholder="Search notes" value={f.q} onChange={(e) => set('q', e.target.value)} />
      </div>
      {err && <p className="mb-2 text-sm text-rose-600">{err}</p>}
      <div className="card !p-0">
        {rows.map((t) => {
          const head = t.occurred_on !== lastDate ? (lastDate = t.occurred_on) : null;
          return (
            <div key={t.id}>
              {head && <div className="bg-slate-100 px-4 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800">{fmtDate(head)}</div>}
              <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-2.5 last:border-0 dark:border-slate-800">
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{txTitle(t, 'en')}{t.category?.name_bn ? <span className="ml-1 text-xs text-slate-500">{t.category.name_bn}</span> : null}</div>
                  <div className="truncate text-xs text-slate-500">{t.account?.name}{t.note ? ` · ${t.note}` : ''}{t.source === 'ai' ? ' · AI' : ''}</div></div>
                <b className={`text-sm ${tone(t)}`}>{sign(t)}{formatBDT(t.amount)}</b>
                <button onClick={() => setEdit(t)} aria-label="Edit" className="text-slate-400 hover:text-slate-700"><Pencil size={16} /></button>
                <button onClick={() => del(t)} aria-label="Delete" className="text-slate-400 hover:text-rose-600"><Trash2 size={16} /></button>
              </div>
            </div>);
        })}
        {!loading && rows.length === 0 && <p className="p-6 text-center text-sm text-slate-500">No transactions found.</p>}
      </div>
      {rows.length < count && <button className="btn-ghost mx-auto mt-3 flex" disabled={loading} onClick={() => load(rows.length)}>Load more</button>}
      {edit && <TxForm tx={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={() => { load(0); reload(); }} />}
    </div>
  );
}
