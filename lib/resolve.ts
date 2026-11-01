import type { Account, Category } from './types';
const norm = (s: string) => s.toLowerCase().normalize('NFC').replace(/[\s\-_.,'’"()]/g, '');
const ALIAS: Record<string, string[]> = {
  cash: ['cash', 'ক্যাশ', 'নগদটাকা', 'হাতেনগদ', 'wallet', 'ওয়ালেট'],
  bkash: ['bkash', 'bikash', 'bkas', 'বিকাশ', 'বিকাস'],
  nagad: ['nagad', 'nogod', 'nagod', 'নগদ'],
  bank: ['bank', 'ব্যাংক', 'ব্যাঙ্ক'],
};
export function findAccount(accs: Account[], q: string): Account | null {
  const n = norm(q); if (!n) return null;
  const exact = accs.find((a) => norm(a.name) === n); if (exact) return exact;
  const al = accs.find((a) => ALIAS[a.kind]?.includes(n)); if (al) return al;
  const part = accs.filter((a) => norm(a.name).includes(n) || n.includes(norm(a.name)));
  return part.length === 1 ? part[0] : null;
}
export function findCategory(cats: Category[], q: string, type?: string): Category | null {
  const n = norm(q); if (!n) return null;
  const pool = cats.filter((c) => !type || c.type === type);
  const exact = pool.find((c) => norm(c.name) === n || (c.name_bn && norm(c.name_bn) === n)); if (exact) return exact;
  const part = pool.filter((c) => norm(c.name).includes(n) || n.includes(norm(c.name)) || (c.name_bn && norm(c.name_bn).includes(n)));
  return part.length === 1 ? part[0] : null;
}
export const defaultAccount = (accs: Account[]) => accs.find((a) => a.kind === 'cash') ?? accs[0] ?? null;
