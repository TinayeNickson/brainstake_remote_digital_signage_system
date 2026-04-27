'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

interface BookingRow {
  id: string;
  duration: string;
  slots_per_day: number;
  start_date: string;
  end_date: string;
  location_id: string;
  device_id: string | null;
  ad: { title: string; format: string } | null;
  location: { name: string } | null;
  customer: { full_name: string | null; email: string } | null;
}
interface DeviceRow {
  id: string;
  code: string;
  name: string;
  location_id: string;
  active: boolean;
  location: { name: string } | null;
}

export default function AssignClient({ bookings, devices }: { bookings: BookingRow[]; devices: DeviceRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err,  setErr]  = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(bookings.map(b => [b.id, b.device_id])),
  );
  const devicesByLocation = useMemo(() => {
    const m: Record<string, DeviceRow[]> = {};
    for (const d of devices) {
      if (d.location_id) (m[d.location_id] ||= []).push(d);
      else (m['__none__'] ||= []).push(d);
    }
    return m;
  }, [devices]);

  async function save(b: BookingRow) {
    setBusy(b.id);
    const next = draft[b.id] || null;
    const res = await fetch('/api/admin/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: b.id, device_id: next }),
    });
    setBusy(null);
    if (!res.ok) { setErr((await res.json()).error ?? 'Failed to save'); return; }
    setErr(null);
    router.refresh();
  }

  return (
    <div className="space-y-7">

      {err && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{err}</div>
      )}
      {/* Header */}
      <div className="page-header">
        <div>
          <span className="section-label">Placement</span>
          <h1 className="display text-4xl text-ink-900">Ad → Screen</h1>
          <p className="text-sm text-ink-900/50 mt-1 max-w-lg">
            Assign each approved booking to a physical screen at its location. Screens are pre-filtered by location.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {bookings.filter(b => !b.device_id).length > 0 && (
            <span className="badge badge-amber">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {bookings.filter(b => !b.device_id).length} unassigned
            </span>
          )}
          <span className="badge badge-blue">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
            {bookings.length} total
          </span>
        </div>
      </div>

      {bookings.length === 0 ? (
        <div className="paper p-14 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-brand-soft flex items-center justify-center mb-5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="text-brand">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
          </div>
          <p className="display text-xl text-ink-900/60 mb-1">All ads are placed</p>
          <p className="text-sm text-ink-900/40 max-w-xs">No approved bookings are awaiting screen assignment right now.</p>
        </div>
      ) : (
        <div className="paper overflow-hidden">
          <div className="data-header grid-cols-12 hidden sm:grid">
            <div className="col-span-4">Ad · Customer</div>
            <div className="col-span-2">Location</div>
            <div className="col-span-2">Schedule</div>
            <div className="col-span-3">Assign Screen</div>
            <div className="col-span-1" />
          </div>
          <ul className="divide-y divide-ink-100">
            {bookings.map(b => {
              const options = devicesByLocation[b.location_id] ?? [];
              const dirty = (draft[b.id] ?? null) !== (b.device_id ?? null);
              return (
                <li key={b.id} className="grid grid-cols-12 gap-4 px-5 py-4 items-center row-hover transition-colors">
                  {/* Ad info */}
                  <div className="col-span-12 sm:col-span-4 min-w-0">
                    <p className="font-semibold text-[13.5px] text-ink-900 truncate">{b.ad?.title}</p>
                    <p className="text-[12px] text-ink-900/50 truncate mt-0.5">{b.customer?.full_name ?? b.customer?.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="mono text-[11px] text-ink-900/40">{b.duration}s</span>
                      <span className="text-ink-900/20">·</span>
                      <span className="mono text-[11px] text-ink-900/40">{b.slots_per_day}/day</span>
                    </div>
                  </div>
                  {/* Location */}
                  <div className="col-span-4 sm:col-span-2">
                    <p className="text-[13px] font-medium text-ink-900 truncate">{b.location?.name ?? '—'}</p>
                  </div>
                  {/* Schedule */}
                  <div className="col-span-4 sm:col-span-2">
                    <p className="mono text-[11.5px] text-ink-900/60">{b.start_date}</p>
                    <p className="mono text-[11px] text-ink-900/40">→ {b.end_date}</p>
                  </div>
                  {/* Screen picker */}
                  <div className="col-span-8 sm:col-span-3">
                    {(() => {
                      const same  = devicesByLocation[b.location_id] ?? [];
                      const other = devices.filter(d => d.location_id !== b.location_id);
                      return (
                        <select
                          className="select text-sm"
                          value={draft[b.id] ?? ''}
                          onChange={e => setDraft({ ...draft, [b.id]: e.target.value || null })}
                        >
                          <option value="">— Unassigned —</option>
                          {same.length > 0 && (
                            <optgroup label="Same location">
                              {same.map(d => (
                                <option key={d.id} value={d.id}>
                                  {d.code} · {d.name}{!d.active ? ' (inactive)' : ''}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {other.length > 0 && (
                            <optgroup label="Other locations">
                              {other.map(d => (
                                <option key={d.id} value={d.id}>
                                  {d.code} · {d.name} [{d.location?.name ?? 'no location'}]{!d.active ? ' (inactive)' : ''}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {same.length === 0 && other.length === 0 && (
                            <option disabled>No devices found — add one in Devices</option>
                          )}
                        </select>
                      );
                    })()}
                  </div>
                  {/* Save */}
                  <div className="col-span-4 sm:col-span-1 flex justify-end">
                    <button
                      onClick={() => save(b)}
                      disabled={!dirty || busy === b.id}
                      className="btn btn-primary h-9 text-xs px-4"
                    >
                      {busy === b.id ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
