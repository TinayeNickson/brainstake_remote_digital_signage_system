import { supabaseServer } from '@/lib/supabase-server';
import { fmtDate } from '@/lib/format';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const supabase = supabaseServer();

  // Fetch stats
  const [bookingsRes, messagesRes, designReqsRes, devicesRes, usersRes] = await Promise.all([
    supabase.from('bookings').select('id, status, device_id, start_date, end_date', { count: 'exact' }),
    supabase.from('messages').select('id, is_read, is_from_customer', { count: 'exact' }).eq('is_read', false),
    supabase.from('design_requests').select('id, status', { count: 'exact' }),
    supabase.from('devices').select('id, status', { count: 'exact' }),
    supabase.from('profiles').select('id, role', { count: 'exact' }).eq('role', 'customer'),
  ]);

  const totalBookings = bookingsRes.count ?? 0;
  const activeBookings = (bookingsRes.data?.filter(b => b.status === 'active').length) ?? 0;
  const unassignedAds = (bookingsRes.data?.filter(b => b.status === 'active' && !b.device_id).length) ?? 0;
  const unreadMessages = messagesRes.count ?? 0;
  const pendingDesigns = (designReqsRes.data?.filter(d => ['pending', 'in_progress', 'submitted'].includes(d.status)).length) ?? 0;
  const totalDevices = devicesRes.count ?? 0;
  const onlineDevices = (devicesRes.data?.filter(d => d.status === 'online').length) ?? 0;
  const totalCustomers = usersRes.count ?? 0;

  // Fetch recent items
  const [recentMessages, recentDesigns] = await Promise.all([
    supabase
      .from('messages')
      .select(`
        id, content, created_at, is_read, is_from_customer,
        sender:sender_id(full_name, email),
        recipient:recipient_id(full_name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('design_requests')
      .select(`
        id, title, status, created_at,
        customer:customer_id(full_name, email)
      `)
      .in('status', ['pending', 'in_progress', 'submitted'])
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  return (
    <div className="space-y-7">
      {/* Page header */}
      <div className="page-header">
        <div>
          <span className="section-label">Admin Portal</span>
          <h1 className="display text-4xl text-ink-900">Dashboard</h1>
          <p className="text-sm text-ink-900/50 mt-1 max-w-lg">
            Overview of your digital signage platform. Monitor ads, devices, customer communication, and design requests.
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/admin/adverts" className="stat-card hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-ink-900/45 uppercase tracking-wider">Live Ads</p>
            <span className="w-8 h-8 rounded-lg bg-brand-soft flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-brand">
                <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
              </svg>
            </span>
          </div>
          <p className="display text-3xl font-extrabold text-brand leading-none">{activeBookings}</p>
          <p className="text-xs text-ink-900/40 mt-2">{unassignedAds} awaiting placement</p>
        </Link>

        <Link href="/admin/communication" className="stat-card hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-ink-900/45 uppercase tracking-wider">Messages</p>
            <span className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-blue-600">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </span>
          </div>
          <p className="display text-3xl font-extrabold text-blue-600 leading-none">{unreadMessages}</p>
          <p className="text-xs text-ink-900/40 mt-2">unread messages</p>
        </Link>

        <Link href="/admin/communication?tab=designs" className="stat-card hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-ink-900/45 uppercase tracking-wider">Design Requests</p>
            <span className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-purple-600">
                <path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
              </svg>
            </span>
          </div>
          <p className="display text-3xl font-extrabold text-purple-600 leading-none">{pendingDesigns}</p>
          <p className="text-xs text-ink-900/40 mt-2">pending/in progress</p>
        </Link>

        <Link href="/admin/devices" className="stat-card hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-ink-900/45 uppercase tracking-wider">Devices</p>
            <span className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-green-600">
                <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
              </svg>
            </span>
          </div>
          <p className="display text-3xl font-extrabold text-green-600 leading-none">{onlineDevices}/{totalDevices}</p>
          <p className="text-xs text-ink-900/40 mt-2">online devices</p>
        </Link>
      </div>

      {/* Quick Actions Row */}
      <div className="flex flex-wrap gap-3">
        <Link href="/admin/communication" className="btn btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="mr-2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Communication Hub
        </Link>
        <Link href="/admin/adverts" className="btn btn-secondary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="mr-2">
            <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
          </svg>
          View All Ads
        </Link>
        <Link href="/admin/devices" className="btn btn-secondary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="mr-2">
            <rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/>
          </svg>
          Manage Devices
        </Link>
      </div>

      {/* Two Column Layout: Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Messages */}
        <div className="paper overflow-hidden">
          <div className="p-4 border-b border-ink-100 bg-ink-50/50 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-ink-900">Recent Messages</h3>
              <p className="text-xs text-ink-900/50">Latest customer communications</p>
            </div>
            <Link href="/admin/communication" className="text-sm text-brand hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-ink-100">
            {(recentMessages.data?.length ?? 0) === 0 ? (
              <div className="p-8 text-center text-ink-900/50">
                <p className="text-sm">No messages yet</p>
              </div>
            ) : (
              recentMessages.data?.map((m: any) => (
                <div key={m.id} className="p-4 hover:bg-ink-50/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-2 ${m.is_read ? 'bg-ink-200' : 'bg-blue-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink-900">
                        {m.is_from_customer 
                          ? (m.sender?.full_name || m.sender?.email || 'Customer')
                          : 'You (Admin)'}
                      </p>
                      <p className="text-sm text-ink-900/70 truncate">{m.content}</p>
                      <p className="text-xs text-ink-900/40 mt-1">
                        {new Date(m.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Design Requests */}
        <div className="paper overflow-hidden">
          <div className="p-4 border-b border-ink-100 bg-ink-50/50 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-ink-900">Design Requests</h3>
              <p className="text-xs text-ink-900/50">Pending and in-progress designs</p>
            </div>
            <Link href="/admin/communication?tab=designs" className="text-sm text-brand hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-ink-100">
            {(recentDesigns.data?.length ?? 0) === 0 ? (
              <div className="p-8 text-center text-ink-900/50">
                <p className="text-sm">No pending design requests</p>
              </div>
            ) : (
              recentDesigns.data?.map((d: any) => (
                <div key={d.id} className="p-4 hover:bg-ink-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink-900 truncate">{d.title}</p>
                      <p className="text-xs text-ink-900/50">
                        {d.customer?.full_name || d.customer?.email || 'Customer'}
                      </p>
                      <p className="text-xs text-ink-900/40 mt-1">
                        {new Date(d.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`badge ${
                      d.status === 'pending' ? 'badge-amber' :
                      d.status === 'in_progress' ? 'badge-blue' :
                      d.status === 'submitted' ? 'badge-purple' :
                      'badge-gray'
                    } text-xs shrink-0`}>
                      {d.status === 'in_progress' ? 'In Progress' : 
                       d.status === 'submitted' ? 'Ready for Review' :
                       d.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* System Overview */}
      <div className="paper p-6">
        <h3 className="font-semibold text-ink-900 mb-4">Platform Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <p className="display text-2xl font-bold text-ink-900">{totalBookings}</p>
            <p className="text-xs text-ink-900/50 uppercase tracking-wider">Total Bookings</p>
          </div>
          <div className="text-center">
            <p className="display text-2xl font-bold text-ink-900">{totalCustomers}</p>
            <p className="text-xs text-ink-900/50 uppercase tracking-wider">Customers</p>
          </div>
          <div className="text-center">
            <p className="display text-2xl font-bold text-ink-900">{totalDevices}</p>
            <p className="text-xs text-ink-900/50 uppercase tracking-wider">Screens</p>
          </div>
          <div className="text-center">
            <p className="display text-2xl font-bold text-green-600">{onlineDevices}</p>
            <p className="text-xs text-ink-900/50 uppercase tracking-wider">Online Now</p>
          </div>
        </div>
      </div>
    </div>
  );
}
