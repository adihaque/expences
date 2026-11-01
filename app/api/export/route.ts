import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { must, TX_SELECT } from '@/lib/ops';
import { todayDhaka } from '@/lib/date';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const csvCell = (v: unknown) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // spreadsheet formula injection guard
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export async function GET(req: Request) {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const format = new URL(req.url).searchParams.get('format') === 'csv' ? 'csv' : 'json';
    const txs: any[] = [];
    for (let from = 0; ; from += 1000) {
      const page = must(await db.from('transactions').select(TX_SELECT).order('occurred_on').order('created_at').range(from, from + 999));
      txs.push(...page);
      if (page.length < 1000) break;
    }
    const stamp = todayDhaka();
    if (format === 'csv') {
      const head = 'date,type,amount_bdt,account,to_account,category,note';
      const body = txs.map((t) => [t.occurred_on, t.type, t.amount, t.account?.name, t.to_account?.name, t.category?.name, t.note].map(csvCell).join(','));
      return new NextResponse('\uFEFF' + [head, ...body].join('\r\n'), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="transactions-${stamp}.csv"` } });
    }
    const [a, c, b] = await Promise.all([
      db.from('accounts').select('name,kind,opening_balance,archived'), db.from('categories').select('name,name_bn,type'),
      db.from('budgets').select('amount, category:categories!category_id(name)'),
    ]);
    const out = {
      version: 1, exported_at: new Date().toISOString(), currency: 'BDT', timezone: 'Asia/Dhaka',
      accounts: must(a), categories: must(c), budgets: must(b).map((x: any) => ({ category: x.category?.name ?? null, amount: x.amount })),
      transactions: txs.map((t) => ({ type: t.type, amount: t.amount, account: t.account?.name, to_account: t.to_account?.name ?? null, category: t.category?.name ?? null, note: t.note, occurred_on: t.occurred_on })),
    };
    return new NextResponse(JSON.stringify(out, null, 2), { headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="expense-backup-${stamp}.json"` } });
  } catch (e) { console.error(e); return NextResponse.json({ error: 'Export failed' }, { status: 500 }); }
}
