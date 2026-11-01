# Gemini latency update

## Changes
- Default Gemini model is now `gemini-3.8-flash`.
- Replaced the legacy `thinkingBudget: 0` and `temperature: 0` settings with the documented Gemini 3 setting `thinkingLevel: 'low'`.
- Raised `maxOutputTokens` to 2048 so thinking tokens are less likely to consume the entire response budget.
- Removed the automatic second request after timeouts / transient API errors. A retry previously doubled the wait and can repeat unnecessary work.
- Added a 22-second Gemini request timeout and useful latency/token/error logs.
- Gemini failures now return proper HTTP error statuses instead of a successful HTTP 200 response with a misleading fallback message.
- User-message persistence runs in parallel with the Gemini request.
- Chat context no longer reads the account-balance view on every message. It loads balances only when a balance query is requested. The metadata endpoint still includes balances for the UI.
- API routes skip the middleware's duplicate `auth.getUser()` call; each API route still authenticates through `lib/server.ts`.

## Local setup
1. Keep your existing `.env.local` secrets. Set `GEMINI_MODEL=gemini-3.8-flash` (or remove the variable to use the same default).
2. Replace the project files with this archive, preserving `.env.local`.
3. Run `npm install`, `npm test`, `npm run typecheck`, and `npm run build`.
4. Start with `npm run dev` and test expense entry, income entry, transfers, queries, edits, and delete confirmation.

No database schema migration is required for these changes.
