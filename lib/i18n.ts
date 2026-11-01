import { catName, fmtDate, formatBDT } from './format';
import type { Lang, Summary, Tx } from './types';
export const detectLang = (s: string): Lang => (/[\u0980-\u09FF]/.test(s) ? 'bn' : 'en');

export function T(lang: Lang) {
  const bn = lang === 'bn';
  const type = { expense: bn ? 'খরচ' : 'Expense', income: bn ? 'আয়' : 'Income', transfer: bn ? 'ট্রান্সফার' : 'Transfer' };
  const money = (n: number) => formatBDT(n, lang);
  const tx = (t: Tx) =>
    `${type[t.type]} ${money(t.amount)} · ${t.type === 'transfer' ? `${t.account?.name} → ${t.to_account?.name}` : `${catName(t.category, lang) || '—'} · ${t.account?.name}`} · ${fmtDate(t.occurred_on, lang)}${t.note ? ` · ${t.note}` : ''}`;
  return {
    type, money, tx,
    saved: (t: Tx) => `✅ ${bn ? 'সংরক্ষিত' : 'Saved'}: ${tx(t)}`,
    updated: (t: Tx) => `✏️ ${bn ? 'আপডেট হয়েছে' : 'Updated'}: ${tx(t)}`,
    updatedN: (n: number) => `✏️ ${bn ? `${n}টি লেনদেন আপডেট হয়েছে` : `${n} transactions updated`}`,
    deleted: (n: number) => `🗑️ ${bn ? `${n}টি লেনদেন মুছে ফেলা হয়েছে` : `${n} transaction(s) deleted`}`,
    cancelled: bn ? 'বাতিল করা হয়েছে। কিছু পরিবর্তন হয়নি।' : 'Cancelled. Nothing was changed.',
    expired: bn ? 'এই অনুরোধের মেয়াদ শেষ। আবার চেষ্টা করুন।' : 'That request expired. Please try again.',
    rate: bn ? 'অনেক বার্তা পাঠানো হয়েছে, এক মিনিট অপেক্ষা করুন।' : 'Too many messages — please wait a minute.',
    aiDown: bn ? 'AI এখন পাওয়া যাচ্ছে না। + বাটন দিয়ে হাতে এন্ট্রি করতে পারেন।' : 'AI is unavailable right now. You can still add entries manually with the + button.',
    fail: bn ? 'কিছু একটা সমস্যা হয়েছে। কিছু পরিবর্তন হয়নি।' : 'Something went wrong. Nothing was changed.',
    invalid: bn ? 'নিরাপদে বুঝতে পারিনি। পরিমাণসহ আবার লিখুন।' : "I couldn't understand that safely. Please rephrase with the amount and details.",
    confirmDelete: (rows: Tx[]) => `⚠️ ${bn ? `${rows.length}টি লেনদেন মুছবেন?` : `Delete ${rows.length} transaction(s)?`}\n` + rows.slice(0, 8).map((r) => '• ' + tx(r)).join('\n') + (rows.length > 8 ? `\n… +${rows.length - 8}` : ''),
    confirmUpdate: (rows: Tx[], desc: string) => `⚠️ ${bn ? `${rows.length}টি লেনদেন পরিবর্তন করবেন?` : `Change ${rows.length} transactions?`} (${desc})\n` + rows.slice(0, 8).map((r) => '• ' + tx(r)).join('\n') + (rows.length > 8 ? `\n… +${rows.length - 8}` : ''),
    listHead: (shown: number, total: number) => (bn ? `📋 ${total}টি লেনদেন পাওয়া গেছে (সর্বশেষ ${shown}টি)` : `📋 ${total} transaction(s) found (showing latest ${shown})`),
    summary: (from: string, to: string, s: Summary) =>
      `📊 ${fmtDate(from, lang)}${from === to ? '' : ' – ' + fmtDate(to, lang)}: ${type.income} ${money(s.income)} · ${type.expense} ${money(s.expense)} · ${bn ? 'নিট' : 'Net'} ${money(s.net)} (${s.count})`,
    balances: bn ? '💰 অ্যাকাউন্ট ব্যালেন্স' : '💰 Account balances',
    budgets: bn ? '🎯 বাজেট অবস্থা (এই মাস)' : '🎯 Budget status (this month)',
    noBudgets: bn ? 'কোনো বাজেট সেট করা নেই।' : 'No budgets set yet.',
    budgetSet: (cat: string, n: number) => `🎯 ${bn ? 'মাসিক বাজেট সেট' : 'Monthly budget set'}: ${cat} ${money(n)}`,
    accountCreated: (n: string) => `🏦 ${bn ? 'অ্যাকাউন্ট তৈরি হয়েছে' : 'Account created'}: ${n}`,
    newCat: (n: string) => (bn ? ` (নতুন ক্যাটাগরি: ${n})` : ` (new category: ${n})`),
    err(code: string, arg?: string) {
      switch (code) {
        case 'none': return bn ? 'মিলে যায় এমন কোনো লেনদেন পাওয়া যায়নি।' : 'No matching transactions found.';
        case 'tooMany': return bn ? 'অনেক বেশি লেনদেন মিলেছে। আরও নির্দিষ্ট করে বলুন।' : 'Too many matches. Please be more specific.';
        case 'needTarget': return bn ? 'কোন লেনদেন? তারিখ, পরিমাণ বা ক্যাটাগরি বলুন।' : 'Which transaction? Please give a date, amount or category.';
        case 'noAccount': return bn ? `"${arg}" নামে অ্যাকাউন্ট পাওয়া যায়নি। আগে সেটি তৈরি করুন।` : `Account "${arg}" not found. Create it first.`;
        case 'needTo': return bn ? 'ট্রান্সফারের জন্য কোন অ্যাকাউন্টে যাবে বলুন।' : 'Which account should the transfer go to?';
        case 'badTo': return bn ? 'ট্রান্সফারের গন্তব্য অ্যাকাউন্ট ঠিক নেই।' : 'The destination account is invalid.';
        case 'noTransferEdit': return bn ? 'ট্রান্সফারের ক্যাটাগরি/ধরন বদলানো যায় না।' : "Can't change category/type of a transfer.";
        case 'catNotFound': return bn ? `"${arg}" ক্যাটাগরি পাওয়া যায়নি।` : `Category "${arg}" not found.`;
        case 'nothing': return bn ? 'কী পরিবর্তন করতে চান বুঝতে পারিনি।' : 'I could not tell what to change.';
        case 'dup': return bn ? 'এই নামে আগে থেকেই আছে।' : 'That name already exists.';
        default: return this.fail;
      }
    },
  };
}
