'use client';
import { useCallback, useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useMeta } from '@/components/Meta';
import { api } from '@/lib/client';
import { catName, formatBDT } from '@/lib/format';
import type { BudgetRow } from '@/lib/types';

export default function Budgets() {
  const { categories } = useMeta();
  const [rows, setRows] = useState<BudgetRow[]>([]); const [cat, setCat] = useState(''); const [amount, setAmount] = useState(''); const [err, setErr] = useState('');
  const load = useCallback(() => api('/api/budgets').then(setRows).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    try { await api('/api/budgets', { method: 'PUT', body: JSON.stringify({ category_id: cat || null, amount: Number(amount) }) }); setAmount(''); load(); } catch (e: any) { setErr(e.message); }
  }
  async function del(id: string) { if (confirm('Remove this budget?')) { await api(`/api/budgets?id=${id}`, { method: 'DELETE' }).catch((e) => setErr(e.message)); load(); } }
  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold">Monthly budgets</h1>
      <form onSubmit={save} className="card flex flex-wrap items-end gap-2">
        <div className="min-w-[10rem] flex-1"><label className="label">Category</label><select className="input" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Overall (all spending)</option>{categories.filter((c) => c.type === 'expense').map((c) => <option key={c.id} value={c.id}>{catName(c)}</option>)}</select></div>
        <div className="w-36"><label className="label">Limit (৳)</label><input className="input" type="number" min="1" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <button className="btn">Set budget</button>
      </form>
      {err && <p className="text-sm text-rose-600">{err}</p>}
      {rows.length === 0 && <p className="card text-center text-sm text-slate-500">No budgets yet. Set one above, or tell the chat: “Food এর বাজেট ১০০০০”.</p>}
      {rows.map((r) => (
        <div key={r.id} className="card !p-3">
          <div className="flex items-center justify-between"><b className="text-sm">{r.name}</b><div className="flex items-center gap-3 text-sm"><span className={(r.pct ?? 0) >= 100 ? 'font-semibold text-rose-600' : ''}>{r.pct ?? 0}%</span><button onClick={() => del(r.id)} aria-label="Remove" className="text-slate-400 hover:text-rose-600"><Trash2 size={16} /></button></div></div>
          <div className="my-2 h-2.5 overflow-hidden rounded bg-slate-200 dark:bg-slate-700"><div className={`h-full ${(r.pct ?? 0) >= 100 ? 'bg-rose-500' : (r.pct ?? 0) >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, r.pct ?? 0)}%` }} /></div>
          <div className="flex justify-between text-xs text-slate-500"><span>Spent {formatBDT(r.spent)} of {formatBDT(r.amount)}</span><span>{r.remaining >= 0 ? `Left ${formatBDT(r.remaining)}` : `Over by ${formatBDT(-r.remaining)}`}</span></div>
        </div>))}
    </div>
  );
}
