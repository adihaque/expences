# খরচ · AI Expense Tracker

Chat-first personal expense tracker. Bangla / English / Banglish. BDT (৳) and Asia/Dhaka everywhere.
Next.js 15 · TypeScript · Tailwind · Supabase (Postgres + Auth + RLS) · Gemini function calling · Zod · Recharts.

## How the AI part is kept safe
1. You type a message. The server sends Gemini only: a short system prompt, today's date, your account/category *names*, and the last 4 messages (each cut to 200 chars). No transaction data is sent.
2. Gemini must answer with a **function call** (`toolConfig.mode = ANY`). It never returns free-form numbers.
3. Every call is validated with **Zod**. Account/category names are resolved to IDs on the server; unknown accounts are rejected, unknown categories are created.
4. All sums, balances, budget percentages are computed by **Postgres** (`summary()`, `budget_status()`, `account_balances`). Replies are rendered from database results by server templates, not by the model.
5. Gemini uses low thinking effort for faster chat requests, one bounded request (no automatic timeout retries), and reports upstream failures with proper HTTP error statuses. Balance data is loaded only for balance queries. **Deletes (and multi-row edits) are never executed directly.** The server stores a pending action and the UI shows Confirm/Cancel; it expires after 10 minutes.
6. The Gemini key is only read in `lib/gemini.ts` (server). Row Level Security isolates every user's data; the app never uses the service-role key.

## Local setup
1. Supabase → create project → **SQL Editor** → paste and run `supabase/schema.sql` (once, on a fresh project).
2. Supabase → Authentication → URL Configuration: Site URL `http://localhost:3000`, add Redirect URL `http://localhost:3000/auth/callback`.
   (For quick testing you can turn off Authentication → Providers → Email → "Confirm email".)
3. Create `.env.local` (see `.env.example`):
   ```
   GEMINI_API_KEY=...
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # the publishable key
   ```
4. `npm install` → `npm test` → `npm run typecheck` → `npm run dev` → open http://localhost:3000, create an account.

## GitHub
```
git init && git add . && git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```
`.env.local` is git-ignored. Check with `git status` that it is not listed before pushing. Use a **private** repo.

## Vercel
1. vercel.com → Add New → Project → import the GitHub repo (framework auto-detected: Next.js).
2. Environment Variables (Production + Preview): `GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Set `GEMINI_MODEL=gemini-3.8-flash` (or leave it unset to use that default). **Do not add the service-role key.**
3. Deploy. Copy the production URL (e.g. `https://your-app.vercel.app`).
4. Supabase → Authentication → URL Configuration: set **Site URL** to that URL and add `https://your-app.vercel.app/auth/callback` to Redirect URLs.
5. Sign up on the live site. Then, since this is a personal app, turn **off** "Allow new users to sign up" (Authentication → Sign In / Providers) so nobody else can register.

Note: GitHub Pages cannot host this app (it needs a server for the API routes). Use Vercel (free Hobby tier is fine).

## Production-readiness checklist
- [ ] `supabase/schema.sql` ran without errors; tables show RLS enabled in Table Editor
- [ ] `npm test` and `npm run typecheck` pass; `npm run build` succeeds
- [ ] `.env.local` not in Git; keys were not pasted anywhere public (rotate any that were)
- [ ] Env vars set in Vercel; Supabase Site URL + redirect URL match production
- [ ] Signed up, then public sign-ups disabled
- [ ] Add one expense via chat, one manually; confirm both appear after refresh (persisted in Supabase)
- [ ] Delete via chat shows Confirm/Cancel
- [ ] Export JSON + CSV download; JSON restore works
- [ ] Second test user cannot see the first user's data
- [ ] Supabase backups: free tier has none, so use the in-app JSON export regularly (or Pro plan for daily backups)
- [ ] Set a spending cap / quota alert on your Gemini key in Google AI Studio

## Known limits
- Replies are in Bangla if your message contains Bangla script, otherwise English (Banglish input is understood; replies are English).
- Restoring a backup adds data; it does not de-duplicate.
- Rate limit: 10 chat messages/minute/user. Gemini free tier has its own quotas.
