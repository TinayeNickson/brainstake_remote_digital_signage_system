'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UserRole } from '@/lib/types';

interface Row {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  created_at: string;
}

const ROLE_META: Record<UserRole, { label: string; tone: string; desc: string }> = {
  customer:   { label: 'Customer',   tone: 'bg-ink-100 text-ink-900',     desc: 'Books and pays for ads.' },
  accountant: { label: 'Accountant', tone: 'bg-amber-100 text-amber-900', desc: 'Verifies payments.' },
  admin:      { label: 'Admin',      tone: 'bg-brand-soft text-brand-dark', desc: 'Full system control.' },
};

export default function UsersClient({
  initial,
  currentUserId,
}: {
  initial: Row[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | UserRole>('all');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const counts = {
    all: initial.length,
    customer:   initial.filter(u => u.role === 'customer').length,
    accountant: initial.filter(u => u.role === 'accountant').length,
    admin:      initial.filter(u => u.role === 'admin').length,
  };

  const rows = initial
    .filter(u => filter === 'all' || u.role === filter)
    .filter(u => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        u.email.toLowerCase().includes(q) ||
        (u.full_name ?? '').toLowerCase().includes(q) ||
        (u.phone ?? '').toLowerCase().includes(q)
      );
    });

  async function setRole(id: string, role: UserRole) {
    setErr(null);
    setBusy(id);
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, role }),
    });
    setBusy(null);
    if (!res.ok) {
      setErr((await res.json()).error ?? 'Failed');
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mono text-[11px] uppercase tracking-[0.2em] text-brand mb-1">Access · roles</p>
        <h1 className="display text-5xl">Users</h1>
        <p className="mt-2 text-sm text-ink-900/60 max-w-xl">
          Every new sign-up lands as a <span className="mono text-ink-900">customer</span>.
          Promote someone to <span className="mono text-ink-900">accountant</span> to let them verify
          payments, or to <span className="mono text-ink-900">admin</span> for full access.
        </p>
      </div>

      {/* Filter chips + search */}
      <div className="paper p-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 flex-wrap">
          {(['all', 'customer', 'accountant', 'admin'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={
                'h-9 px-4 rounded-full border text-xs uppercase tracking-widest transition-colors ' +
                (filter === f
                  ? 'bg-brand-deep text-white border-brand-deep'
                  : 'bg-white border-ink-200 hover:border-ink-900 text-ink-900/80')
              }
            >
              {f === 'all' ? 'All' : ROLE_META[f].label}
              <span className={'ml-2 mono text-[10px] ' + (filter === f ? 'text-white/60' : 'text-ink-900/40')}>
                {counts[f]}
              </span>
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-[240px] ml-auto">
          <input
            className="input"
            placeholder="Search by name, email, or phone…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      </div>

      {err && (
        <div className="paper px-4 py-3 text-sm text-red-800 bg-red-50 border-red-100">{err}</div>
      )}

      {/* Users list */}
      <div className="paper divide-y divide-ink-100">
        <div className="grid grid-cols-12 gap-4 px-5 py-3 mono text-[10px] uppercase tracking-widest text-ink-900/60">
          <div className="col-span-4">User</div>
          <div className="col-span-3">Contact</div>
          <div className="col-span-2">Joined</div>
          <div className="col-span-3 text-right">Role</div>
        </div>

        {rows.length === 0 ? (
          <div className="px-5 py-12 text-center text-ink-900/60 text-sm">
            No users match that filter.
          </div>
        ) : rows.map(u => {
          const isSelf = u.id === currentUserId;
          return (
            <div key={u.id} className="grid grid-cols-12 gap-4 px-5 py-4 items-center">
              <div className="col-span-4">
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-brand-soft text-brand-dark mono text-xs"
                    aria-hidden="true"
                  >
                    {(u.full_name?.[0] ?? u.email[0] ?? '?').toUpperCase()}
                  </span>
                  <div>
                    <div className="font-medium">
                      {u.full_name ?? '—'}
                      {isSelf && (
                        <span className="ml-2 mono text-[10px] uppercase tracking-widest text-brand">
                          you
                        </span>
                      )}
                    </div>
                    <div className="mono text-[11px] text-ink-900/60">{u.email}</div>
                  </div>
                </div>
              </div>

              <div className="col-span-3 mono text-[12px] text-ink-900/60">
                {u.phone ?? '—'}
              </div>

              <div className="col-span-2 mono text-[11px] text-ink-900/60">
                {new Date(u.created_at).toLocaleDateString('en-GB', {
                  day: '2-digit', month: 'short', year: 'numeric',
                })}
              </div>

              <div className="col-span-3 flex justify-end">
                <div
                  role="radiogroup"
                  aria-label={`Set role for ${u.email}`}
                  className="inline-flex rounded-full border border-ink-200 bg-white p-[3px] overflow-hidden"
                >
                  {(['customer', 'accountant', 'admin'] as UserRole[]).map(r => {
                    const active = u.role === r;
                    const disabled = busy === u.id || (isSelf && r !== 'admin');
                    return (
                      <button
                        key={r}
                        disabled={disabled}
                        onClick={() => !active && setRole(u.id, r)}
                        title={ROLE_META[r].desc + (isSelf && r !== 'admin' ? ' — you cannot demote yourself.' : '')}
                        className={
                          'h-7 px-3 rounded-full text-[11px] uppercase tracking-widest transition-all ' +
                          (active
                            ? 'bg-brand text-white shadow-sm'
                            : disabled
                              ? 'text-ink-900/30 cursor-not-allowed'
                              : 'text-ink-900/70 hover:bg-ink-50')
                        }
                      >
                        {ROLE_META[r].label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
