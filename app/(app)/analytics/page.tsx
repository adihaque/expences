'use client';
import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useMeta } from '@/components/Meta';
import { api } from '@/lib/client';
import { monthEnd, todayDhaka } from '@/lib/date';
import { catName, formatBDT } from '@/lib/format';
import type { Summary } from '@/lib/types';

const COLORS = ['#059669', '#0ea5e9', '#f59e0b', '#e11d48', '#8b5cf6', '#14b8a6', '#f97316', '#64748b', '#84cc16', '#ec4899'];
const tip = { contentStyle: { background: 'var(--tip-bg, #fff)', border: '1px solid #cbd5e1', borderRadius: 12, fontSize: 12, color: '#0f172a' } };

export default function Analytics() {
  const { accounts } = useMeta();
  const today = todayDhaka();
  const [mode, setMode] = useState<'month' | 'day'>('month');
  const [month, setMonth] = useState(today.slice(0, 7)); const [day, setDay] = useState(today);
  const [s, setS] = useState<Summary | null>(null); const [err, setErr] = useState('');
  useEffect(() => {
    const [from, to] = mode === 'month' ? [month + '-01', monthEnd(month + '-01')] : [day, day];
    if (!from || month.length !== 7) return;
    setErr('');
    api(`/api/summary?from=${from}&to=${to}`).then(setS).catch((e) => setErr(e.message));
  }, [mode, month, day]);
  const exp = (s?.by_category ?? []).filter((c) => c.type === 'expense').map((c) => ({ name: catName(c), value: Number(c.total) }));
  const inc = (s?.by_category ?? []).filter((c) => c.type === 'income');
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2"><h1 className="text-lg font-semibold">Analytics</h1>
        <div className="flex gap-2">
          <div className="flex rounded-xl bg-slate-200 p-1 text-sm dark:bg-slate-800">{(['month', 'day'] as const).map((m) => <button key={m} onClick={() => setMode(m)} className={`rounded-lg px-3 py-1 ${mode === m ? 'bg-white shadow dark:bg-slate-700' : ''}`}>{m === 'month' ? 'Monthly' : 'Daily'}</button>)}</div>
          {mode === 'month' ? <input className="input !w-auto" type="month" value={month} onChange={(e) => setMonth(e.target.value)} /> : <input className="input !w-auto" type="date" value={day} onChange={(e) => setDay(e.target.value)} />}
        </div></div>
      {err && <p className="text-sm text-rose-600">{err}</p>}
      {s && (<>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="card !p-3"><div className="text-xs text-slate-500">Income</div><b className="text-emerald-600">{formatBDT(s.income)}</b></div>
          <div className="card !p-3"><div className="text-xs text-slate-500">Expense</div><b className="text-rose-600">{formatBDT(s.expense)}</b></div>
          <div className="card !p-3"><div className="text-xs text-slate-500">Net</div><b>{formatBDT(s.net)}</b></div></div>
        {s.count === 0 && <p className="card text-center text-sm text-slate-500">No transactions in this period.</p>}
        {exp.length > 0 && <div className="card"><h2 className="mb-2 text-sm font-medium">Spending by category</h2>
          <div className="h-60"><ResponsiveContainer><PieChart><Pie data={exp} dataKey="value" nameKey="name" innerRadius={45} outerRadius={85} paddingAngle={2}>{exp.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie>
            <Tooltip {...tip} formatter={(v: any) => formatBDT(Number(v))} /></PieChart></ResponsiveContainer></div>
          <ul className="mt-2 space-y-1 text-sm">{exp.map((c, i) => <li key={c.name} className="flex justify-between"><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />{c.name}</span><span>{formatBDT(c.value)}</span></li>)}</ul></div>}
        {inc.length > 0 && <div className="card"><h2 className="mb-2 text-sm font-medium">Income sources</h2><ul className="space-y-1 text-sm">{inc.map((c, i) => <li key={i} className="flex justify-between"><span>{catName(c)}</span><span>{formatBDT(c.total)}</span></li>)}</ul></div>}
        {mode === 'month' && s.daily.length > 0 && <div className="card"><h2 className="mb-2 text-sm font-medium">Daily income &amp; expense</h2>
          <div className="h-56 text-slate-500"><ResponsiveContainer><BarChart data={s.daily.map((d) => ({ ...d, date: d.date.slice(8) }))}><CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="date" tick={{ fill: 'currentColor', fontSize: 11 }} /><YAxis tick={{ fill: 'currentColor', fontSize: 11 }} width={48} />
            <Tooltip {...tip} formatter={(v: any) => formatBDT(Number(v))} /><Legend /><Bar dataKey="income" fill="#059669" radius={[4, 4, 0, 0]} /><Bar dataKey="expense" fill="#e11d48" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></div>}
      </>)}
      <div className="card"><h2 className="mb-2 text-sm font-medium">Account balances</h2><ul className="space-y-1 text-sm">{accounts.filter((a) => !a.archived).map((a) => <li key={a.id} className="flex justify-between"><span>{a.name}</span><b>{formatBDT(Number(a.balance ?? 0))}</b></li>)}</ul></div>
    </div>
  );
}
