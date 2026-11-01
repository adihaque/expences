import { z } from 'zod';
import { route } from '@/lib/server';
import { must } from '@/lib/ops';
import { runChat } from '@/lib/chat';
export const dynamic = 'force-dynamic';
export const maxDuration = 30; // Keep the serverless limit aligned with the Gemini request timeout.
export const GET = () => route(async ({ db }) => {
  const rows = must(await db.from('chat_messages').select('id,role,content,payload,created_at').order('created_at', { ascending: false }).limit(50)).reverse();
  const ids = rows.map((r: any) => r.payload?.pending?.id).filter(Boolean);
  const live = new Set<string>();
  if (ids.length) must(await db.from('pending_actions').select('id').in('id', ids)).forEach((p: any) => live.add(p.id));
  // buttons only remain for actions that are still waiting for confirmation
  rows.forEach((r: any) => { if (r.payload?.pending && !live.has(r.payload.pending.id)) r.payload.pending = null; });
  return { messages: rows };
});
export const POST = (req: Request) => route(async ({ db }) => runChat(db, z.object({ text: z.string().trim().min(1).max(500) }).parse(await req.json()).text));
