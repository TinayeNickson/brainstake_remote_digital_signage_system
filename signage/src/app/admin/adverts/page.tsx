'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface AdvertAssignment {
  booking_id: string;
  booking_status: string;
  assignment_status: 'active' | 'expired' | 'scheduled' | 'unassigned';
  start_date: string;
  end_date: string;
  slots_per_day: number;
  price: number;
  advert: {
    id: string;
    title: string;
    media_url: string;
    format: 'image' | 'video';
    duration: string;
  };
  customer: {
    id: string;
    name: string;
    email: string;
    company: string;
  };
  location: {
    id: string;
    name: string;
    description: string;
  };
  device: {
    id: string;
    code: string;
    name: string;
    active: boolean;
  } | null;
  campaign: {
    id: string;
    title: string;
  } | null;
}

export default function AdminAdvertsPage() {
  const [filter, setFilter] = useState<'all' | 'active' | 'expired' | 'scheduled' | 'unassigned'>('all');
  const [assignments, setAssignments] = useState<AdvertAssignment[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    expired: 0,
    scheduled: 0,
    unassigned: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAssignments();
  }, [filter]);

  async function fetchAssignments() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/adverts?status=${filter}`);
      const data = await res.json();
      setAssignments(data.assignments || []);
      setStats(data.stats || { total: 0, active: 0, expired: 0, scheduled: 0, unassigned: 0 });
    } catch (error) {
      console.error('Failed to fetch assignments:', error);
    } finally {
      setLoading(false);
    }
  }

  const statusBadge: Record<string, { class: string; label: string }> = {
    active: { class: 'badge badge-green', label: 'Active' },
    expired: { class: 'badge badge-gray', label: 'Expired' },
    scheduled: { class: 'badge badge-blue', label: 'Scheduled' },
    unassigned: { class: 'badge badge-amber', label: 'Unassigned' },
  };

  return (
    <div className="space-y-7">
      {/* Page header */}
      <div className="page-header">
        <div>
          <span className="section-label">Admin Portal</span>
          <h1 className="display text-4xl text-ink-900">Advert Assignments</h1>
          <p className="text-sm text-ink-900/50 mt-1 max-w-lg">
            View all adverts assigned to screens. Monitor active campaigns, expired bookings, and unassigned ads.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="input h-11 text-sm min-w-[160px]"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="scheduled">Scheduled</option>
            <option value="unassigned">Unassigned</option>
          </select>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-5 gap-4">
        <div className="stat-card">
          <p className="text-xs font-semibold text-ink-900/45 uppercase tracking-wider mb-2">Total</p>
          <p className="display text-3xl font-extrabold text-ink-900 leading-none">{stats.total}</p>
        </div>
        <div className="stat-card stat-card-green">
          <p className="text-xs font-semibold text-ink-900/45 uppercase tracking-wider mb-2">Active</p>
          <p className="display text-3xl font-extrabold text-green-600 leading-none">{stats.active}</p>
        </div>
        <div className="stat-card stat-card-amber">
          <p className="text-xs font-semibold text-ink-900/45 uppercase tracking-wider mb-2">Unassigned</p>
          <p className="display text-3xl font-extrabold text-amber-600 leading-none">{stats.unassigned}</p>
        </div>
        <div className="stat-card stat-card-blue">
          <p className="text-xs font-semibold text-ink-900/45 uppercase tracking-wider mb-2">Scheduled</p>
          <p className="display text-3xl font-extrabold text-blue-600 leading-none">{stats.scheduled}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold text-ink-900/45 uppercase tracking-wider mb-2">Expired</p>
          <p className="display text-3xl font-extrabold text-ink-900/60 leading-none">{stats.expired}</p>
        </div>
      </div>

      {/* Assignments table */}
      <div className="paper overflow-hidden">
        {/* Table header */}
        <div className="data-header grid-cols-12 hidden lg:grid">
          <div className="col-span-4">Ad · Customer</div>
          <div className="col-span-2">Location</div>
          <div className="col-span-2">Screen</div>
          <div className="col-span-2">Schedule</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-ink-900/50">
            <div className="animate-pulse">Loading assignments...</div>
          </div>
        ) : assignments.length === 0 ? (
          <div className="paper p-14 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-brand-soft flex items-center justify-center mb-5">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="text-brand">
                <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
              </svg>
            </div>
            <p className="display text-xl text-ink-900/60 mb-1">No {filter !== 'all' ? filter : ''} adverts</p>
            <p className="text-sm text-ink-900/40 max-w-xs">
              {filter === 'all' 
                ? 'No advert assignments found in the system.'
                : `No ${filter} adverts found. Try a different filter.`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-ink-100">
            {assignments.map((a) => (
              <div key={a.booking_id} className="grid grid-cols-12 gap-4 px-5 py-4 items-center row-hover transition-colors">
                {/* Ad info */}
                <div className="col-span-12 lg:col-span-4 flex items-center gap-4 min-w-0">
                  <div className="shrink-0 w-[72px] h-[48px] rounded-lg overflow-hidden bg-ink-100 border border-ink-100">
                    {a.advert?.format === 'image' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.advert.media_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-ink-900/5">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-ink-900/30">
                          <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-[13.5px] text-ink-900 truncate">{a.advert?.title || 'Untitled'}</p>
                    <p className="text-[12px] text-ink-900/50 truncate mt-0.5">
                      {a.customer?.company || a.customer?.name || a.customer?.email}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-ink-900/45 mono">{a.advert?.duration}s</span>
                      <span className="text-[11px] text-ink-900/45 mono">{a.slots_per_day}/day</span>
                    </div>
                  </div>
                </div>

                {/* Location */}
                <div className="col-span-6 lg:col-span-2">
                  <p className="text-sm text-ink-900 font-medium">{a.location?.name}</p>
                  <p className="text-xs text-ink-900/50 truncate">{a.location?.description}</p>
                </div>

                {/* Screen */}
                <div className="col-span-6 lg:col-span-2">
                  {a.device ? (
                    <>
                      <p className="text-sm text-ink-900 font-medium">{a.device.name}</p>
                      <p className="text-xs text-ink-900/50 mono">{a.device.code}</p>
                      {!a.device.active && (
                        <span className="badge badge-red text-xs mt-1">Inactive</span>
                      )}
                    </>
                  ) : (
                    <span className="badge badge-amber text-xs">No Screen</span>
                  )}
                </div>

                {/* Schedule */}
                <div className="col-span-6 lg:col-span-2">
                  <p className="text-sm text-ink-900">
                    {new Date(a.start_date).toLocaleDateString()} -
                  </p>
                  <p className="text-sm text-ink-900/60">
                    {new Date(a.end_date).toLocaleDateString()}
                  </p>
                </div>

                {/* Status */}
                <div className="col-span-6 lg:col-span-1">
                  <span className={`${statusBadge[a.assignment_status]?.class || 'badge'} text-xs`}>
                    {statusBadge[a.assignment_status]?.label || a.assignment_status}
                  </span>
                </div>

                {/* Actions */}
                <div className="col-span-12 lg:col-span-1 text-right">
                  <Link
                    href={`/admin/assign?booking_id=${a.booking_id}`}
                    className="btn btn-sm btn-secondary"
                  >
                    {a.device ? 'Reassign' : 'Assign'}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
