import { supabaseServer } from '@/lib/supabase-server';
import Link from 'next/link';
import ClientContactSettings from './client';

export const dynamic = 'force-dynamic';

interface ContactSetting {
  id: string;
  key: string;
  label: string;
  value: string;
  description: string | null;
  is_public: boolean;
  sort_order: number;
}

export default async function ContactSettingsPage() {
  const supabase = supabaseServer();

  const { data: settings, error } = await supabase
    .from('contact_settings')
    .select('id, key, label, value, description, is_public, sort_order')
    .order('sort_order', { ascending: true });

  if (error) {
    return (
      <div className="space-y-6">
        <div className="page-header">
          <div>
            <span className="section-label">Configuration</span>
            <h1 className="display text-4xl text-ink-900">Contact Settings</h1>
          </div>
        </div>
        <div className="card p-8 text-center">
          <p className="text-red-600">Failed to load contact settings: {error.message}</p>
        </div>
      </div>
    );
  }

  const contactSettings: ContactSetting[] = settings || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <span className="section-label">Configuration</span>
          <h1 className="display text-4xl text-ink-900">Contact Settings</h1>
          <p className="text-sm text-ink-900/50 mt-1 max-w-lg">
            Manage contact information and messages shown to customers when ads are suspended or payments are under review.
          </p>
        </div>
        <Link href="/admin" className="btn btn-ghost h-11 px-5">
          ← Back to Admin
        </Link>
      </div>

      <ClientContactSettings initialSettings={contactSettings} />
    </div>
  );
}
