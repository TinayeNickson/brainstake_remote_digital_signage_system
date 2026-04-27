'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';
import ConfirmDialog from '@/components/ConfirmDialog';

interface OverrideRow {
  id: string;
  title: string;
  content_url: string;
  content_type: 'image' | 'video';
  message: string | null;
  is_active: boolean;
  created_at: string;
  activated_at: string | null;
}

interface Props {
  initial: OverrideRow[];
}

export default function OverrideClient({ initial }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [overrides,   setOverrides]   = useState<OverrideRow[]>(initial);
  const [busy,        setBusy]        = useState(false);
  const [uploadBusy,  setUploadBusy]  = useState(false);
  const [err,         setErr]         = useState<string | null>(null);
  const [success,     setSuccess]     = useState<string | null>(null);
  const [deleteItem,  setDeleteItem]  = useState<OverrideRow | null>(null);

  const [form, setForm] = useState({
    title: '',
    content_url: '',
    content_type: 'image' as 'image' | 'video',
    message: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const activeOverride = overrides.find(o => o.is_active) ?? null;

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setForm(prev => ({
      ...prev,
      content_type: f.type.startsWith('video/') ? 'video' : 'image',
    }));
  }

  async function uploadFile(): Promise<string | null> {
    if (!file) return null;
    setUploadBusy(true);
    const supa = supabaseBrowser();
    const path = `override-${Date.now()}-${file.name.replace(/\s/g, '_')}`;
    const { error } = await supa.storage.from('override-media').upload(path, file, { upsert: true });
    setUploadBusy(false);
    if (error) { setErr('Upload failed: ' + error.message); return null; }
    const { data } = supa.storage.from('override-media').getPublicUrl(path);
    return data.publicUrl;
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setSuccess(null);
    if (!file && !form.content_url) {
      setErr('Upload a file or enter a media URL.'); return;
    }
    setBusy(true);
    let url = form.content_url;
    if (file) {
      const uploaded = await uploadFile();
      if (!uploaded) { setBusy(false); return; }
      url = uploaded;
    }
    const res = await fetch('/api/admin/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, content_url: url }),
    });
    setBusy(false);
    if (!res.ok) { setErr((await res.json()).error ?? 'Failed'); return; }
    const { override } = await res.json();
    setOverrides(prev => [override, ...prev]);
    setForm({ title: '', content_url: '', content_type: 'image', message: '' });
    setFile(null); setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
    setSuccess('Override created. Use "Activate" to broadcast it to all screens.');
    router.refresh();
  }

  async function activate(o: OverrideRow) {
    setBusy(true); setErr(null); setSuccess(null);
    const res = await fetch('/api/admin/override', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: o.id, is_active: true }),
    });
    setBusy(false);
    if (!res.ok) { setErr((await res.json()).error ?? 'Failed'); return; }
    const { override: updated } = await res.json();
    setOverrides(prev => prev.map(r => r.id === updated.id ? updated : { ...r, is_active: false }));
    setSuccess(`"${updated.title}" is now broadcasting on ALL screens.`);
  }

  async function deactivate(o: OverrideRow) {
    setBusy(true); setErr(null); setSuccess(null);
    const res = await fetch('/api/admin/override', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: o.id, is_active: false }),
    });
    setBusy(false);
    if (!res.ok) { setErr((await res.json()).error ?? 'Failed'); return; }
    setOverrides(prev => prev.map(r => r.id === o.id ? { ...r, is_active: false } : r));
    setSuccess('Override deactivated. Screens resumed normal ad rotation.');
  }

  async function remove(o: OverrideRow) {
    const res = await fetch('/api/admin/override', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: o.id }),
    });
    setDeleteItem(null);
    if (!res.ok) { setErr((await res.json()).error ?? 'Failed'); return; }
    setOverrides(prev => prev.filter(r => r.id !== o.id));
  }

  return (
    <div className="space-y-7">
      {deleteItem && (
        <ConfirmDialog
          title="Delete override"
          message={`"${deleteItem.title}" will be permanently deleted.`}
          confirm="Delete"
          danger
          onConfirm={() => remove(deleteItem)}
          onCancel={() => setDeleteItem(null)}
        />
      )}
      {/* Header */}
      <div className="page-header">
        <div>
          <span className="section-label">System · Emergency Broadcast</span>
          <h1 className="display text-4xl text-ink-900">Override Control</h1>
          <p className="mt-1 text-sm text-ink-900/50 max-w-lg">
            Instantly push emergency content to every screen. All scheduled ads pause until you deactivate.
          </p>
        </div>
        <span className={`badge shrink-0 ${activeOverride ? 'badge-red' : 'badge-gray'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${activeOverride ? 'bg-red-500 animate-pulse' : 'bg-ink-900/30'}`} />
          {activeOverride ? 'Broadcast Active' : 'No Active Broadcast'}
        </span>
      </div>

      {/* Active broadcast banner */}
      {activeOverride && (
        <div className="rounded-2xl border-2 border-red-200 bg-red-50 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-2 bg-red-600">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <p className="text-white text-xs font-bold uppercase tracking-widest">Emergency Broadcast — Live on all screens</p>
          </div>
          <div className="p-5 flex items-start gap-4">
            <BroadcastIcon className="text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-red-800 text-[15px]">{activeOverride.title}</p>
              {activeOverride.message && (
                <p className="text-sm text-red-700/80 mt-0.5 truncate">&ldquo;{activeOverride.message}&rdquo;</p>
              )}
              {activeOverride.activated_at && (
                <p className="mono text-[11px] text-red-400 mt-1.5">
                  Activated {new Date(activeOverride.activated_at).toLocaleString()}
                </p>
              )}
            </div>
            <button onClick={() => deactivate(activeOverride)} disabled={busy}
                    className="btn shrink-0 bg-red-600 hover:bg-red-700 text-white border-0 h-9 text-sm font-semibold px-5">
              Deactivate
            </button>
          </div>
        </div>
      )}

      {/* Feedback messages */}
      {err     && <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{err}</div>}
      {success && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">{success}</div>}

      {/* Create form */}
      <div className="paper p-6">
        <p className="text-[11px] font-bold uppercase tracking-widest text-ink-900/40 mb-4">Create new override</p>
        <form onSubmit={create} className="space-y-4">
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 md:col-span-5">
              <label className="label">Override Title</label>
              <input required className="input" placeholder="Emergency Maintenance Notice"
                     value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="col-span-12 md:col-span-7">
              <label className="label">Optional Text Message</label>
              <input className="input" placeholder="All services suspended until 14:00. We apologise for the inconvenience."
                     value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-12 gap-4 items-start">
            <div className="col-span-12 md:col-span-6">
              <label className="label">Upload Media (image or video)</label>
              <input ref={fileRef} type="file" accept="image/*,video/*"
                     onChange={handleFileSelect}
                     className="block w-full text-sm text-ink-900/70 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-ink-50 file:text-ink-900 hover:file:bg-ink-100 cursor-pointer" />
              {uploadBusy && <p className="text-[11px] text-ink-900/50 mt-1">Uploading…</p>}
            </div>
            <div className="col-span-12 md:col-span-6">
              <label className="label">Or paste media URL</label>
              <input className="input" placeholder="https://…"
                     value={form.content_url} onChange={e => setForm({ ...form, content_url: e.target.value })} />
            </div>
          </div>

          {/* Preview */}
          {preview && (
            <div className="mt-2">
              {form.content_type === 'video'
                ? <video src={preview} controls className="max-h-40 rounded-lg border border-ink-100" />
                // eslint-disable-next-line @next/next/no-img-element
                : <img src={preview} alt="preview" className="max-h-40 rounded-lg border border-ink-100 object-contain" />
              }
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={busy || uploadBusy} className="btn btn-primary h-10 px-6 font-semibold">
              {busy ? 'Creating…' : 'Create Override'}
            </button>
            <p className="text-[12px] text-ink-900/50">
              Override is created but NOT active. You must activate it manually.
            </p>
          </div>
        </form>
      </div>

      {/* Overrides list */}
      <div className="paper overflow-hidden">
        <div className="data-header grid-cols-12 grid">
          <div className="col-span-4">Title</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Created</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>
        <div className="divide-y divide-ink-100">

        {overrides.length === 0 && (
          <div className="px-5 py-8 text-center text-ink-900/60 text-sm">No overrides created yet.</div>
        )}

        {overrides.map(o => (
          <div key={o.id} className="grid grid-cols-12 gap-4 px-5 py-4 items-center row-hover transition-colors">
            <div className="col-span-4">
              <div className="font-medium text-sm">{o.title}</div>
              {o.message && <div className="text-[11px] text-ink-900/50 truncate max-w-xs">{o.message}</div>}
            </div>
            <div className="col-span-2">
              <span className="pill text-ink-900/70 capitalize">{o.content_type}</span>
            </div>
            <div className="col-span-2">
              {o.is_active ? (
                <span className="pill bg-red-100 text-red-700 border-red-200 font-semibold flex items-center gap-1.5 w-fit">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  Live
                </span>
              ) : (
                <span className="pill text-ink-900/50">Standby</span>
              )}
            </div>
            <div className="col-span-2 mono text-[11px] text-ink-900/50">
              {new Date(o.created_at).toLocaleDateString()}
            </div>
            <div className="col-span-2 flex justify-end gap-2">
              {o.is_active ? (
                <button onClick={() => deactivate(o)} disabled={busy}
                        className="btn btn-ghost h-8 text-xs text-red-700 hover:bg-red-50">
                  Deactivate
                </button>
              ) : (
                <button onClick={() => activate(o)} disabled={busy}
                        className="btn btn-ghost h-8 text-xs text-emerald-700 hover:bg-emerald-50">
                  Activate
                </button>
              )}
              <a href={o.content_url} target="_blank" rel="noopener noreferrer"
                 className="btn btn-ghost h-8 text-xs">
                Preview
              </a>
              {!o.is_active && (
                <button onClick={() => setDeleteItem(o)}
                        className="btn btn-ghost h-8 text-xs text-red-600 hover:bg-red-50">
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
        </div>
      </div>
    </div>
  );
}

function BroadcastIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
      <line x1="12" y1="2" x2="12" y2="12" />
    </svg>
  );
}
