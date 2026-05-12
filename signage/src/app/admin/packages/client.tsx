'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Package } from '@/lib/types';

type FormState = {
  name: string;
  description: string;
  base_slots_per_day: string;
  allows_10s: boolean;
  allows_15s: boolean;
  allows_30s: boolean;
  allows_60s: boolean;
  sort_order: string;
};

const BLANK: FormState = {
  name: '',
  description: '',
  base_slots_per_day: '2',
  allows_10s: false,
  allows_15s: true,
  allows_30s: true,
  allows_60s: false,
  sort_order: '0',
};

const DURATION_OPTIONS = [
  { key: 'allows_10s' as const, label: '10s' },
  { key: 'allows_15s' as const, label: '15s' },
  { key: 'allows_30s' as const, label: '30s' },
  { key: 'allows_60s' as const, label: '60s' },
] as const;

function pkgToForm(pkg: Package): FormState {
  return {
    name: pkg.name,
    description: pkg.description ?? '',
    base_slots_per_day: String(pkg.base_slots_per_day),
    allows_10s: pkg.allows_10s,
    allows_15s: pkg.allows_15s,
    allows_30s: pkg.allows_30s,
    allows_60s: pkg.allows_60s,
    sort_order: String(pkg.sort_order),
  };
}

function PackageForm({
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
  setF: (k: string, v: string | boolean) => void;
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
          <label className="label">Package name <span className="text-red-500">*</span></label>
          <input className="input" required value={form.name}
            onChange={e => setF('name', e.target.value)}
            placeholder="e.g. Pro Premium" />
        </div>
        <div>
          <label className="label">Sort order</label>
          <input className="input" type="number" min="0" value={form.sort_order}
            onChange={e => setF('sort_order', e.target.value)} />
        </div>
      </div>

      <div>
        <label className="label">Description</label>
        <input className="input" value={form.description}
          onChange={e => setF('description', e.target.value)}
          placeholder="One-line selling point" />
      </div>

      <div>
        <label className="label">Base slots per day <span className="text-red-500">*</span></label>
        <input className="input" type="number" min="1" required value={form.base_slots_per_day}
          onChange={e => setF('base_slots_per_day', e.target.value)} />
        <p className="text-xs text-ink-900/40 mt-1">Default daily slots for this package. Customers may book more; price adjusts per slot.</p>
      </div>

      <div>
        <label className="label">Allowed slot durations</label>
        <div className="flex flex-wrap gap-3 mt-1">
          {DURATION_OPTIONS.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" className="w-4 h-4 accent-brand"
                checked={form[key]}
                onChange={e => setF(key, e.target.checked)} />
              <span className="text-sm text-ink-900">{label}</span>
            </label>
          ))}
        </div>
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

