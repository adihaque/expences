'use client';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '@/lib/client';
import { todayDhaka } from '@/lib/date';
import { catName } from '@/lib/format';
import type { Tx, TxType } from '@/lib/types';
import { useMeta } from './Meta';

export function TxForm({ tx, onClose, onSaved }: { tx?: Tx | null; onClose: () => void; onSaved: () => void }) {
  const { accounts, categories } = useMeta();
  const active = accounts.filter((a) => !a.archived || a.id === tx?.account_id || a.id === tx?.to_account_id);
  const cash = accounts.find((a) => a.kind === 'cash') ?? accounts[0];
  const [f, setF] = useState({
    type: (tx?.type ?? 'expense') as TxType, amount: tx ? String(tx.amount) : '', account_id: tx?.account_id ?? cash?.id ?? '',
    to_account_id: tx?.to_account_id ?? '', category_id: tx?.category_id ?? '', note: tx?.note ?? '', occurred_on: tx?.occurred_on ?? todayDhaka(),
  });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const cats = categories.filter((c) => c.type === f.type);
  useEffect(() => { if (!f.account_id && cash) set('account_id', cash.id); }, [cash]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const body = { type: f.type, amount: Number(f.amount), account_id: f.account_id, to_account_id: f.type === 'transfer' ? f.to_account_id || null : null,
        category_id: f.type !== 'transfer' && f.category_id ? f.category_id : null, note: f.note || null, occurred_on: f.occurred_on };
      await api(tx ? `/api/transactions/${tx.id}` : '/api/transactions', { method: tx ? 'PATCH' : 'POST', body: JSON.stringify(body) });
      onSaved(); onClose();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="card max-h-[92dvh] w-full max-w-md space-y-3 overflow-y-auto rounded-b-none sm:rounded-b-2xl">
        <div className="flex items-center justify-between"><h2 className="font-semibold">{tx ? 'Edit transaction' : 'New transaction'}</h2><button type="button" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {(['expense', 'income', 'transfer'] as TxType[]).map((t) => (
            <button type="button" key={t} onClick={() => setF((p) => ({ ...p, type: t, category_id: '' }))} className={`rounded-lg py-1.5 text-sm capitalize ${f.type === t ? 'bg-white shadow dark:bg-slate-700' : ''}`}>{t}</button>))}
        </div>
        <div><label className="label">Amount (৳)</label><input className="input" type="number" inputMode="decimal" step="0.01" min="0.01" required value={f.amount} onChange={(e) => set('amount', e.target.value)} autoFocus /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="label">{f.type === 'transfer' ? 'From' : 'Account'}</label><select className="input" required value={f.account_id} onChange={(e) => set('account_id', e.target.value)}>{active.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
          {f.type === 'transfer'
            ? <div><label className="label">To</label><select className="input" required value={f.to_account_id} onChange={(e) => set('to_account_id', e.target.value)}><option value="">Select…</option>{active.filter((a) => a.id !== f.account_id).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
            : <div><label className="label">Category</label><select className="input" value={f.category_id} onChange={(e) => set('category_id', e.target.value)}><option value="">None</option>{cats.map((c) => <option key={c.id} value={c.id}>{catName(c)}{c.name_bn ? ` · ${c.name_bn}` : ''}</option>)}</select></div>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="label">Date</label><input className="input" type="date" required value={f.occurred_on} onChange={(e) => set('occurred_on', e.target.value)} /></div>
          <div><label className="label">Note</label><input className="input" maxLength={200} value={f.note} onChange={(e) => set('note', e.target.value)} /></div>
        </div>
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <button className="btn w-full" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </form>
    </div>
  );
}
