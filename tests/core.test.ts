import { describe, expect, it } from 'vitest';
import { resolveRange, todayDhaka } from '@/lib/date';
import { formatBDT } from '@/lib/format';
import { findAccount, findCategory } from '@/lib/resolve';
import { AddArgs, DeleteArgs, stripNulls, TxBody, UpdateArgs } from '@/lib/schemas';
import { detectLang } from '@/lib/i18n';

const accounts: any[] = [
  { id: '1', name: 'Cash', kind: 'cash' }, { id: '2', name: 'bKash', kind: 'bkash' },
  { id: '3', name: 'Nagad', kind: 'nagad' }, { id: '4', name: 'Bank', kind: 'bank' }, { id: '5', name: 'Rocket', kind: 'custom' },
];
const cats: any[] = [
  { id: 'a', name: 'Food', name_bn: 'খাবার', type: 'expense' }, { id: 'b', name: 'Salary', name_bn: 'বেতন', type: 'income' },
  { id: 'c', name: 'Mobile & Internet', name_bn: 'মোবাইল ও ইন্টারনেট', type: 'expense' },
];

describe('Asia/Dhaka dates', () => {
  it('rolls to the next day after 18:00 UTC', () => expect(todayDhaka(new Date('2026-10-31T19:00:00Z'))).toBe('2026-11-01'));
  it('this_month / last_month', () => {
    expect(resolveRange({ preset: 'this_month' }, '2026-11-01')).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(resolveRange({ preset: 'last_month' }, '2026-01-15')).toEqual({ from: '2025-12-01', to: '2025-12-31' });
  });
  it('week starts Saturday', () => expect(resolveRange({ preset: 'this_week' }, '2026-11-01')).toEqual({ from: '2026-10-31', to: '2026-11-01' }));
  it('yesterday, explicit and swapped ranges', () => {
    expect(resolveRange({ preset: 'yesterday' }, '2026-03-01')).toEqual({ from: '2026-02-28', to: '2026-02-28' });
    expect(resolveRange({ from: '2026-05-10', to: '2026-05-01' })).toEqual({ from: '2026-05-01', to: '2026-05-10' });
  });
});
describe('name resolution', () => {
  it('maps Bangla/Banglish wallets', () => {
    expect(findAccount(accounts, 'নগদ')?.id).toBe('3');
    expect(findAccount(accounts, 'bikash')?.id).toBe('2');
    expect(findAccount(accounts, 'ক্যাশ')?.id).toBe('1');
    expect(findAccount(accounts, 'rocket')?.id).toBe('5');
    expect(findAccount(accounts, 'unknown')).toBeNull();
  });
  it('maps categories in both languages and respects type', () => {
    expect(findCategory(cats, 'খাবার', 'expense')?.id).toBe('a');
    expect(findCategory(cats, 'salary', 'expense')).toBeNull();
    expect(findCategory(cats, 'internet')?.id).toBe('c');
  });
});
describe('validation of AI output', () => {
  it('accepts string amounts and rounds', () => {
    const r = AddArgs.parse(stripNulls({ items: [{ type: 'expense', amount: '250.456', account: null, note: '' }] }));
    expect(r.items[0].amount).toBe(250.46);
    expect(r.items[0].account).toBeUndefined();
  });
  it('rejects bad amounts, dates and types', () => {
    expect(() => AddArgs.parse({ items: [{ type: 'expense', amount: -5 }] })).toThrow();
    expect(() => AddArgs.parse({ items: [{ type: 'expense', amount: 0 }] })).toThrow();
    expect(() => AddArgs.parse({ items: [{ type: 'expense', amount: 5, date: '2026-02-31' }] })).toThrow();
    expect(() => AddArgs.parse({ items: [{ type: 'gift', amount: 5 }] })).toThrow();
    expect(() => AddArgs.parse({ items: [] })).toThrow();
  });
  it('update/delete take a filter object', () => {
    expect(UpdateArgs.parse({ target: { last: true }, changes: { amount: 300 } }).changes.amount).toBe(300);
    expect(DeleteArgs.parse({ target: {} }).target).toEqual({});
  });
  it('manual transfers need a different destination', () => {
    const base = { type: 'transfer', amount: 10, account_id: '11111111-1111-4111-8111-111111111111', occurred_on: '2026-11-01' };
    expect(() => TxBody.parse(base)).toThrow();
    expect(() => TxBody.parse({ ...base, to_account_id: base.account_id })).toThrow();
    expect(TxBody.parse({ ...base, to_account_id: '22222222-2222-4222-8222-222222222222' }).type).toBe('transfer');
  });
});
describe('formatting', () => {
  it('uses ৳ and lakh grouping', () => expect(formatBDT(100000, 'en')).toBe('৳1,00,000'));
  it('detects Bangla script', () => { expect(detectLang('আজ ৫০ টাকা')).toBe('bn'); expect(detectLang('bazar 450')).toBe('en'); });
});
