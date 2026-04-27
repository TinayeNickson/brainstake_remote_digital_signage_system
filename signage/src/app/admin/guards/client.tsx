'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SecurityGuard } from '@/lib/types';

interface Props {
  initial: SecurityGuard[];
  deviceByGuard: Record<string, { id: string; code: string; name: string }>;
}

export default function GuardsClient({ initial, deviceByGuard }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', id_number: '' });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const res = await fetch('/api/admin/guards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        phone: form.phone,
        id_number: form.id_number || null,
      }),
    });
    setBusy(false);
    if (!res.ok) { setErr((await res.json()).error ?? 'Failed'); return; }
    setForm({ name: '', phone: '', id_number: '' });
    router.refresh();
  }

  async function toggle(g: SecurityGuard) {
    await fetch('/api/admin/guards', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: g.id, active: !g.active }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-7">
      <div className="page-header">
        <div>
          <span className="section-label">Field &middot; Personnel</span>
          <h1 className="display text-4xl text-ink-900">Security Guards</h1>
          <p className="mt-1 text-sm text-ink-900/50 max-w-lg">
            Each screen is monitored by one guard. Assign guards to screens under <span className="font-semibold text-ink-900">Devices</span>.
          </p>
        </div>
        <span className="badge badge-green shrink-0">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          {initial.filter(g => g.active).length} on duty
        </span>
      </div>

      <form onSubmit={submit} className="paper p-6 grid grid-cols-12 gap-4">
        <div className="col-span-12">
          <p className="text-[11px] font-bold uppercase tracking-widest text-ink-900/40 mb-1">Register new guard</p>
        </div>
        <div className="col-span-12 md:col-span-4">
          <label className="label">Full name</label>
          <input required className="input" value={form.name}
                 onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Tendai Moyo" />
        </div>
        <div className="col-span-12 md:col-span-3">
          <label className="label">Phone</label>
          <input required className="input" value={form.phone}
                 onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+263 77…" />
        </div>
        <div className="col-span-12 md:col-span-3">
          <label className="label">National ID</label>
          <input className="input" value={form.id_number}
                 onChange={e => setForm({ ...form, id_number: e.target.value })} placeholder="optional" />
        </div>
        <div className="col-span-12 md:col-span-2 flex items-end">
          <button disabled={busy} className="btn btn-primary h-11 w-full">
            {busy ? 'Saving…' : 'Add guard'}
          </button>
        </div>
        {err && <div className="col-span-12 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{err}</div>}
      </form>

      <div className="paper overflow-hidden">
        <div className="data-header grid-cols-12 grid">
          <div className="col-span-3">Name</div>
          <div className="col-span-3">Phone</div>
          <div className="col-span-2">National ID</div>
          <div className="col-span-2">Assigned screen</div>
          <div className="col-span-2 text-right">Status</div>
        </div>
        <div className="divide-y divide-ink-100">
          {initial.length === 0 && (
            <div className="px-5 py-10 text-center text-ink-900/50 text-sm">No guards registered yet.</div>
          )}
          {initial.map(g => {
            const device = deviceByGuard[g.id];
            return (
              <div key={g.id} className="grid grid-cols-12 gap-4 px-5 py-4 items-center row-hover transition-colors">
                <div className="col-span-3">
                  <p className="font-semibold text-[13.5px] text-ink-900">{g.name}</p>
                </div>
                <div className="col-span-3 mono text-[12.5px] text-ink-900/70">{g.phone}</div>
                <div className="col-span-2 mono text-[12px] text-ink-900/50">{g.id_number ?? '—'}</div>
                <div className="col-span-2">
                  {device ? (
                    <div>
                      <p className="text-[13px] font-medium text-ink-900">{device.name}</p>
                      <p className="mono text-[11px] text-ink-900/40">{device.code}</p>
                    </div>
                  ) : (
                    <span className="badge badge-amber">Unassigned</span>
                  )}
                </div>
                <div className="col-span-2 flex justify-end">
                  <button onClick={() => toggle(g)}
                          className={`btn h-8 text-xs px-4 ${
                            g.active
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'btn-ghost text-ink-900/50'
                          }`}>
                    {g.active ? 'On duty' : 'Inactive'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
