'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmDialog from '@/components/ConfirmDialog';

interface FallbackItem {
  id: string;
  title: string;
  content_url: string;
  content_type: 'image' | 'video';
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export default function FallbackClient({ initial }: { initial: FallbackItem[] }) {
  const router = useRouter();

  const [items,   setItems]   = useState<FallbackItem[]>(initial);
  const [busy,    setBusy]    = useState(false);
  const [err,     setErr]     = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'video'>('image');

  const [form, setForm] = useState({
    title:        '',
    content_type: 'image' as 'image' | 'video',
    sort_order:   items.length,
  });
  const [file,       setFile]       = useState<File | null>(null);
  const [deleteItem, setDeleteItem] = useState<FallbackItem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!file)       { setErr('Select a file to upload'); return; }
    if (!form.title) { setErr('Title is required'); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file',         file);
      fd.append('title',        form.title);
      fd.append('content_type', form.content_type);
      fd.append('sort_order',   String(form.sort_order));

      const res = await fetch('/api/admin/fallback', { method: 'PUT', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Upload failed');

      setItems(prev => [...prev, json.item]);
      setForm({ title: '', content_type: 'image', sort_order: items.length + 1 });
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      router.refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(item: FallbackItem) {
    await fetch('/api/admin/fallback', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, is_active: !item.is_active }),
    });
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_active: !i.is_active } : i));
  }

  async function remove(item: FallbackItem) {
    await fetch('/api/admin/fallback', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id }),
    });
    setItems(prev => prev.filter(i => i.id !== item.id));
    setDeleteItem(null);
  }

  return (
    <div className="space-y-8">
      {deleteItem && (
        <ConfirmDialog
          title="Delete fallback item"
          message={`"${deleteItem.title}" will be permanently removed.`}
          confirm="Delete"
          danger
          onConfirm={() => remove(deleteItem)}
          onCancel={() => setDeleteItem(null)}
        />
      )}

      {/* Header */}
      <div>
        <p className="mono text-[11px] uppercase tracking-[0.2em] text-accent mb-1">Admin · Content</p>
        <h1 className="display text-5xl">Fallback Content</h1>
        <p className="mt-2 text-sm text-ink-900/60 max-w-xl">
          Shown on screens outside their operating hours. Upload images or videos — they rotate automatically.
        </p>
      </div>

      {/* Upload form */}
      <form onSubmit={upload} className="paper p-6 space-y-4">
        <p className="mono text-[11px] uppercase tracking-[0.2em] text-ink-900/50 mb-2">Add new item</p>
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 md:col-span-4">
            <label className="label">Title</label>
            <input required className="input" value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Off-hours brand loop" />
          </div>
          <div className="col-span-6 md:col-span-2">
            <label className="label">Type</label>
            <select className="select" value={form.content_type}
              onChange={e => setForm({ ...form, content_type: e.target.value as 'image' | 'video' })}>
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
          </div>
          <div className="col-span-6 md:col-span-2">
            <label className="label">Sort order</label>
            <input type="number" min={0} className="input" value={form.sort_order}
              onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })} />
          </div>
          <div className="col-span-12 md:col-span-4">
            <label className="label">File</label>
            <input ref={fileRef} type="file"
              accept={form.content_type === 'video' ? 'video/*' : 'image/*'}
              className="input py-2 text-sm"
              onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>

        {err && <p className="text-sm text-red-700 bg-red-50 rounded-lg px-4 py-2">{err}</p>}

        <div className="flex items-center gap-4">
          <button disabled={busy} className="btn btn-primary h-10 px-6">
            {busy ? 'Uploading…' : 'Upload & Save'}
          </button>
          <p className="text-xs text-ink-900/40">
            Files are stored in the <span className="mono">fallback-media</span> bucket.
          </p>
        </div>
      </form>

      {/* Items list */}
      <div className="paper divide-y divide-ink-200">
        <div className="grid grid-cols-12 gap-4 px-5 py-3 mono text-[10px] uppercase tracking-widest text-ink-900/60">
          <div className="col-span-1">Order</div>
          <div className="col-span-2">Preview</div>
          <div className="col-span-3">Title</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {items.length === 0 && (
          <div className="px-5 py-10 text-center text-ink-900/50 text-sm">
            No fallback content yet. Upload your first item above.
          </div>
        )}

        {items.map(item => (
          <div key={item.id} className="grid grid-cols-12 gap-4 px-5 py-4 items-center">
            <div className="col-span-1 mono text-sm font-medium text-ink-900/50">
              {item.sort_order}
            </div>

            {/* Thumbnail */}
            <div className="col-span-2">
              <button
                type="button"
                onClick={() => { setPreview(item.content_url); setPreviewType(item.content_type); }}
                className="w-16 h-10 rounded-lg overflow-hidden border border-ink-200 bg-ink-100 flex items-center justify-center hover:border-brand transition-colors"
              >
                {item.content_type === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.content_url} alt={item.title} className="w-full h-full object-cover" />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="text-ink-900/40">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                )}
              </button>
            </div>

            <div className="col-span-3">
              <p className="font-medium text-sm text-ink-900">{item.title}</p>
              <p className="mono text-[10px] text-ink-900/40 mt-0.5 truncate">{item.content_url.split('/').pop()}</p>
            </div>

            <div className="col-span-2">
              <span className="pill text-[11px] text-ink-900/60 capitalize">{item.content_type}</span>
            </div>

            <div className="col-span-2">
              <span className={`pill text-[11px] ${item.is_active ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-ink-900/50'}`}>
                {item.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="col-span-2 flex justify-end gap-2">
              <button onClick={() => toggleActive(item)}
                      className="btn btn-ghost h-8 text-xs">
                {item.is_active ? 'Disable' : 'Enable'}
              </button>
              <button onClick={() => setDeleteItem(item)}
                      className="btn btn-ghost h-8 text-xs text-red-600 hover:bg-red-50">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Preview modal */}
      {preview && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-8"
          onClick={() => setPreview(null)}
        >
          <div className="max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            {previewType === 'video' ? (
              <video src={preview} controls autoPlay className="w-full rounded-xl" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Preview" className="w-full rounded-xl object-contain max-h-[80vh]" />
            )}
            <button onClick={() => setPreview(null)}
                    className="mt-4 btn btn-ghost text-white/70 hover:text-white mx-auto flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Close preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
