'use client';

import { useEffect, useState } from 'react';

interface DesignRequest {
  id: string;
  title: string;
  description: string;
  design_type: string;
  status: 'pending' | 'in_progress' | 'submitted' | 'approved' | 'rejected' | 'revision_requested';
  design_url: string | null;
  admin_notes: string | null;
  customer_feedback: string | null;
  created_at: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  customer: {
    id: string;
    full_name: string;
    email: string;
    company_name: string;
    phone: string;
  };
  campaign: {
    id: string;
    title: string;
  } | null;
  ad: {
    id: string;
    title: string;
    media_url: string;
    format: string;
  } | null;
}

export default function AdminDesignRequestsPage() {
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'submitted' | 'approved' | 'rejected'>('all');
  const [requests, setRequests] = useState<DesignRequest[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    in_progress: 0,
    submitted: 0,
    approved: 0,
    rejected: 0,
    revision_requested: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<DesignRequest | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [designUrl, setDesignUrl] = useState('');
  const [adminNotes, setAdminNotes] = useState('');

  useEffect(() => {
    fetchRequests();
  }, [filter]);

  async function fetchRequests() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/design-requests?status=${filter}`);
      const data = await res.json();
      setRequests(data.requests || []);
      setStats(data.stats || {});
    } catch (error) {
      console.error('Failed to fetch design requests:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(requestId: string, newStatus: string) {
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/design-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: requestId,
          status: newStatus,
          design_url: designUrl || undefined,
          admin_notes: adminNotes || undefined,
        }),
      });

      if (res.ok) {
        setSelectedRequest(null);
        setDesignUrl('');
        setAdminNotes('');
        await fetchRequests();
      }
    } catch (error) {
      console.error('Failed to update request:', error);
    } finally {
      setActionLoading(false);
    }
  }

  const statusBadge: Record<string, { class: string; label: string }> = {
    pending: { class: 'badge badge-amber', label: 'Pending' },
    in_progress: { class: 'badge badge-blue', label: 'In Progress' },
    submitted: { class: 'badge badge-purple', label: 'Ready for Review' },
    approved: { class: 'badge badge-green', label: 'Approved' },
    rejected: { class: 'badge badge-red', label: 'Rejected' },
    revision_requested: { class: 'badge badge-orange', label: 'Revision Needed' },
  };

  return (
    <div className="space-y-7">
      {/* Page header */}
      <div className="page-header">
        <div>
          <span className="section-label">Admin Portal</span>
          <h1 className="display text-4xl text-ink-900">Design Requests</h1>
          <p className="text-sm text-ink-900/50 mt-1 max-w-lg">
            Manage customer design requests. Create designs, submit for approval, and track revisions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="input h-11 text-sm min-w-[160px]"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="submitted">Ready for Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-6 gap-3">
        <div className="stat-card">
          <p className="text-xs font-semibold text-ink-900/45 uppercase tracking-wider mb-2">Total</p>
          <p className="display text-2xl font-extrabold text-ink-900 leading-none">{stats.total}</p>
        </div>
        <div className="stat-card stat-card-amber">
          <p className="text-xs font-semibold text-ink-900/45 uppercase tracking-wider mb-2">Pending</p>
          <p className="display text-2xl font-extrabold text-amber-600 leading-none">{stats.pending}</p>
        </div>
        <div className="stat-card stat-card-blue">
          <p className="text-xs font-semibold text-ink-900/45 uppercase tracking-wider mb-2">In Progress</p>
          <p className="display text-2xl font-extrabold text-blue-600 leading-none">{stats.in_progress}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold text-ink-900/45 uppercase tracking-wider mb-2">Ready</p>
          <p className="display text-2xl font-extrabold text-purple-600 leading-none">{stats.submitted}</p>
        </div>
        <div className="stat-card stat-card-green">
          <p className="text-xs font-semibold text-ink-900/45 uppercase tracking-wider mb-2">Approved</p>
          <p className="display text-2xl font-extrabold text-green-600 leading-none">{stats.approved}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold text-ink-900/45 uppercase tracking-wider mb-2">Revision</p>
          <p className="display text-2xl font-extrabold text-orange-600 leading-none">{stats.revision_requested}</p>
        </div>
      </div>

      {/* Requests table */}
      <div className="paper overflow-hidden">
        <div className="data-header grid-cols-12 hidden lg:grid">
          <div className="col-span-3">Request · Customer</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-2">Campaign</div>
          <div className="col-span-2">Submitted</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-ink-900/50">
            <div className="animate-pulse">Loading requests...</div>
          </div>
        ) : requests.length === 0 ? (
          <div className="paper p-14 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-brand-soft flex items-center justify-center mb-5">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-brand">
                <path d="M12 19l7-7 3 3-7 7-3-3z"/>
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
              </svg>
            </div>
            <p className="display text-xl text-ink-900/60 mb-1">No design requests</p>
            <p className="text-sm text-ink-900/40 max-w-xs">
              Customers will submit design requests through their dashboard.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-ink-100">
            {requests.map((r) => (
              <div key={r.id} className="grid grid-cols-12 gap-4 px-5 py-4 items-center row-hover">
                <div className="col-span-12 lg:col-span-3">
                  <p className="font-semibold text-sm text-ink-900">{r.title}</p>
                  <p className="text-xs text-ink-900/50 truncate">{r.customer?.full_name || r.customer?.email}</p>
                  <p className="text-xs text-ink-900/40">{r.customer?.company_name}</p>
                </div>

                <div className="col-span-6 lg:col-span-2">
                  <p className="text-sm text-ink-900 capitalize">{r.design_type}</p>
                  <p className="text-xs text-ink-900/50">{r.description.slice(0, 50)}...</p>
                </div>

                <div className="col-span-6 lg:col-span-2">
                  {r.campaign ? (
                    <>
                      <p className="text-sm text-ink-900">{r.campaign.title}</p>
                      <p className="text-xs text-ink-900/50">Linked campaign</p>
                    </>
                  ) : r.ad ? (
                    <>
                      <p className="text-sm text-ink-900">{r.ad.title}</p>
                      <p className="text-xs text-ink-900/50">Existing ad</p>
                    </>
                  ) : (
                    <span className="text-xs text-ink-900/40">New design</span>
                  )}
                </div>

                <div className="col-span-6 lg:col-span-2">
                  <p className="text-sm text-ink-900">{new Date(r.created_at).toLocaleDateString()}</p>
                  {r.submitted_at && (
                    <p className="text-xs text-ink-900/50">
                      Submitted: {new Date(r.submitted_at).toLocaleDateString()}
                    </p>
                  )}
                </div>

                <div className="col-span-6 lg:col-span-1">
                  <span className={`${statusBadge[r.status]?.class || 'badge'} text-xs`}>
                    {statusBadge[r.status]?.label || r.status}
                  </span>
                </div>

                <div className="col-span-12 lg:col-span-2 text-right space-x-2">
                  {r.status === 'pending' && (
                    <button
                      onClick={() => updateStatus(r.id, 'in_progress')}
                      className="btn btn-sm btn-primary"
                      disabled={actionLoading}
                    >
                      Start Work
                    </button>
                  )}
                  {r.status === 'in_progress' && (
                    <button
                      onClick={() => setSelectedRequest(r)}
                      className="btn btn-sm btn-primary"
                    >
                      Submit Design
                    </button>
                  )}
                  {r.status === 'submitted' && (
                    <span className="text-xs text-ink-900/50">Awaiting customer</span>
                  )}
                  {r.status === 'revision_requested' && (
                    <button
                      onClick={() => setSelectedRequest(r)}
                      className="btn btn-sm btn-amber"
                    >
                      View Feedback
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedRequest(r)}
                    className="btn btn-sm btn-secondary"
                  >
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit Design Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-ink-100">
              <h2 className="text-xl font-semibold text-ink-900">
                {selectedRequest.status === 'in_progress' ? 'Submit Design' : 'View Request'}
              </h2>
              <p className="text-sm text-ink-900/50">{selectedRequest.title}</p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="label">Customer Request</label>
                <p className="text-sm text-ink-900 bg-ink-50 p-3 rounded-lg">{selectedRequest.description}</p>
              </div>

              <div>
                <label className="label">Customer</label>
                <p className="text-sm text-ink-900">{selectedRequest.customer?.full_name}</p>
                <p className="text-xs text-ink-900/50">{selectedRequest.customer?.email}</p>
                <p className="text-xs text-ink-900/50">{selectedRequest.customer?.phone}</p>
              </div>

              {selectedRequest.customer_feedback && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
                  <label className="label text-amber-700">Customer Feedback</label>
                  <p className="text-sm text-amber-900">{selectedRequest.customer_feedback}</p>
                </div>
              )}

              {selectedRequest.status === 'in_progress' || selectedRequest.status === 'revision_requested' ? (
                <>
                  <div>
                    <label className="label">Design URL</label>
                    <input
                      type="url"
                      value={designUrl}
                      onChange={(e) => setDesignUrl(e.target.value)}
                      placeholder="https://storage... or external link"
                      className="input"
                    />
                    <p className="text-xs text-ink-900/50 mt-1">
                      Upload to storage and paste the URL here
                    </p>
                  </div>

                  <div>
                    <label className="label">Admin Notes (optional)</label>
                    <textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Any notes for the customer..."
                      className="input h-20 resize-none"
                    />
                  </div>
                </>
              ) : selectedRequest.design_url && (
                <div>
                  <label className="label">Design File</label>
                  <a
                    href={selectedRequest.design_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand hover:underline text-sm flex items-center gap-2"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    View Design File
                  </a>
                </div>
              )}

              {selectedRequest.admin_notes && (
                <div>
                  <label className="label">Admin Notes</label>
                  <p className="text-sm text-ink-900 bg-ink-50 p-3 rounded-lg">{selectedRequest.admin_notes}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-ink-100 flex justify-between">
              <button
                onClick={() => setSelectedRequest(null)}
                className="btn btn-secondary"
              >
                Close
              </button>

              {selectedRequest.status === 'in_progress' && (
                <button
                  onClick={() => updateStatus(selectedRequest.id, 'submitted')}
                  disabled={!designUrl || actionLoading}
                  className="btn btn-primary"
                >
                  {actionLoading ? 'Submitting...' : 'Submit for Review'}
                </button>
              )}

              {selectedRequest.status === 'revision_requested' && (
                <button
                  onClick={() => updateStatus(selectedRequest.id, 'submitted')}
                  disabled={!designUrl || actionLoading}
                  className="btn btn-primary"
                >
                  {actionLoading ? 'Submitting...' : 'Submit Revision'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
