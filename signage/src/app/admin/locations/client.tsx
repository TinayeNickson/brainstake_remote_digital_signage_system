'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Location } from '@/lib/types';

type FormState = {
  name: string;
  description: string;
  price_10s: string;
  price_15s: string;
  price_30s: string;
  price_60s: string;
  max_slots_per_day: string;
};

const BLANK: FormState = {
  name: '',
  description: '',
  price_10s: '0',
  price_15s: '0',
  price_30s: '0',
  price_60s: '0',
  max_slots_per_day: '48',
};

const PRICE_FIELDS = [
  { key: 'price_10s' as const, label: '10s slot ($)' },
  { key: 'price_15s' as const, label: '15s slot ($)' },
  { key: 'price_30s' as const, label: '30s slot ($)' },
  { key: 'price_60s' as const, label: '60s slot ($)' },
] as const;

function locToForm(loc: Location): FormState {
  return {
    name: loc.name,
    description: loc.description ?? '',
    price_10s: String(loc.price_10s ?? 0),
    price_15s: String(loc.price_15s ?? 0),
    price_30s: String(loc.price_30s ?? 0),
    price_60s: String(loc.price_60s ?? 0),
    max_slots_per_day: String(loc.max_slots_per_day),
  };
}

function formToPayload(form: FormState) {
  return {
    name:               form.name,
    description:        form.description || null,
    price_10s:          Number(form.price_10s),
    price_15s:          Number(form.price_15s),
    price_30s:          Number(form.price_30s),
    price_60s:          Number(form.price_60s),
    max_slots_per_day:  Number(form.max_slots_per_day),
  };
}

function LocationForm({
  title,
  form,
  setF,
  busy,
  err,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  title: string;
  form: FormState;
  setF: (k: keyof FormState, v: string) => void;
  busy: boolean;
  err: string | null;
  onSubmit: (e: React.FormEvent) => void;
  onCancel?: () => void;
  submitLabel: string;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-[11px] font-bold uppercase tracking-widest text-ink-900/40">{title}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Name <span className="text-red-500">*</span></label>
          <input required className="input" value={form.name}
            onChange={e => setF('name', e.target.value)}
            placeholder="CBD — First Street" />
        </div>
        <div>
          <label className="label">Description</label>
          <input className="input" value={form.description}
            onChange={e => setF('description', e.target.value)}
            placeholder="High foot traffic" />
        </div>
      </div>

      <div>
        <label className="label">Price per slot by duration</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-1">
          {PRICE_FIELDS.map(({ key, label }) => (
            <div key={key}>
              <label className="text-[11px] text-ink-900/50 font-medium mb-1 block">{label}</label>
              <input type="number" min="0" step="0.01" className="input"
                value={form[key]}
                onChange={e => setF(key, e.target.value)} />
            </div>
          ))}
        </div>
        <p className="text-xs text-ink-900/40 mt-1.5">Set to 0 to make that slot size free / not offered.</p>
      </div>

      <div className="sm:w-48">
        <label className="label">Max slots / day <span className="text-red-500">*</span></label>
        <input required type="number" min="1" className="input"
          value={form.max_slots_per_day}
          onChange={e => setF('max_slots_per_day', e.target.value)} />
        <p className="text-xs text-ink-900/40 mt-1">Total bookable slots across all customers per day.</p>
      </div>

      {err && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</div>
      )}

      <div className="flex gap-3 pt-1">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn btn-ghost h-10 px-5 font-semibold">
            Cancel
          </button>
        )}
        <button disabled={busy} className="btn btn-primary h-10 px-6 font-semibold">
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

