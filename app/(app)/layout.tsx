'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, List, MessageCircle, PiggyBank, Settings } from 'lucide-react';
import { MetaProvider } from '@/components/Meta';

const NAV = [
  { href: '/', label: 'Chat', Icon: MessageCircle }, { href: '/transactions', label: 'History', Icon: List },
  { href: '/analytics', label: 'Analytics', Icon: BarChart3 }, { href: '/budgets', label: 'Budgets', Icon: PiggyBank },
  { href: '/settings', label: 'Settings', Icon: Settings },
];
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <MetaProvider>
      <aside className="fixed inset-y-0 left-0 hidden w-52 flex-col gap-1 border-r border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 md:flex">
        <div className="mb-3 px-3 pt-2 text-lg font-semibold">৳ খরচ</div>
        {NAV.map(({ href, label, Icon }) => (
          <Link key={href} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${path === href ? 'bg-emerald-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}><Icon size={18} />{label}</Link>
        ))}
      </aside>
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-4 md:ml-52 md:pb-6">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-slate-800 dark:bg-slate-900 md:hidden">
        {NAV.map(({ href, label, Icon }) => (
          <Link key={href} href={href} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${path === href ? 'text-emerald-600' : 'text-slate-500'}`}><Icon size={20} />{label}</Link>
        ))}
      </nav>
    </MetaProvider>
  );
}
