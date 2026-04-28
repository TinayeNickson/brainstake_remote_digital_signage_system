'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Location } from '@/lib/types';

export default function LocationsClient({ initial }: { initial: Location[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    max_slots_per_day: '48',
    active: true,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const res = await fetch('/api/admin/locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        description: form.description || null,
        max_slots_per_day: Number(form.max_slots_per_day),
        active: form.active,
      }),
    });
    setBusy(false);
    if (!res.ok) { setErr((await res.json()).error ?? 'Failed'); return; }
    setForm({ name: '', description: '', max_slots_per_day: '48', active: true });
    router.refresh();
  }

  async function toggle(loc: Location) {
    await fetch('/api/admin/locations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: loc.id, active: !loc.active }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-7">
      <div className="page-header">
        <div>
          <span className="section-label">Inventory &middot; Places</span>
          <h1 className="display text-4xl text-ink-900">Locations</h1>
          <p className="mt-1 text-sm text-ink-900/50 max-w-lg">
            Each location carries its own pricing and daily slot cap. Inactive locations are hidden from customers.
          </p>
        </div>
        <span className="badge badge-green shrink-0">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          {initial.filter(l => l.active).length} active
        </span>
      </div>

      <form onSubmit={submit} className="paper p-6 grid grid-cols-12 gap-4">
        <div className="col-span-12">
          <p className="text-[11px] font-bold uppercase tracking-widest text-ink-900/40 mb-1">Add new location</p>
        </div>
        <div className="col-span-12 md:col-span-6">
          <label className="label">Name</label>
          <input required className="input" value={form.name}
                 onChange={e => setForm({ ...form, name: e.target.value })} placeholder="CBD — First Street" />
        </div>
        <div className="col-span-12 md:col-span-6">
          <label className="label">Description</label>
          <input className="input" value={form.description}
                 onChange={e => setForm({ ...form, description: e.target.value })} placeholder="High foot traffic" />
        </div>
        <div className="col-span-6 md:col-span-3">
          <label className="label">Max slots / day</label>
          <input required type="number" min="1" className="input" value={form.max_slots_per_day}
                 onChange={e => setForm({ ...form, max_slots_per_day: e.target.value })} />
        </div>
        <div className="col-span-6 md:col-span-3 flex items-end">
          <button disabled={busy} className="btn btn-primary h-11 w-full">
            {busy ? 'Saving…' : 'Add location'}
          </button>
        </div>
        {err && <div className="col-span-12 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{err}</div>}
      </form>

      <div className="paper overflow-hidden">
        <div className="data-header grid-cols-12 grid">
          <div className="col-span-6">Name</div>
          <div className="col-span-3">Slots / day</div>
          <div className="col-span-3 text-right">Status</div>
        </div>
        <div className="divide-y divide-ink-100">
          {initial.length === 0 && (
            <div className="px-5 py-10 text-center text-ink-900/50 text-sm">No locations yet. Add one above.</div>
          )}
          {initial.map(l => (
            <div key={l.id} className="grid grid-cols-12 gap-4 px-5 py-4 items-center row-hover transition-colors">
              <div className="col-span-6">
                <p className="font-semibold text-[13.5px] text-ink-900">{l.name}</p>
                {l.description && <p className="mono text-[11px] text-ink-900/50 mt-0.5">{l.description}</p>}
              </div>
              <div className="col-span-3 mono text-sm text-ink-900/70">{l.max_slots_per_day}</div>
              <div className="col-span-3 flex justify-end">
                <button onClick={() => toggle(l)}
                        className={`btn h-8 text-xs px-4 ${
                          l.active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'btn-ghost text-ink-900/50'
                        }`}>
                  {l.active ? 'Active' : 'Inactive'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