export default function LocationsClient({ initial }: { initial: Location[] }) {
  const router = useRouter();

  /* ── Create ── */
  const [createBusy, setCreateBusy] = useState(false);
  const [createErr,  setCreateErr]  = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<FormState>(BLANK);

  function setCreate(k: keyof FormState, v: string) {
    setCreateForm(f => ({ ...f, [k]: v }));
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateErr(null); setCreateBusy(true);
    const res = await fetch('/api/admin/locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formToPayload(createForm)),
    });
    setCreateBusy(false);
    if (!res.ok) { setCreateErr((await res.json()).error ?? 'Failed'); return; }
    setCreateForm(BLANK);
    router.refresh();
  }

  /* ── Edit ── */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm,  setEditForm]  = useState<FormState>(BLANK);
  const [editBusy,  setEditBusy]  = useState(false);
  const [editErr,   setEditErr]   = useState<string | null>(null);

  function startEdit(loc: Location) {
    setEditingId(loc.id);
    setEditForm(locToForm(loc));
    setEditErr(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditErr(null);
  }

  function setEdit(k: keyof FormState, v: string) {
    setEditForm(f => ({ ...f, [k]: v }));
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setEditErr(null); setEditBusy(true);
    const res = await fetch('/api/admin/locations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingId, ...formToPayload(editForm) }),
    });
    setEditBusy(false);
    if (!res.ok) { setEditErr((await res.json()).error ?? 'Failed'); return; }
    setEditingId(null);
    router.refresh();
  }

  /* ── Toggle active ── */
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
            Each location carries its own pricing per slot duration and a daily slot cap. Inactive locations are hidden from customers.
          </p>
        </div>
        <span className="badge badge-green shrink-0">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          {initial.filter(l => l.active).length} active
        </span>
      </div>

      {/* ── Create form ── */}
      <div className="paper p-6">
        <LocationForm
          title="Add new location"
          form={createForm}
          setF={setCreate}
          busy={createBusy}
          err={createErr}
          onSubmit={submitCreate}
          submitLabel="Add Location"
        />
      </div>

      {/* ── Location list ── */}
      <div className="paper overflow-hidden">
        <div className="data-header" style={{ padding: '0 20px', height: '38px', display: 'flex', alignItems: 'center' }}>
          <span>{initial.length} location{initial.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="divide-y divide-ink-100">
          {initial.length === 0 && (
            <div className="px-5 py-10 text-center text-ink-900/50 text-sm">No locations yet. Add one above.</div>
          )}
          {initial.map(loc => (
            <div key={loc.id}>
              {/* ── Inline edit form ── */}
              {editingId === loc.id ? (
                <div className="px-5 py-5 bg-ink-50/60 border-l-4 border-brand">
                  <LocationForm
                    title={`Editing: ${loc.name}`}
                    form={editForm}
                    setF={setEdit}
                    busy={editBusy}
                    err={editErr}
                    onSubmit={submitEdit}
                    onCancel={cancelEdit}
                    submitLabel="Save Changes"
                  />
                </div>
              ) : (
                /* ── Row view ── */
                <div className="px-5 py-4 flex items-center gap-5 row-hover transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-[13.5px] text-ink-900">{loc.name}</p>
                      {!loc.active && <span className="badge badge-gray">Inactive</span>}
                    </div>
                    {loc.description && (
                      <p className="mono text-[11px] text-ink-900/50 mt-0.5">{loc.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 bg-brand-soft text-brand-dark text-[11px] font-semibold px-2 py-0.5 rounded-md">
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                        {loc.max_slots_per_day} slots/day
                      </span>
                      {PRICE_FIELDS.map(({ key, label }) => {
                        const price = loc[key];
                        return (
                          <span key={key} className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md mono ${
                            price > 0 ? 'bg-ink-100 text-ink-900/70' : 'bg-ink-50 text-ink-900/25'
                          }`}>
                            {label.replace(' ($)', '')}: {price > 0 ? `$${Number(price).toFixed(2)}` : '—'}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={() => startEdit(loc)}
                      className="btn btn-ghost h-8 text-xs px-4">
                      Edit
                    </button>
                    <button type="button" onClick={() => toggle(loc)}
                      className={`btn h-8 text-xs px-4 ${
                        loc.active
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                          : 'btn-ghost text-ink-900/50'
                      }`}>
                      {loc.active ? 'Active' : 'Inactive'}
                    </button>
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
