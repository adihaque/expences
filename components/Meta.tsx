'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/client';
import type { Account, Category } from '@/lib/types';

type M = { accounts: Account[]; categories: Category[]; loaded: boolean; reload: () => Promise<void> };
const Ctx = createContext<M>(null as unknown as M);
export function MetaProvider({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<{ accounts: Account[]; categories: Category[] }>({ accounts: [], categories: [] });
  const [loaded, setLoaded] = useState(false);
  const reload = useCallback(async () => { try { setS(await api('/api/meta')); setLoaded(true); } catch { /* ignore */ } }, []);
  useEffect(() => { reload(); }, [reload]);
  return <Ctx.Provider value={{ ...s, loaded, reload }}>{children}</Ctx.Provider>;
}
export const useMeta = () => useContext(Ctx);
