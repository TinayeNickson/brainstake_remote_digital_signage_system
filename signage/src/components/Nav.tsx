'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';
import BrandMark from './BrandMark';
import type { UserRole } from '@/lib/types';

interface Props { role: UserRole; email: string }

export default function Nav({ role, email }: Props) {
  const router = useRouter();
  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="border-b border-ink-100 bg-white/80 backdrop-blur-md sticky top-0 z-20 shadow-sm">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-6 h-[60px]">
        <BrandMark size="sm" href="/dashboard" />

        <nav className="flex items-center gap-1 text-sm">
          <Link href="/dashboard"
            className="px-3 h-8 flex items-center rounded-md text-ink-900/70 hover:text-brand hover:bg-brand-soft/60 transition-colors font-medium">
            My Ads
          </Link>
          <Link href="/dashboard/receipts"
            className="px-3 h-8 flex items-center rounded-md text-ink-900/70 hover:text-brand hover:bg-brand-soft/60 transition-colors font-medium">
            Receipts
          </Link>
          {(role === 'accountant' || role === 'admin') && (
            <Link href="/accountant"
              className="px-3 h-8 flex items-center rounded-md text-ink-900/70 hover:text-brand hover:bg-brand-soft/60 transition-colors font-medium">
              Payments
            </Link>
          )}
          {role === 'admin' && (
            <Link href="/admin"
              className="px-3 h-8 flex items-center rounded-md text-ink-900/70 hover:text-brand hover:bg-brand-soft/60 transition-colors font-medium">
              Admin
            </Link>
          )}

          <div className="w-px h-5 bg-ink-200 mx-2" />

          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-soft border border-brand/20 text-brand-dark">
            <span className="pulse-dot !w-[5px] !h-[5px]" />
            <span className="mono text-[10px] font-medium uppercase tracking-wider">{role}</span>
          </span>

          <span className="hidden md:block mono text-[11px] text-ink-900/40 ml-2 max-w-[160px] truncate">{email}</span>

          <button className="ml-2 btn btn-ghost h-8 text-xs font-medium" onClick={signOut}>
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}
