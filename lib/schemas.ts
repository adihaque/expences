import { z } from 'zod';
import { PRESETS } from './date';

const round2 = (n: number) => Math.round(n * 100) / 100;
export const amt = z.coerce.number().positive().max(999_999_999).transform(round2);
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => {
  const d = new Date(s + 'T00:00:00Z'); return !isNaN(+d) && d.toISOString().slice(0, 10) === s && d.getUTCFullYear() > 1999 && d.getUTCFullYear() < 2100;
}, 'invalid date');
export const TxType = z.enum(['expense', 'income', 'transfer']);
const name = z.string().trim().min(1).max(60);
const note = z.string().trim().max(200);
export const Range = z.object({ preset: z.enum(PRESETS).optional(), from: isoDate.optional(), to: isoDate.optional() });

/** Gemini sometimes sends null / "" for unused fields. */
export const stripNulls = (v: any): any =>
  Array.isArray(v) ? v.map(stripNulls)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null && x !== '' && x !== undefined).map(([k, x]) => [k, stripNulls(x)]))
  : v;

// ---- AI operations (every Gemini function call is validated against these) ----
export const AddItem = z.object({ type: TxType, amount: amt, account: name.optional(), to_account: name.optional(), category: name.optional(), note: note.optional(), date: isoDate.optional() });
export const AddArgs = z.object({ items: z.array(AddItem).min(1).max(20) });
export const Filter = z.object({
  last: z.boolean().optional(), text: z.string().trim().max(60).optional(), category: name.optional(), account: name.optional(),
  type: TxType.optional(), amount: amt.optional(), min_amount: amt.optional(), max_amount: amt.optional(), range: Range.optional(),
});
export const Changes = z.object({ amount: amt.optional(), account: name.optional(), category: name.optional(), note: note.optional(), date: isoDate.optional(), type: z.enum(['expense', 'income']).optional() });
export const UpdateArgs = z.object({ target: Filter, changes: Changes });
export const DeleteArgs = z.object({ target: Filter });
export const QueryArgs = z.object({ kind: z.enum(['list', 'summary', 'balance', 'budget']), range: Range.optional(), filter: Filter.optional() });
export const BudgetArgs = z.object({ category: name.optional(), amount: amt });
export const AccountArgs = z.object({ name, opening_balance: z.coerce.number().min(-1e9).max(1e9).optional() });
export type Filter = z.infer<typeof Filter>;

// ---- Manual REST bodies ----
export const TxBase = z.object({
  type: TxType, amount: amt, account_id: z.string().uuid(), to_account_id: z.string().uuid().nullish(),
  category_id: z.string().uuid().nullish(), note: note.nullish(), occurred_on: isoDate,
});
export const TxBody = TxBase.superRefine((v, ctx) => {
  if (v.type === 'transfer' && (!v.to_account_id || v.to_account_id === v.account_id)) ctx.addIssue({ code: 'custom', message: 'Transfer needs a different destination account' });
  if (v.type !== 'transfer' && v.to_account_id) ctx.addIssue({ code: 'custom', message: 'Only transfers have a destination account' });
});
export const TxPatchBody = TxBase.partial();
export const AccountBody = z.object({ name, kind: z.enum(['cash', 'bkash', 'nagad', 'bank', 'custom']).default('custom'), opening_balance: z.coerce.number().min(-1e9).max(1e9).default(0) });
export const AccountPatch = z.object({ name: name.optional(), opening_balance: z.coerce.number().min(-1e9).max(1e9).optional(), archived: z.boolean().optional() });
export const CategoryBody = z.object({ name, name_bn: z.string().trim().max(60).nullish(), type: z.enum(['expense', 'income']) });
export const BudgetBody = z.object({ category_id: z.string().uuid().nullable(), amount: amt });
