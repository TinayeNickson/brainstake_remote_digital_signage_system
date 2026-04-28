'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fmtDate } from '@/lib/format';

interface AdRow {
  id: string;
  title: string;
  format: string;
  media_url: string | null;
  duration: string;
}

interface BookingRow {
  id: string;
  duration: string;
  slots_per_day: number;
  start_date: string;
  end_date: string;
  location_id: string;
  device_id: string | null;
  status: 'active' | 'suspended';
  suspended_at: string | null;
  suspend_reason: string | null;
  ad: AdRow | null;
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
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(bookings.map(b => [b.id, b.device_id])),
  );

  // Preview modal state
  const [previewAd, setPreviewAd] = useState<AdRow | null>(null);

  // Suspend modal state
  const [suspendBooking, setSuspendBooking] = useState<BookingRow | null>(null);
  const [suspendReason, setSuspendReason] = useState('');

  // Date edit modal state
  const [editBooking, setEditBooking] = useState<BookingRow | null>(null);
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [dateChangeReason, setDateChangeReason] = useState('');

  const devicesByLocation = useMemo(() => {
    const m: Record<string, DeviceRow[]> = {};
    for (const d of devices) {
      if (d.location_id) (m[d.location_id] ||= []).push(d);
      else (m['__none__'] ||= []).push(d);
    }
    return m;
  }, [devices]);

  const activeBookings = useMemo(() => bookings.filter(b => b.status === 'active'), [bookings]);
  const suspendedBookings = useMemo(() => bookings.filter(b => b.status === 'suspended'), [bookings]);

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

  async function handleSuspend() {
    if (!suspendBooking || !suspendReason.trim()) return;
    setBusy(suspendBooking.id);
    const res = await fetch('/api/admin/bookings/suspend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: suspendBooking.id, reason: suspendReason }),
    });
    setBusy(null);
    if (!res.ok) {
      setErr((await res.json()).error ?? 'Failed to suspend');
      return;
    }
    setSuspendBooking(null);
    setSuspendReason('');
    setErr(null);
    router.refresh();
  }

  async function handleReactivate(bookingId: string) {
    setBusy(bookingId);
    const res = await fetch('/api/admin/bookings/reactivate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_id: bookingId }),
    });
    setBusy(null);
    if (!res.ok) {
      setErr((await res.json()).error ?? 'Failed to reactivate');
      return;
    }
    setErr(null);
    router.refresh();
  }

  async function handleDateUpdate() {
    if (!editBooking || !newStartDate || !newEndDate) return;
    setBusy(editBooking.id);

    const payload = {
      booking_id: editBooking.id,
      start_date: newStartDate,
      end_date: newEndDate,
      reason: dateChangeReason || undefined,
    };
    console.log('Sending date update:', payload);

    const res = await fetch('/api/admin/bookings/dates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const responseData = await res.json().catch(() => ({}));
    console.log('Date update response:', { status: res.status, data: responseData });

    setBusy(null);
    if (!res.ok) {
      setErr(responseData.error ?? 'Failed to update dates');
      return;
    }
    setEditBooking(null);
    setNewStartDate('');
    setNewEndDate('');
    setDateChangeReason('');
    setErr(null);
    router.refresh();
  }

  function openDateEdit(b: BookingRow) {
    setEditBooking(b);
    setNewStartDate(b.start_date);
    setNewEndDate(b.end_date);
    setDateChangeReason('');
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
            Assign, preview, suspend, or reschedule ads. Suspended ads are hidden from screens and customers are notified.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {activeBookings.filter(b => !b.device_id).length > 0 && (
            <span className="badge badge-amber">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {activeBookings.filter(b => !b.device_id).length} unassigned
            </span>
          )}
          {suspendedBookings.length > 0 && (
            <span className="badge badge-red">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              {suspendedBookings.length} suspended
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
          <p className="display text-xl text-ink-900/60 mb-1">No active or suspended ads</p>
          <p className="text-sm text-ink-900/40 max-w-xs">Approved bookings will appear here for screen assignment.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Bookings Section */}
          {activeBookings.length > 0 && (
            <div className="paper overflow-hidden">
              <div className="px-5 py-3 border-b border-ink-100 bg-brand-soft/30">
                <h2 className="font-semibold text-ink-900 flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-brand"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/></svg>
                  Active Ads ({activeBookings.length})
                </h2>
              </div>
              <div className="data-header grid-cols-12 hidden sm:grid px-5 py-2">
                <div className="col-span-3">Ad · Customer</div>
                <div className="col-span-2">Location</div>
                <div className="col-span-2">Schedule</div>
                <div className="col-span-2">Screen</div>
                <div className="col-span-3 text-right">Actions</div>
              </div>
              <ul className="divide-y divide-ink-100">
                {activeBookings.map(b => (
                  <ActiveBookingRow
                    key={b.id}
                    b={b}
                    devices={devices}
                    devicesByLocation={devicesByLocation}
                    draft={draft}
                    setDraft={setDraft}
                    busy={busy}
                    onSave={save}
                    onPreview={() => b.ad && setPreviewAd(b.ad)}
                    onSuspend={() => setSuspendBooking(b)}
                    onEditDates={() => openDateEdit(b)}
                  />
                ))}
              </ul>
            </div>
          )}

          {/* Suspended Bookings Section */}
          {suspendedBookings.length > 0 && (
            <div className="paper overflow-hidden border-red-200">
              <div className="px-5 py-3 border-b border-red-100 bg-red-50">
                <h2 className="font-semibold text-red-800 flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                  Suspended Ads ({suspendedBookings.length})
                </h2>
              </div>
              <div className="data-header grid-cols-12 hidden sm:grid px-5 py-2">
                <div className="col-span-3">Ad · Customer</div>
                <div className="col-span-2">Location</div>
                <div className="col-span-2">Schedule</div>
                <div className="col-span-3">Suspension Reason</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>
              <ul className="divide-y divide-red-100">
                {suspendedBookings.map(b => (
                  <li key={b.id} className="grid grid-cols-12 gap-4 px-5 py-4 items-center bg-red-50/30">
                    {/* Ad info */}
                    <div className="col-span-12 sm:col-span-3 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="badge badge-red shrink-0">Suspended</span>
                        <p className="font-semibold text-[13.5px] text-ink-900 truncate">{b.ad?.title}</p>
                      </div>
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
                    {/* Suspension Reason */}
                    <div className="col-span-8 sm:col-span-3">
                      <p className="text-[12px] text-red-700/80 line-clamp-2" title={b.suspend_reason || ''}>
                        {b.suspend_reason || 'No reason provided'}
                      </p>
                      {b.suspended_at && (
                        <p className="text-[10px] text-ink-900/40 mt-0.5">
                          Suspended {fmtDate(b.suspended_at)}
                        </p>
                      )}
                    </div>
                    {/* Actions */}
                    <div className="col-span-12 sm:col-span-2 flex justify-end gap-2">
                      <button
                        onClick={() => b.ad && setPreviewAd(b.ad)}
                        disabled={!b.ad?.media_url}
                        className="btn btn-ghost h-8 px-3 text-xs"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        Preview
                      </button>
                      <button
                        onClick={() => handleReactivate(b.id)}
                        disabled={busy === b.id}
                        className="btn btn-primary h-8 px-3 text-xs"
                      >
                        {busy === b.id ? 'Reactivating…' : 'Reactivate'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {/* Preview Modal */}
      {previewAd && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-ink-100">
              <div>
                <h3 className="font-semibold text-ink-900">{previewAd.title}</h3>
                <p className="text-sm text-ink-900/50">{previewAd.format} · {previewAd.duration}s</p>
              </div>
              <button onClick={() => setPreviewAd(null)} className="btn btn-ghost h-9 px-3">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="flex-1 bg-ink-900 flex items-center justify-center p-6 overflow-auto">
              {previewAd.format === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewAd.media_url || ''} alt="" className="max-w-full max-h-[60vh] object-contain rounded-lg" />
              ) : (
                <video src={previewAd.media_url || ''} controls className="max-w-full max-h-[60vh] rounded-lg">
                  Your browser does not support the video tag.
                </video>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Suspend Modal */}
      {suspendBooking && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-red-600"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              </div>
              <div>
                <h3 className="font-semibold text-ink-900">Suspend Advert</h3>
                <p className="text-sm text-ink-900/50">{suspendBooking.ad?.title}</p>
              </div>
            </div>
            <p className="text-sm text-ink-900/70">
              Suspending will immediately stop this ad from playing on all screens. The customer will be notified with your reason.
            </p>
            <div>
              <label className="label">Suspension Reason <span className="text-red-500">*</span></label>
              <textarea
                className="input min-h-[100px]"
                placeholder="e.g., Content violates advertising guidelines, inappropriate imagery..."
                value={suspendReason}
                onChange={e => setSuspendReason(e.target.value)}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => { setSuspendBooking(null); setSuspendReason(''); }} className="btn btn-ghost flex-1 h-11">
                Cancel
              </button>
              <button
                onClick={handleSuspend}
                disabled={!suspendReason.trim() || busy === suspendBooking.id}
                className="btn btn-danger flex-1 h-11"
              >
                {busy === suspendBooking.id ? 'Suspending…' : 'Suspend Ad'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dates Modal */}
      {editBooking && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-soft flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-brand"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <div>
                <h3 className="font-semibold text-ink-900">Change Schedule</h3>
                <p className="text-sm text-ink-900/50">{editBooking.ad?.title}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Start Date</label>
                <input
                  type="date"
                  className="input"
                  value={newStartDate}
                  onChange={e => setNewStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="label">End Date</label>
                <input
                  type="date"
                  className="input"
                  value={newEndDate}
                  onChange={e => setNewEndDate(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="label">Reason for Change (optional)</label>
              <textarea
                className="input min-h-[80px]"
                placeholder="e.g., Screen maintenance scheduled, customer request..."
                value={dateChangeReason}
                onChange={e => setDateChangeReason(e.target.value)}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => { setEditBooking(null); }} className="btn btn-ghost flex-1 h-11">
                Cancel
              </button>
              <button
                onClick={handleDateUpdate}
                disabled={!newStartDate || !newEndDate || busy === editBooking.id}
                className="btn btn-primary flex-1 h-11"
              >
                {busy === editBooking.id ? 'Updating…' : 'Update Dates'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-component for active booking rows
function ActiveBookingRow({
  b,
  devices,
  devicesByLocation,
  draft,
  setDraft,
  busy,
  onSave,
  onPreview,
  onSuspend,
  onEditDates,
}: {
  b: BookingRow;
  devices: DeviceRow[];
  devicesByLocation: Record<string, DeviceRow[]>;
  draft: Record<string, string | null>;
  setDraft: (d: Record<string, string | null>) => void;
  busy: string | null;
  onSave: (b: BookingRow) => void;
  onPreview: () => void;
  onSuspend: () => void;
  onEditDates: () => void;
}) {
  const same = devicesByLocation[b.location_id] ?? [];
  const other = devices.filter(d => d.location_id !== b.location_id);
  const dirty = (draft[b.id] ?? null) !== (b.device_id ?? null);

  return (
    <li className="grid grid-cols-12 gap-4 px-5 py-4 items-center row-hover transition-colors">
      {/* Ad info */}
      <div className="col-span-12 sm:col-span-3 min-w-0">
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
        <button onClick={onEditDates} className="text-[10px] text-brand hover:underline mt-1">
          Change dates
        </button>
      </div>
      {/* Screen picker */}
      <div className="col-span-8 sm:col-span-2">
        <select
          className="select text-sm w-full"
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
            <option disabled>No devices found</option>
          )}
        </select>
        {dirty && (
          <button
            onClick={() => onSave(b)}
            disabled={busy === b.id}
            className="btn btn-primary h-7 text-[10px] px-2 mt-2 w-full"
          >
            {busy === b.id ? 'Saving…' : 'Save assignment'}
          </button>
        )}
      </div>
      {/* Actions */}
      <div className="col-span-12 sm:col-span-3 flex justify-end gap-2">
        <button
          onClick={onPreview}
          disabled={!b.ad?.media_url}
          className="btn btn-ghost h-8 px-3 text-xs"
          title="Preview ad content"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          Preview
        </button>
        <button
          onClick={onSuspend}
          className="btn btn-danger h-8 px-3 text-xs"
          title="Suspend this ad"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
          Suspend
        </button>
      </div>
    </li>
  );
}
