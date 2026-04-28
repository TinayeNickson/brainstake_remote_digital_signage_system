'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';

interface ContactSetting {
  id: string;
  key: string;
  label: string;
  value: string;
  description: string | null;
  is_public: boolean;
  sort_order: number;
}

export default function ClientContactSettings({ initialSettings }: { initialSettings: ContactSetting[] }) {
  const router = useRouter();
  const supa = supabaseBrowser();

  const [settings, setSettings] = useState<ContactSetting[]>(initialSettings);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function updateSetting(id: string, updates: Partial<ContactSetting>) {
    setSaving(id);
    setMessage(null);

    try {
      const { error } = await supa
        .from('contact_settings')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      setSettings(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
      setMessage({ type: 'success', text: 'Setting updated successfully' });
      router.refresh();
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'Failed to update setting' });
    } finally {
      setSaving(null);
    }
  }

  async function toggleVisibility(id: string, current: boolean) {
    await updateSetting(id, { is_public: !current });
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className={`rounded-xl px-4 py-3 text-sm ${
          message.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-700' 
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-ink-100 bg-brand-soft/30">
          <h2 className="font-semibold text-ink-900 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-brand">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
            Customer-Facing Contact Information
          </h2>
        </div>

        <div className="divide-y divide-ink-100">
          {settings.map((setting) => (
            <div key={setting.id} className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-ink-900">{setting.label}</h3>
                    <span className="text-xs mono text-ink-900/40 bg-ink-50 px-2 py-0.5 rounded">
                      {setting.key}
                    </span>
                  </div>
                  {setting.description && (
                    <p className="text-sm text-ink-900/50 mt-1">{setting.description}</p>
                  )}
                </div>
                <button
                  onClick={() => toggleVisibility(setting.id, setting.is_public)}
                  disabled={saving === setting.id}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    setting.is_public
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-gray-50 text-gray-600 border border-gray-200'
                  }`}
                >
                  {setting.is_public ? (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>
                      </svg>
                      Visible to customers
                    </>
                  ) : (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/>
                      </svg>
                      Hidden
                    </>
                  )}
                </button>
              </div>

              <div className="flex gap-3">
                <input
                  type="text"
                  defaultValue={setting.value}
                  onBlur={(e) => {
                    if (e.target.value !== setting.value) {
                      updateSetting(setting.id, { value: e.target.value });
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const target = e.target as HTMLInputElement;
                      if (target.value !== setting.value) {
                        updateSetting(setting.id, { value: target.value });
                      }
                      target.blur();
                    }
                  }}
                  disabled={saving === setting.id}
                  className="input flex-1"
                  placeholder="Enter value..."
                />
                {saving === setting.id && (
                  <span className="text-xs text-ink-900/50 flex items-center">
                    <svg className="animate-spin mr-1" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="30"/>
                    </svg>
                    Saving...
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {settings.length === 0 && (
          <div className="p-8 text-center">
            <p className="text-ink-900/50">No contact settings found. Run the database seed.</p>
          </div>
        )}
      </div>

      {/* Preview section */}
      <div className="card p-5">
        <h2 className="font-semibold text-ink-900 mb-4 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-brand">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          Where these appear
        </h2>
        <div className="space-y-2 text-sm text-ink-900/70">
          <p><span className="font-semibold text-ink-900">Support Phone</span> — Shown in tooltips when hovering over &quot;Under Review&quot; status and on suspended ad banners</p>
          <p><span className="font-semibold text-ink-900">Payment Review Message</span> — Displayed on the payment page when proof has been submitted and is pending review</p>
          <p><span className="font-semibold text-ink-900">Suspended Ad Message</span> — Shown when an ad has been suspended by an admin</p>
          <p><span className="font-semibold text-ink-900">Support Email / WhatsApp</span> — Available for future use in customer communications</p>
        </div>
      </div>
    </div>
  );
}
