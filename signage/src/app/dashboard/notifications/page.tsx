import { supabaseServer } from '@/lib/supabase-server';
import { fmtDate } from '@/lib/format';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const TYPE_ICON: Record<string, string> = {
  booking_suspended: 'text-red-600',
  booking_date_changed: 'text-amber-600',
  booking_approved: 'text-emerald-600',
  booking_rejected: 'text-red-600',
  payment_received: 'text-blue-600',
  general: 'text-ink-900',
};

const TYPE_LABEL: Record<string, string> = {
  booking_suspended: 'Ad Suspended',
  booking_date_changed: 'Schedule Changed',
  booking_approved: 'Ad Approved',
  booking_rejected: 'Ad Rejected',
  payment_received: 'Payment Received',
  general: 'Notification',
};

export default async function NotificationsPage() {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: notifications } = await supabase
    .from('notifications')
    .select('id, type, title, message, booking_id, campaign_id, metadata, is_read, created_at')
    .eq('customer_id', user!.id)
    .order('created_at', { ascending: false });

  const unreadCount = notifications?.filter(n => !n.is_read).length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <span className="section-label">Inbox</span>
          <h1 className="display text-4xl text-ink-900">Notifications</h1>
          <p className="text-sm text-ink-900/50 mt-1">
            Updates about your ads, payments, and schedule changes from the admin team.
          </p>
        </div>
        {unreadCount > 0 && (
          <span className="badge badge-amber shrink-0">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {unreadCount} unread
          </span>
        )}
      </div>

      {/* Notifications list */}
      {notifications && notifications.length > 0 ? (
        <div className="paper overflow-hidden divide-y divide-ink-100">
          {notifications.map(n => (
            <div
              key={n.id}
              className={`p-5 ${n.is_read ? 'bg-white' : 'bg-brand-soft/20'}`}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={`w-10 h-10 rounded-full ${n.is_read ? 'bg-ink-100' : 'bg-white'} flex items-center justify-center shrink-0`}>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    className={TYPE_ICON[n.type] || 'text-ink-900'}
                  >
                    {n.type === 'booking_suspended' && (
                      <><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></>
                    )}
                    {n.type === 'booking_date_changed' && (
                      <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>
                    )}
                    {n.type === 'booking_approved' && (
                      <><circle cx="12" cy="12" r="10"/><polyline points="9 12 12 15 17 9"/></>
                    )}
                    {n.type === 'booking_rejected' && (
                      <><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></>
                    )}
                    {n.type === 'payment_received' && (
                      <><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></>
                    )}
                    {n.type === 'general' && (
                      <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>
                    )}
                  </svg>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[11px] font-bold uppercase tracking-wider ${TYPE_ICON[n.type] || 'text-ink-900'}`}>
                      {TYPE_LABEL[n.type] || 'Notification'}
                    </span>
                    {!n.is_read && (
                      <span className="w-2 h-2 rounded-full bg-brand-live shrink-0" />
                    )}
                  </div>
                  <h3 className="font-semibold text-ink-900 mt-1">{n.title}</h3>
                  <p className="text-sm text-ink-900/70 mt-1">{n.message}</p>

                  {/* Metadata for date changes */}
                  {n.type === 'booking_date_changed' && n.metadata && (
                    <div className="mt-3 text-xs text-ink-900/50 bg-ink-50 rounded-lg p-3">
                      <div className="flex gap-4">
                        <div>
                          <span className="text-ink-900/30">Was:</span>
                          <br />
                          {n.metadata.old_start} → {n.metadata.old_end}
                        </div>
                        <div className="text-brand">
                          <span className="text-ink-900/30">Now:</span>
                          <br />
                          {n.metadata.new_start} → {n.metadata.new_end}
                        </div>
                      </div>
                      {n.metadata.reason && (
                        <p className="mt-2 text-ink-900/40 italic">Reason: {n.metadata.reason}</p>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-3 mt-3">
                    {n.booking_id && (
                      <Link
                        href={`/dashboard/my-campaigns`}
                        className="text-xs text-brand hover:underline font-medium"
                      >
                        View campaign
                      </Link>
                    )}
                    <span className="text-xs text-ink-900/40">
                      {fmtDate(n.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="paper p-14 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-brand-soft flex items-center justify-center mb-5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="text-brand">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </div>
          <p className="display text-xl text-ink-900/60 mb-1">No notifications</p>
          <p className="text-sm text-ink-900/40 max-w-xs">
            You&apos;ll see updates about your ads, payments, and schedule changes here.
          </p>
        </div>
      )}
    </div>
  );
}