export default function PackagesClient({ initial }: { initial: Package[] }) {
  const router = useRouter();

  /* ── Create form ── */
  const [createBusy, setCreateBusy] = useState(false);
  const [createErr,  setCreateErr]  = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<FormState>(BLANK);

  function setCreate(k: string, v: string | boolean) {
    setCreateForm(f => ({ ...f, [k]: v }));
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateErr(null); setCreateBusy(true);
    const res = await fetch('/api/admin/packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:               createForm.name,
        description:        createForm.description || null,
        base_slots_per_day: Number(createForm.base_slots_per_day),
        allows_10s:         createForm.allows_10s,
        allows_15s:         createForm.allows_15s,
        allows_30s:         createForm.allows_30s,
        allows_60s:         createForm.allows_60s,
        sort_order:         Number(createForm.sort_order),
      }),
    });
    setCreateBusy(false);
    if (!res.ok) { setCreateErr((await res.json()).error ?? 'Failed'); return; }
    setCreateForm(BLANK);
    router.refresh();
  }

  /* ── Edit state ── */
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [editForm,    setEditForm]    = useState<FormState>(BLANK);
  const [editBusy,    setEditBusy]    = useState(false);
  const [editErr,     setEditErr]     = useState<string | null>(null);

  function startEdit(pkg: Package) {
    setEditingId(pkg.id);
    setEditForm(pkgToForm(pkg));
    setEditErr(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditErr(null);
  }

  function setEdit(k: string, v: string | boolean) {
    setEditForm(f => ({ ...f, [k]: v }));
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setEditErr(null); setEditBusy(true);
    const res = await fetch('/api/admin/packages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id:                 editingId,
        name:               editForm.name,
        description:        editForm.description || null,
        base_slots_per_day: Number(editForm.base_slots_per_day),
        allows_10s:         editForm.allows_10s,
        allows_15s:         editForm.allows_15s,
        allows_30s:         editForm.allows_30s,
        allows_60s:         editForm.allows_60s,
        sort_order:         Number(editForm.sort_order),
      }),
    });
    setEditBusy(false);
    if (!res.ok) { setEditErr((await res.json()).error ?? 'Failed'); return; }
    setEditingId(null);
    router.refresh();
  }

  /* ── Toggle active ── */
  async function toggle(pkg: Package) {
    await fetch('/api/admin/packages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: pkg.id, active: !pkg.active }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-7">
      <div className="page-header">
        <div>
          <span className="section-label">Inventory &middot; Plans</span>
          <h1 className="display text-4xl text-ink-900">Packages</h1>
          <p className="mt-1 text-sm text-ink-900/50 max-w-lg">
            Define ad tiers customers select from. Each package sets the default daily slot count and allowed durations.
          </p>
        </div>
        <span className="badge badge-green shrink-0">
          {initial.filter(p => p.active).length} active
        </span>
      </div>

      {/* ── Create form ── */}
      <div className="paper p-6">
        <PackageForm
          title="Create new package"
          form={createForm}
          setF={setCreate}
          busy={createBusy}
          err={createErr}
          onSubmit={submitCreate}
          submitLabel="Create Package"
        />
      </div>

      {/* ── Package list ── */}
      <div className="paper overflow-hidden">
        <div className="data-header" style={{ padding: '0 20px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{initial.length} package{initial.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="divide-y divide-ink-100">
          {initial.length === 0 ? (
            <div className="px-5 py-10 text-center text-ink-900/50 text-sm">No packages yet. Create one above.</div>
          ) : initial.map(pkg => (
            <div key={pkg.id}>
              {/* ── Inline edit form ── */}
              {editingId === pkg.id ? (
                <div className="px-5 py-5 bg-ink-50/60 border-l-4 border-brand">
                  <PackageForm
                    title={`Editing: ${pkg.name}`}
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
                  <div className="w-7 h-7 rounded-full bg-ink-100 flex items-center justify-center shrink-0">
                    <span className="mono text-[11px] text-ink-900/50 font-bold">{pkg.sort_order}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-[14px] text-ink-900">{pkg.name}</p>
                      {!pkg.active && <span className="badge badge-gray">Inactive</span>}
                    </div>
                    {pkg.description && (
                      <p className="text-[12.5px] text-ink-900/50 mt-0.5">{pkg.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 bg-brand-soft text-brand-dark text-[11px] font-semibold px-2 py-0.5 rounded-md">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                        {pkg.base_slots_per_day} slots/day
                      </span>
                      {(['10s', '15s', '30s', '60s'] as const).map(d => {
                        const allowed = d === '10s' ? pkg.allows_10s : d === '15s' ? pkg.allows_15s : d === '30s' ? pkg.allows_30s : pkg.allows_60s;
                        return (
                          <span key={d} className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md mono ${
                            allowed ? 'bg-ink-100 text-ink-900/60' : 'bg-ink-50 text-ink-900/25 line-through'
                          }`}>{d}</span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={() => startEdit(pkg)}
                      className="btn btn-ghost h-8 text-xs px-4">
                      Edit
                    </button>
                    <button type="button" onClick={() => toggle(pkg)}
                      className={`btn h-8 text-xs px-4 ${
                        pkg.active
                          ? 'btn-ghost text-ink-900/60 hover:text-red-600 hover:border-red-200'
                          : 'bg-brand-soft text-brand-dark border border-brand/20 hover:bg-brand hover:text-white'
                      }`}>
                      {pkg.active ? 'Deactivate' : 'Activate'}
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
