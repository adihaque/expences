'use client';
import { catName, fmtDate, formatBDT } from '@/lib/format';
import { T } from '@/lib/i18n';
import type { Card, Lang, Tx } from '@/lib/types';

export const txTitle = (t: Tx, lang: Lang) => (t.type === 'transfer' ? `${t.account?.name} → ${t.to_account?.name}` : catName(t.category, lang) || T(lang).type[t.type]);
export const sign = (t: Tx) => (t.type === 'income' ? '+' : t.type === 'expense' ? '−' : '');
export const tone = (t: Tx) => (t.type === 'income' ? 'text-emerald-600' : t.type === 'expense' ? 'text-rose-600' : 'text-sky-600');

export function ChatCard({ card, lang }: { card: Card; lang: Lang }) {
  const L = T(lang);
  if (card.kind === 'transactions')
    return <ul className="mt-2 divide-y divide-slate-200 text-sm dark:divide-slate-700">{card.rows.map((t) => (
      <li key={t.id} className="flex justify-between gap-2 py-1.5"><span className="min-w-0"><span className="block truncate">{txTitle(t, lang)}</span>
        <span className="text-xs text-slate-500">{fmtDate(t.occurred_on, lang)} · {t.account?.name}{t.note ? ` · ${t.note}` : ''}</span></span>
        <b className={`shrink-0 ${tone(t)}`}>{sign(t)}{formatBDT(t.amount, lang)}</b></li>))}</ul>;
  if (card.kind === 'summary')
    return <div className="mt-2 text-sm"><div className="grid grid-cols-3 gap-2 text-center">
      <div><div className="text-xs text-slate-500">{L.type.income}</div><b className="text-emerald-600">{L.money(card.income)}</b></div>
      <div><div className="text-xs text-slate-500">{L.type.expense}</div><b className="text-rose-600">{L.money(card.expense)}</b></div>
      <div><div className="text-xs text-slate-500">{lang === 'bn' ? 'নিট' : 'Net'}</div><b>{L.money(card.net)}</b></div></div>
      {card.by_category.length > 0 && <ul className="mt-2 space-y-0.5 border-t border-slate-200 pt-2 dark:border-slate-700">{card.by_category.map((c, i) => (
        <li key={i} className="flex justify-between"><span>{catName(c, lang)} <span className="text-xs text-slate-500">({L.type[c.type as 'expense']})</span></span><span>{L.money(c.total)}</span></li>))}</ul>}</div>;
  if (card.kind === 'balances')
    return <ul className="mt-2 space-y-0.5 text-sm">{card.rows.map((r) => <li key={r.id} className="flex justify-between"><span>{r.name}</span><b>{L.money(r.balance)}</b></li>)}</ul>;
  return <ul className="mt-2 space-y-2 text-sm">{card.rows.map((r) => (
    <li key={r.id}><div className="flex justify-between"><span>{catName(r, lang)}</span><span>{L.money(r.spent)} / {L.money(r.amount)}</span></div>
      <div className="mt-1 h-2 overflow-hidden rounded bg-slate-200 dark:bg-slate-700"><div className={`h-full ${(r.pct ?? 0) >= 100 ? 'bg-rose-500' : (r.pct ?? 0) >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, r.pct ?? 0)}%` }} /></div></li>))}</ul>;
}
