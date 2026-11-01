'use client';
import { useEffect, useRef, useState } from 'react';
import { Plus, Send } from 'lucide-react';
import { ChatCard } from '@/components/Cards';
import { useMeta } from '@/components/Meta';
import { TxForm } from '@/components/TxForm';
import { api } from '@/lib/client';
import type { Card, Lang } from '@/lib/types';

type Msg = { id: string; role: 'user' | 'assistant'; content: string; payload?: { cards?: Card[]; pending?: { id: string; summary: string } | null; lang?: Lang } | null };
const EXAMPLES = ['আজ রিকশা ভাড়া ৫০ টাকা বিকাশ থেকে', 'bazar e 450 khoroch korlam', 'Salary 25000 received in Bank', 'এই মাসে কত খরচ হয়েছে?', 'last entry ta 300 koro', 'cash theke bKash e 1000 pathalam'];

export default function Chat() {
  const meta = useMeta();
  const [msgs, setMsgs] = useState<Msg[]>([]); const [text, setText] = useState('');
  const [busy, setBusy] = useState(false); const [form, setForm] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { api('/api/chat').then((d) => setMsgs(d.messages)).catch(() => {}); }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy]);

  const addAssistant = (r: any) => setMsgs((m) => [...m, { id: 'a' + Date.now(), role: 'assistant', content: r.content, payload: { cards: r.cards, pending: r.pending, lang: r.lang } }]);
  async function send(t: string) {
    t = t.trim(); if (!t || busy) return;
    setText(''); setBusy(true);
    setMsgs((m) => [...m, { id: 'u' + Date.now(), role: 'user', content: t }]);
    try { addAssistant(await api('/api/chat', { method: 'POST', body: JSON.stringify({ text: t }) })); meta.reload(); }
    catch (e: any) { addAssistant({ content: '⚠️ ' + e.message, lang: 'en' }); }
    finally { setBusy(false); }
  }
  async function decide(msgId: string, id: string, approve: boolean) {
    setBusy(true);
    try {
      const r = await api('/api/chat/confirm', { method: 'POST', body: JSON.stringify({ id, approve }) });
      setMsgs((m) => m.map((x) => (x.id === msgId ? { ...x, payload: { ...x.payload, pending: null } } : x)));
      addAssistant(r); meta.reload();
    } catch (e: any) { addAssistant({ content: '⚠️ ' + e.message, lang: 'en' }); }
    finally { setBusy(false); }
  }
  return (
    <div className="flex h-[calc(100dvh-6.5rem)] flex-col md:h-[calc(100dvh-3rem)]">
      <div className="flex-1 space-y-3 overflow-y-auto pb-2">
        {msgs.length === 0 && (
          <div className="mt-8 text-center"><h1 className="text-lg font-semibold">কী খরচ করলেন? / What did you spend?</h1>
            <p className="mt-1 text-sm text-slate-500">Type in Bangla, English or Banglish.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">{EXAMPLES.map((e) => <button key={e} className="btn-ghost text-xs" onClick={() => send(e)}>{e}</button>)}</div></div>)}
        {msgs.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${m.role === 'user' ? 'bg-emerald-600 text-white' : 'card !p-3'}`}>
              {m.content}
              {m.payload?.cards?.map((c, i) => <ChatCard key={i} card={c} lang={m.payload?.lang ?? 'en'} />)}
              {m.payload?.pending && (
                <div className="mt-3 flex gap-2">
                  <button className="btn-danger" disabled={busy} onClick={() => decide(m.id, m.payload!.pending!.id, true)}>{m.payload.lang === 'bn' ? 'নিশ্চিত করুন' : 'Confirm'}</button>
                  <button className="btn-ghost" disabled={busy} onClick={() => decide(m.id, m.payload!.pending!.id, false)}>{m.payload.lang === 'bn' ? 'বাতিল' : 'Cancel'}</button>
                </div>)}
            </div>
          </div>))}
        {busy && <div className="text-sm text-slate-500">…</div>}
        <div ref={end} />
      </div>
      <form className="flex items-end gap-2 pt-2" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <button type="button" className="btn-ghost !px-3" onClick={() => setForm(true)} aria-label="Add manually"><Plus size={18} /></button>
        <textarea className="input max-h-32 min-h-[2.5rem] resize-none" rows={1} maxLength={500} value={text} placeholder="আজ চা ২০ টাকা…" onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(text); } }} />
        <button className="btn !px-3" disabled={busy || !text.trim()} aria-label="Send"><Send size={18} /></button>
      </form>
      {form && <TxForm onClose={() => setForm(false)} onSaved={() => { meta.reload(); addAssistant({ content: '✅ Saved.', lang: 'en' }); }} />}
    </div>
  );
}
