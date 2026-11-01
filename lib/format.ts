import type { Lang } from './types';
export const formatBDT = (n: number, lang: Lang = 'en') =>
  '৳' + new Intl.NumberFormat(lang === 'bn' ? 'bn-BD' : 'en-IN', { maximumFractionDigits: 2 }).format(n);
export const fmtDate = (iso: string, lang: Lang = 'en') =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const catName = (c: { name: string; name_bn?: string | null } | null | undefined, lang: Lang = 'en') =>
  !c ? '' : lang === 'bn' && c.name_bn ? c.name_bn : c.name;
