'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmDialog from '@/components/ConfirmDialog';

type DisplayMode = 'fade' | 'slide' | 'none' | 'zoom';

interface DeviceRow {
  id: string;
  code: string;
  name: string;
  location_id: string;
  guard_id: string;
  active: boolean;
  last_seen_at: string | null;
  max_slots_per_day: number;
  display_mode: DisplayMode;
  start_time: string;
  end_time: string;
  api_token: string;
  pairing_code: string | null;
  device_type: 'web' | 'android' | null;
  paired_at: string | null;
  location: { name: string } | null;
  guard: { name: string; phone: string } | null;
}

interface Props {
  initial: DeviceRow[];
  locations: { id: string; name: string }[];
  availableGuards: { id: string; name: string; phone: string }[];
}

const DISPLAY_MODE_LABELS: Record<DisplayMode, string> = {
  fade:  'Fade',
  slide: 'Slide',
  none:  'Instant',
  zoom:  'Zoom',
};

export default function DevicesClient({ initial, locations, availableGuards }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: '',
    name: '',
    location_id: locations[0]?.id ?? '',
    guard_id: availableGuards[0]?.id ?? '',
    max_slots_per_day: 100,
    display_mode: 'fade' as DisplayMode,
    start_time: '08:00',
    end_time: '22:00',
  });

  // Inline settings editing state per device
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [editSlots,  setEditSlots]  = useState(100);
  const [editMode,   setEditMode]   = useState<DisplayMode>('fade');
  const [editStart,  setEditStart]  = useState('08:00');
  const [editEnd,    setEditEnd]    = useState('22:00');
  const [editBusy,   setEditBusy]   = useState(false);

  // Token state: deviceId -> current token (allows optimistic regen without full refresh)
  const [tokenMap,   setTokenMap]   = useState<Record<string, string>>(() =>
    Object.fromEntries(initial.map(d => [d.id, d.api_token]))
  );
  const [tokenBusy,  setTokenBusy]  = useState<string | null>(null);
  const [copied,     setCopied]     = useState<string | null>(null);

  // Pairing code state: deviceId -> current pairing code
  const [pairMap,    setPairMap]    = useState<Record<string, string>>(() =>
    Object.fromEntries(initial.map(d => [d.id, d.pairing_code ?? '']))
  );
  const [pairBusy,   setPairBusy]   = useState<string | null>(null);
  const [origin,     setOrigin]     = useState('');

  // Slot distribution
  const [slotBusy,   setSlotBusy]   = useState<string | null>(null);
  const [slotMsg,    setSlotMsg]    = useState<Record<string, string>>({});
  const [slotData,   setSlotData]   = useState<Record<string, { slot_index: number; title: string; booking_id: string }[]>>({});

  const [confirm,    setConfirm]    = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  useEffect(() => { setOrigin(window.location.origin); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!form.location_id) return setErr('Create a location first');
    if (!form.guard_id) return setErr('All guards are assigned — add a new guard first');
    setBusy(true);
    const res = await fetch('/api/admin/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (!res.ok) { setErr((await res.json()).error ?? 'Failed'); return; }
    setForm({ code: '', name: '', location_id: locations[0]?.id ?? '', guard_id: '', max_slots_per_day: 100, display_mode: 'fade', start_time: '08:00', end_time: '22:00' });
    router.refresh();
  }

  async function toggle(d: DeviceRow) {
    await fetch('/api/admin/devices', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: d.id, active: !d.active }),
    });
    router.refresh();
  }

  function startEdit(d: DeviceRow) {
    setEditingId(d.id);
    setEditSlots(d.max_slots_per_day ?? 100);
    setEditMode(d.display_mode ?? 'fade');
    setEditStart(d.start_time?.slice(0, 5) ?? '08:00');
    setEditEnd(d.end_time?.slice(0, 5) ?? '22:00');
  }

  async function saveSettings(d: DeviceRow) {
    setEditBusy(true);
    await fetch('/api/admin/devices', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: d.id, max_slots_per_day: editSlots, display_mode: editMode, start_time: editStart, end_time: editEnd }),
    });
    setEditBusy(false);
    setEditingId(null);
    router.refresh();
  }

  async function doRegenToken(d: DeviceRow) {
    setConfirm(null);
    setTokenBusy(d.id);
    const res = await fetch('/api/admin/devices', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: d.id, action: 'regenerate_token' }),
    });
    setTokenBusy(null);
    if (!res.ok) { setErr((await res.json()).error ?? 'Failed'); return; }
    const { api_token } = await res.json();
    setTokenMap(m => ({ ...m, [d.id]: api_token }));
  }

  function regenToken(d: DeviceRow) {
    setConfirm({
      title:   `Regenerate token for "${d.name}"?`,
      message: 'The old player URL will stop working immediately.',
      onConfirm: () => doRegenToken(d),
    });
  }

  async function doRegenPairingCode(d: DeviceRow) {
    setConfirm(null);
    setPairBusy(d.id);
    const res = await fetch('/api/admin/devices', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: d.id, action: 'regenerate_pairing_code' }),
    });
    setPairBusy(null);
    if (!res.ok) { setErr((await res.json()).error ?? 'Failed'); return; }
    const { pairing_code } = await res.json();
    setPairMap(m => ({ ...m, [d.id]: pairing_code }));
  }

  function regenPairingCode(d: DeviceRow) {
    setConfirm({
      title:   `Reset pairing code for "${d.name}"?`,
      message: 'The Android app will need to re-pair with the new code.',
      onConfirm: () => doRegenPairingCode(d),
    });
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  function playerUrl(d: DeviceRow) {
    const token = tokenMap[d.id] ?? d.api_token;
    return `${origin}/player/${d.id}?token=${token}`;
  }

  function feedUrl(d: DeviceRow) {
    const token = tokenMap[d.id] ?? d.api_token;
    return `${origin}/api/device/content`; // use Authorization: Bearer <token>
  }

  function pairingUrl(d: DeviceRow) {
    const code = pairMap[d.id] ?? d.pairing_code ?? '';
    return `${origin}/player?code=${code}`;
  }

  function openPlayer(d: DeviceRow) {
    window.open(playerUrl(d), '_blank');
  }

  async function regenSlots(d: DeviceRow) {
    setSlotBusy(d.id);
    setSlotMsg(m => ({ ...m, [d.id]: '' }));
    try {
      const res = await fetch('/api/admin/slots/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: d.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed');
      setSlotMsg(m => ({ ...m, [d.id]: `${json.slots_assigned} slots assigned for today` }));
      // Fetch the slot data for visual display
      await loadSlots(d);
    } catch (e: any) {
      setSlotMsg(m => ({ ...m, [d.id]: e.message }));
    } finally {
      setSlotBusy(null);
    }
  }

  async function loadSlots(d: DeviceRow) {
    // Read today's slot assignments via the feed API
    const today = new Date().toISOString().slice(0, 10);
    try {
      const res = await fetch(`/api/admin/slots/view?device_id=${d.id}&date=${today}`);
      if (!res.ok) return;
      const json = await res.json();
      setSlotData(m => ({ ...m, [d.id]: json.slots ?? [] }));
    } catch { /* silent */ }
  }

  return (
    <div className="space-y-7">
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirm="Confirm"
          danger
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
      <div className="page-header">
        <div>
          <span className="section-label">Inventory &middot; Screens</span>
          <h1 className="display text-4xl text-ink-900">Devices</h1>
          <p className="mt-1 text-sm text-ink-900/50 max-w-lg">
            Register physical screens, set slot capacity, transition style, and operating hours per device.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="badge badge-green">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
            {initial.filter(d => d.active).length} active
          </span>
          <span className="badge badge-gray">{initial.length} total</span>
        </div>
      </div>

      <form onSubmit={submit} className="paper p-6 grid grid-cols-12 gap-4">
        <div className="col-span-12">
          <p className="text-[11px] font-bold uppercase tracking-widest text-ink-900/40 mb-1">Register new device</p>
        </div>
        <div className="col-span-6 md:col-span-2">
          <label className="label">Code</label>
          <input required className="input mono uppercase" value={form.code}
                 onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="CBD-01" />
        </div>
        <div className="col-span-6 md:col-span-2">
          <label className="label">Name</label>
          <input required className="input" value={form.name}
                 onChange={e => setForm({ ...form, name: e.target.value })} placeholder="First Street North" />
        </div>
        <div className="col-span-6 md:col-span-2">
          <label className="label">Location</label>
          <select required className="select" value={form.location_id}
                  onChange={e => setForm({ ...form, location_id: e.target.value })}>
            {locations.length === 0 && <option value="">No locations yet</option>}
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div className="col-span-6 md:col-span-2">
          <label className="label">Guard</label>
          <select required className="select" value={form.guard_id}
                  onChange={e => setForm({ ...form, guard_id: e.target.value })}>
            {availableGuards.length === 0 && <option value="">None available</option>}
            {availableGuards.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div className="col-span-4 md:col-span-1">
          <label className="label">Max Slots/Day</label>
          <input type="number" min={1} max={9999} required className="input"
                 value={form.max_slots_per_day}
                 onChange={e => setForm({ ...form, max_slots_per_day: Number(e.target.value) })} />
        </div>
        <div className="col-span-4 md:col-span-2">
          <label className="label">Transition</label>
          <select className="select" value={form.display_mode}
                  onChange={e => setForm({ ...form, display_mode: e.target.value as DisplayMode })}>
            {(Object.keys(DISPLAY_MODE_LABELS) as DisplayMode[]).map(m => (
              <option key={m} value={m}>{DISPLAY_MODE_LABELS[m]}</option>
            ))}
          </select>
        </div>
        <div className="col-span-4 md:col-span-1">
          <label className="label">Opens</label>
          <input type="time" required className="input" value={form.start_time}
                 onChange={e => setForm({ ...form, start_time: e.target.value })} />
        </div>
        <div className="col-span-4 md:col-span-1">
          <label className="label">Closes</label>
          <input type="time" required className="input" value={form.end_time}
                 onChange={e => setForm({ ...form, end_time: e.target.value })} />
        </div>
        <div className="col-span-4 md:col-span-1 flex items-end">
          <button disabled={busy} className="btn btn-primary h-11 w-full">
            {busy ? 'Saving…' : 'Register'}
          </button>
        </div>
        {err && <div className="col-span-12 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">{err}</div>}
      </form>

      <div className="paper overflow-hidden">
        <div className="data-header grid-cols-12 grid">
          <div className="col-span-1">Code</div>
          <div className="col-span-2">Name &middot; Location</div>
          <div className="col-span-2">Guard</div>
          <div className="col-span-2">Slots &middot; Hours</div>
          <div className="col-span-2">Last heartbeat</div>
          <div className="col-span-3 text-right">Actions</div>
        </div>

        <div className="divide-y divide-ink-100">
        {initial.length === 0 && (
          <div className="px-5 py-10 text-center text-ink-900/50 text-sm">No devices registered yet.</div>
        )}

        {initial.map(d => (
          <div key={d.id} className="border-b border-ink-100 last:border-0">
            <div className="grid grid-cols-12 gap-4 px-5 py-4 items-center row-hover transition-colors">
              <div className="col-span-1">
                <span className="mono text-[12px] font-semibold text-ink-900 bg-ink-100 px-1.5 py-0.5 rounded">{d.code}</span>
                <div className="flex items-center gap-1 mt-1">
                  {(d.device_type === 'android') ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                      Android
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-ink-50 text-ink-900/50 border border-ink-100">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
                      Web
                    </span>
                  )}
                </div>
              </div>
              <div className="col-span-2">
                <p className="font-semibold text-[13px] text-ink-900">{d.name}</p>
                <p className="mono text-[11px] text-ink-900/50 mt-0.5">{d.location?.name ?? '—'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[13px] text-ink-900">{d.guard?.name ?? '—'}</p>
                <p className="mono text-[11px] text-ink-900/50">{d.guard?.phone ?? ''}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[13px] font-medium text-ink-900">{d.max_slots_per_day ?? 100} slots/day</p>
                <p className="mono text-[11px] text-ink-900/50 mt-0.5">
                  {DISPLAY_MODE_LABELS[d.display_mode] ?? 'Fade'} &middot; {d.start_time?.slice(0,5) ?? '08:00'}–{d.end_time?.slice(0,5) ?? '22:00'}
                </p>
              </div>
              <div className="col-span-2">
                {d.last_seen_at ? (
                  <>
                    <p className="mono text-[11px] text-ink-900/70">{new Date(d.last_seen_at).toLocaleDateString()}</p>
                    <p className="mono text-[10px] text-ink-900/40">{new Date(d.last_seen_at).toLocaleTimeString()}</p>
                  </>
                ) : (
                  <span className="mono text-[11px] text-ink-900/35">Never seen</span>
                )}
              </div>
              <div className="col-span-3 flex justify-end gap-2 flex-wrap">
                <button onClick={() => openPlayer(d)}
                        className="btn btn-ghost h-8 text-xs gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  Preview
                </button>
                <button onClick={() => editingId === d.id ? setEditingId(null) : startEdit(d)}
                        className={`btn h-8 text-xs gap-1.5 ${
                          editingId === d.id ? 'btn-primary' : 'btn-ghost'
                        }`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  Settings
                </button>
                <button onClick={() => toggle(d)}
                        className={`btn h-8 text-xs px-3 ${
                          d.active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'btn-ghost text-ink-900/50'
                        }`}>
                  {d.active ? 'Online' : 'Offline'}
                </button>
              </div>
            </div>

            {/* Inline settings panel */}
            {editingId === d.id && (
              <div className="mx-5 mb-5 bg-[#f8f9fb] border border-ink-200 rounded-xl p-5 grid grid-cols-12 gap-4 items-end">
                <div className="col-span-12">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-ink-900/40 mb-1">
                    Configuration &mdash; {d.name}
                  </p>
                </div>
                <div className="col-span-6 md:col-span-3">
                  <label className="label">Max Slots per Day</label>
                  <input type="number" min={1} max={9999} className="input"
                         value={editSlots} onChange={e => setEditSlots(Number(e.target.value))} />
                  <p className="text-[11px] text-ink-900/50 mt-1">
                    How many ad slots this screen can display daily
                  </p>
                </div>
                <div className="col-span-6 md:col-span-3">
                  <label className="label">Display Transition</label>
                  <select className="select" value={editMode}
                          onChange={e => setEditMode(e.target.value as DisplayMode)}>
                    {(Object.keys(DISPLAY_MODE_LABELS) as DisplayMode[]).map(m => (
                      <option key={m} value={m}>{DISPLAY_MODE_LABELS[m]}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-ink-900/50 mt-1">
                    Animation when switching between ads
                  </p>
                </div>
                <div className="col-span-6 md:col-span-2">
                  <label className="label">Opens at</label>
                  <input type="time" className="input" value={editStart}
                         onChange={e => setEditStart(e.target.value)} />
                  <p className="text-[11px] text-ink-900/50 mt-1">Start showing ads</p>
                </div>
                <div className="col-span-6 md:col-span-2">
                  <label className="label">Closes at</label>
                  <input type="time" className="input" value={editEnd}
                         onChange={e => setEditEnd(e.target.value)} />
                  <p className="text-[11px] text-ink-900/50 mt-1">Switch to fallback content</p>
                </div>
                <div className="col-span-12 md:col-span-2 flex gap-2">
                  <button onClick={() => saveSettings(d)} disabled={editBusy}
                          className="btn btn-primary h-9 text-sm">
                    {editBusy ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => setEditingId(null)}
                          className="btn btn-ghost h-9 text-sm">
                    Cancel
                  </button>
                </div>

                {/* Slot Distribution Panel */}
                <div className="col-span-12 mt-2">
                  <div className="border-t border-ink-200 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-widest text-ink-900/40">Slot Distribution — Today</p>
                        <p className="text-[11px] text-ink-900/50 mt-0.5">Shows how ad slots are spread across the day for this device.</p>
                      </div>
                      <button
                        onClick={() => regenSlots(d)}
                        disabled={slotBusy === d.id}
                        className="btn btn-ghost h-8 px-3 text-xs gap-1.5 text-brand border-brand/30 hover:bg-brand/5">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                          <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                        </svg>
                        {slotBusy === d.id ? 'Generating…' : 'Regenerate Slots'}
                      </button>
                    </div>

                    {slotMsg[d.id] && (
                      <p className={`text-[11px] mb-3 font-medium ${
                        slotMsg[d.id].includes('assigned') ? 'text-brand' : 'text-red-600'
                      }`}>{slotMsg[d.id]}</p>
                    )}

                    {/* Visual slot bar */}
                    {slotData[d.id] && slotData[d.id].length > 0 ? (
                      <div className="space-y-2">
                        {/* Group by booking/ad */}
                        {Array.from(new Set(slotData[d.id].map(s => s.booking_id))).map((bid, bi) => {
                          const slots   = slotData[d.id].filter(s => s.booking_id === bid);
                          const title   = slots[0]?.title ?? bid.slice(0, 8);
                          const colors  = ['bg-brand','bg-blue-500','bg-amber-500','bg-purple-500','bg-rose-500'];
                          const color   = colors[bi % colors.length];
                          const max     = d.max_slots_per_day || 60;
                          return (
                            <div key={bid}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] font-medium text-ink-900 truncate max-w-[200px]">{title}</span>
                                <span className="mono text-[10px] text-ink-900/50">{slots.length} slots</span>
                              </div>
                              <div className="relative h-6 bg-ink-100 rounded-lg overflow-hidden">
                                {slots.map(s => (
                                  <div
                                    key={s.slot_index}
                                    title={`Slot ${s.slot_index}`}
                                    className={`absolute top-0 bottom-0 w-[3px] rounded-sm ${color}`}
                                    style={{ left: `${(s.slot_index / max) * 100}%` }}
                                  />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                        <div className="flex justify-between mono text-[9px] text-ink-900/30 mt-1">
                          <span>Slot 0</span>
                          <span>Slot {d.max_slots_per_day}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 bg-ink-50 rounded-lg px-4 py-3">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-ink-900/40">
                          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        <span className="text-[11px] text-ink-900/50">No slot data yet — click Regenerate Slots to compute today&apos;s distribution.</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Connection panel */}
                <div className="col-span-12 mt-2">
                  <div className="border-t border-ink-200 pt-4">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-ink-900/40 mb-3">Screen Connection</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                      {/* Player URL */}
                      <div>
                        <p className="label">Browser Player URL</p>
                        <p className="text-[11px] text-ink-900/50 mb-1.5">Open in any browser on the display device, or load as kiosk URL.</p>
                        <div className="flex items-center gap-2">
                          <input readOnly className="input mono text-[11px] flex-1 bg-ink-50 truncate"
                                 value={origin ? playerUrl(d) : 'Loading…'} />
                          <button
                            onClick={() => copyToClipboard(playerUrl(d), `url-${d.id}`)}
                            className="btn btn-ghost h-9 px-3 shrink-0 text-xs gap-1.5">
                            {copied === `url-${d.id}` ? (
                              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>Copied</>
                            ) : (
                              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy</>
                            )}
                          </button>
                          <a href={origin ? playerUrl(d) : '#'} target="_blank" rel="noopener noreferrer"
                             className="btn btn-ghost h-9 px-3 shrink-0 text-xs gap-1.5">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            Preview
                          </a>
                        </div>
                      </div>

                      {/* Android Pairing Code */}
                      <div>
                        <p className="label">Android Pairing Code</p>
                        <p className="text-[11px] text-ink-900/50 mb-1.5">
                          Enter this code in the Android app to pair it, or use the short URL below.
                          {d.paired_at && <span className="ml-1 text-brand">Paired {new Date(d.paired_at).toLocaleDateString()}</span>}
                        </p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 flex items-center gap-3 bg-ink-50 border border-ink-200 rounded-xl px-4 h-10">
                            <span className="mono text-xl font-bold tracking-[0.25em] text-ink-900">
                              {pairMap[d.id] ?? d.pairing_code ?? '??????'}
                            </span>
                          </div>
                          <button
                            onClick={() => copyToClipboard(pairMap[d.id] ?? d.pairing_code ?? '', `pair-${d.id}`)}
                            className="btn btn-ghost h-10 px-3 shrink-0 text-xs gap-1.5">
                            {copied === `pair-${d.id}` ? (
                              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>Copied</>
                            ) : (
                              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy</>
                            )}
                          </button>
                          <button
                            onClick={() => regenPairingCode(d)}
                            disabled={pairBusy === d.id}
                            className="btn btn-ghost h-10 px-3 shrink-0 text-xs text-red-600 hover:bg-red-50 hover:border-red-200 gap-1.5">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                            {pairBusy === d.id ? 'Resetting…' : 'Reset'}
                          </button>
                        </div>
                        {/* Short pairing URL */}
                        <div className="flex items-center gap-2 mt-2">
                          <input readOnly className="input mono text-[11px] flex-1 bg-ink-50 truncate"
                                 value={origin ? pairingUrl(d) : 'Loading…'} />
                          <button
                            onClick={() => copyToClipboard(pairingUrl(d), `purl-${d.id}`)}
                            className="btn btn-ghost h-9 px-3 shrink-0 text-xs gap-1.5">
                            {copied === `purl-${d.id}` ? (
                              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>Copied</>
                            ) : (
                              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy URL</>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Raw token + regen */}
                      <div className="md:col-span-2">
                        <p className="label">Device API Token</p>
                        <p className="text-[11px] text-ink-900/50 mb-1.5">
                          Used as the <span className="mono">?token=</span> query param or <span className="mono">Authorization: Bearer</span> header.
                          Regenerating invalidates the current URL immediately.
                        </p>
                        <div className="flex items-center gap-2">
                          <input readOnly className="input mono text-[11px] flex-1 bg-ink-50"
                                 value={tokenMap[d.id] ?? d.api_token} />
                          <button
                            onClick={() => copyToClipboard(tokenMap[d.id] ?? d.api_token, `tok-${d.id}`)}
                            className="btn btn-ghost h-9 px-3 shrink-0 text-xs gap-1.5">
                            {copied === `tok-${d.id}` ? (
                              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>Copied</>
                            ) : (
                              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy</>
                            )}
                          </button>
                          <button
                            onClick={() => regenToken(d)}
                            disabled={tokenBusy === d.id}
                            className="btn btn-ghost h-9 px-3 shrink-0 text-xs text-red-600 hover:bg-red-50 hover:border-red-200 gap-1.5">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                            {tokenBusy === d.id ? 'Regenerating…' : 'Regenerate'}
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        </div>
      </div>
    </div>
  );
}
