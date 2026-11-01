// All "today"/"this month" logic uses Asia/Dhaka, independent of server timezone.
const TZ = 'Asia/Dhaka';
const parts = (iso: string) => iso.split('-').map(Number) as [number, number, number];
export const todayDhaka = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
export const addDays = (iso: string, n: number) => { const [y, m, d] = parts(iso); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
export const monthStart = (iso: string) => iso.slice(0, 7) + '-01';
export const monthEnd = (iso: string) => { const [y, m] = parts(iso); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
/** first day of the month n months away */
export const addMonths = (iso: string, n: number) => { const [y, m] = parts(iso); return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10); };
export const weekdayName = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
export const PRESETS = ['today', 'yesterday', 'this_week', 'last_week', 'last_7_days', 'last_30_days', 'this_month', 'last_month', 'this_year', 'all'] as const;
export type Range = { preset?: (typeof PRESETS)[number]; from?: string; to?: string };

export function resolveRange(r: Range | undefined, today = todayDhaka()): { from: string; to: string } {
  if (r?.from || r?.to) {
    let from = r.from ?? r.to!, to = r.to ?? today;
    if (r.from && !r.to) to = today > from ? today : from;
    if (from > to) [from, to] = [to, from];
    return { from, to };
  }
  switch (r?.preset ?? 'this_month') {
    case 'today': return { from: today, to: today };
    case 'yesterday': { const y = addDays(today, -1); return { from: y, to: y }; }
    case 'this_week': case 'last_week': { // Dhaka week starts Saturday
      const dow = new Date(today + 'T00:00:00Z').getUTCDay();
      const start = addDays(today, -((dow + 1) % 7));
      return r?.preset === 'this_week' ? { from: start, to: today } : { from: addDays(start, -7), to: addDays(start, -1) };
    }
    case 'last_7_days': return { from: addDays(today, -6), to: today };
    case 'last_30_days': return { from: addDays(today, -29), to: today };
    case 'last_month': { const s = addMonths(today, -1); return { from: s, to: monthEnd(s) }; }
    case 'this_year': return { from: today.slice(0, 4) + '-01-01', to: today.slice(0, 4) + '-12-31' };
    case 'all': return { from: '1970-01-01', to: '2999-12-31' };
    default: return { from: monthStart(today), to: monthEnd(today) };
  }
}
