'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

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
  campaign: {
    id: string;
    title: string;
    start_date: string;
    end_date: string;
  } | null;
  ad: {
    id: string;
    title: string;
  } | null;
}

export default function CustomerDesignRequestsPage() {
  const [requests, setRequests] = useState<DesignRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<DesignRequest | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // New request form
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newType, setNewType] = useState('advert');

  useEffect(() => {
    fetchRequests();
  }, []);

  async function fetchRequests() {
    setLoading(true);
    try {
      const res = await fetch('/api/design-requests');
      const data = await res.json();
      setRequests(data.requests || []);
    } catch (error) {
      console.error('Failed to fetch design requests:', error);
    } finally {
      setLoading(false);
    }
  }

  async function createRequest(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/design-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          description: newDescription,
          design_type: newType,
        }),
      });

      if (res.ok) {
        setShowNewRequest(false);
        setNewTitle('');
        setNewDescription('');
        setNewType('advert');
        await fetchRequests();
      }
    } catch (error) {
      console.error('Failed to create request:', error);
    } finally {
      setSubmitting(false);
    }
  }

  async function reviewDesign(action: 'approved' | 'rejected' | 'revision_requested') {
    if (!selectedRequest) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/design-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: selectedRequest.id,
          action,
          feedback: reviewFeedback,
        }),
      });

      if (res.ok) {
        setSelectedRequest(null);
        setReviewFeedback('');
        await fetchRequests();
      }
    } catch (error) {
      console.error('Failed to review design:', error);
    } finally {
      setSubmitting(false);
    }
  }

  const statusConfig: Record<string, { class: string; label: string; icon: string }> = {
    pending: { class: 'badge badge-amber', label: 'Pending', icon: '⏳' },
    in_progress: { class: 'badge badge-blue', label: 'In Progress', icon: '🎨' },
    submitted: { class: 'badge badge-purple', label: 'Ready for Review', icon: '👁️' },
    approved: { class: 'badge badge-green', label: 'Approved', icon: '✅' },
    rejected: { class: 'badge badge-red', label: 'Rejected', icon: '❌' },
    revision_requested: { class: 'badge badge-orange', label: 'Revision Needed', icon: '🔧' },
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="page-header">
        <div>
          <span className="section-label">Creative Services</span>
          <h1 className="display text-4xl text-ink-900">Design Requests</h1>
          <p className="text-sm text-ink-900/50 mt-1 max-w-lg">
            Request professional ad designs from our creative team. We'll create, you review and approve.
          </p>
        </div>
        <button
          onClick={() => setShowNewRequest(true)}
          className="btn btn-primary h-11"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Request
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card stat-card-amber">
          <p className="text-xs font-semibold text-ink-900/45 uppercase tracking-wider mb-2">Pending</p>
          <p className="display text-2xl font-extrabold text-amber-600 leading-none">
            {requests.filter(r => ['pending', 'in_progress'].includes(r.status)).length}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold text-ink-900/45 uppercase tracking-wider mb-2">Ready for Review</p>
          <p className="display text-2xl font-extrabold text-purple-600 leading-none">
            {requests.filter(r => r.status === 'submitted').length}
          </p>
        </div>
        <div className="stat-card stat-card-green">
          <p className="text-xs font-semibold text-ink-900/45 uppercase tracking-wider mb-2">Approved</p>
          <p className="display text-2xl font-extrabold text-green-600 leading-none">
            {requests.filter(r => r.status === 'approved').length}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold text-ink-900/45 uppercase tracking-wider mb-2">Total Requests</p>
          <p className="display text-2xl font-extrabold text-ink-900 leading-none">{requests.length}</p>
        </div>
      </div>

      {/* Requests list */}
      <div className="paper overflow-hidden">
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
            <p className="display text-xl text-ink-900/60 mb-1">No design requests yet</p>
            <p className="text-sm text-ink-900/40 max-w-xs mb-4">
              Create your first design request and our team will craft professional ads for your campaigns.
            </p>
            <button onClick={() => setShowNewRequest(true)} className="btn btn-primary">
              Create Design Request
            </button>
          </div>
        ) : (
          <div className="divide-y divide-ink-100">
            {requests.map((r) => (
              <div key={r.id} className="p-5 hover:bg-ink-50/50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-ink-900">{r.title}</h3>
                      <span className={`${statusConfig[r.status]?.class || 'badge'} text-xs`}>
                        {statusConfig[r.status]?.icon} {statusConfig[r.status]?.label || r.status}
                      </span>
                    </div>
                    <p className="text-sm text-ink-900/70 mb-2 line-clamp-2">{r.description}</p>
                    <div className="flex items-center gap-4 text-xs text-ink-900/50">
                      <span className="capitalize">{r.design_type}</span>
                      <span>•</span>
                      <span>Requested {new Date(r.created_at).toLocaleDateString()}</span>
                      {r.campaign && (
                        <>
                          <span>•</span>
                          <span>Campaign: {r.campaign.title}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {r.status === 'submitted' && (
                      <button
                        onClick={() => setSelectedRequest(r)}
                        className="btn btn-primary"
                      >
                        Review Design
                      </button>
                    )}
                    {r.status === 'approved' && r.design_url && (
                      <Link
                        href={`/dashboard/my-campaigns`}
                        className="btn btn-sm btn-secondary"
                      >
                        Use in Campaign
                      </Link>
                    )}
                    <button
                      onClick={() => setSelectedRequest(r)}
                      className="btn btn-sm btn-secondary"
                    >
                      Details
                    </button>
                  </div>
                </div>

                {/* Admin notes preview */}
                {r.admin_notes && (
                  <div className="mt-3 bg-blue-50/50 border border-blue-100 p-3 rounded-lg">
                    <p className="text-xs text-blue-700 font-medium">Admin Note:</p>
                    <p className="text-sm text-blue-900 mt-0.5">{r.admin_notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Request Modal */}
      {showNewRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-ink-100">
              <h2 className="text-xl font-semibold text-ink-900">New Design Request</h2>
              <p className="text-sm text-ink-900/50">Tell us what you need designed</p>
            </div>
            <form onSubmit={createRequest} className="p-6 space-y-4">
              <div>
                <label className="label">Title *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g., Summer Sale Billboard"
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">Design Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="input"
                >
                  <option value="advert">Advertisement</option>
                  <option value="banner">Banner</option>
                  <option value="video">Video Ad</option>
                  <option value="social">Social Media Graphic</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="label">Description *</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Describe what you need: content, style, colors, message, target audience..."
                  className="input h-32 resize-none"
                  required
                />
              </div>
              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewRequest(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !newTitle.trim() || !newDescription.trim()}
                  className="btn btn-primary"
                >
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Design Modal */}
      {selectedRequest?.status === 'submitted' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-ink-100 bg-green-50/30">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-2xl">
                  🎉
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-ink-900">Your Design is Ready!</h2>
                  <p className="text-sm text-ink-900/70">Review and approve or request changes</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Design preview */}
              <div className="bg-ink-50 rounded-xl p-4">
                <label className="label">Design Preview</label>
                {selectedRequest.design_url ? (
                  <div className="space-y-3">
                    <div className="aspect-video bg-ink-100 rounded-lg overflow-hidden border border-ink-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={selectedRequest.design_url}
                        alt="Design preview"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <a
                      href={selectedRequest.design_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-secondary inline-flex items-center gap-2"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      Download Full Resolution
                    </a>
                  </div>
                ) : (
                  <p className="text-sm text-ink-900/50">Design file not available</p>
                )}
              </div>

              {/* Request details */}
              <div>
                <label className="label">Your Original Request</label>
                <div className="bg-ink-50 p-4 rounded-lg">
                  <p className="font-medium text-ink-900">{selectedRequest.title}</p>
                  <p className="text-sm text-ink-900/70 mt-1">{selectedRequest.description}</p>
                </div>
              </div>

              {selectedRequest.admin_notes && (
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg">
                  <label className="label text-blue-700">Message from Design Team</label>
                  <p className="text-sm text-blue-900">{selectedRequest.admin_notes}</p>
                </div>
              )}

              {/* Feedback form */}
              <div>
                <label className="label">Your Feedback (optional)</label>
                <textarea
                  value={reviewFeedback}
                  onChange={(e) => setReviewFeedback(e.target.value)}
                  placeholder="If you need changes, describe them here..."
                  className="input h-24 resize-none"
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="p-6 border-t border-ink-100 bg-ink-50/30">
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => reviewDesign('approved')}
                  disabled={submitting}
                  className="btn btn-primary h-12 text-base"
                >
                  <span className="text-lg mr-2">✅</span>
                  Approve Design — Use This for My Campaign
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => reviewDesign('revision_requested')}
                    disabled={submitting}
                    className="btn btn-amber"
                  >
                    <span className="mr-2">🔧</span>
                    Request Changes
                  </button>
                  <button
                    onClick={() => reviewDesign('rejected')}
                    disabled={submitting}
                    className="btn btn-secondary text-red-600 hover:bg-red-50"
                  >
                    <span className="mr-2">❌</span>
                    Reject Design
                  </button>
                </div>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="btn btn-ghost text-ink-900/50"
                >
                  Close — Review Later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal (non-submitted) */}
      {selectedRequest && selectedRequest.status !== 'submitted' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-ink-100">
              <h2 className="text-xl font-semibold text-ink-900">Request Details</h2>
              <span className={`${statusConfig[selectedRequest.status]?.class || 'badge'} text-xs mt-2 inline-block`}>
                {statusConfig[selectedRequest.status]?.icon} {statusConfig[selectedRequest.status]?.label || selectedRequest.status}
              </span>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Title</label>
                <p className="text-ink-900">{selectedRequest.title}</p>
              </div>
              <div>
                <label className="label">Description</label>
                <p className="text-ink-900/70 text-sm">{selectedRequest.description}</p>
              </div>
              <div>
                <label className="label">Submitted</label>
                <p className="text-ink-900/70 text-sm">
                  {new Date(selectedRequest.created_at).toLocaleString()}
                </p>
              </div>
              {selectedRequest.design_url && (
                <div>
                  <label className="label">Design File</label>
                  <a
                    href={selectedRequest.design_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-sm btn-secondary inline-flex items-center gap-2"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    View Design
                  </a>
                </div>
              )}
              {selectedRequest.admin_notes && (
                <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg">
                  <label className="label text-blue-700">Admin Note</label>
                  <p className="text-sm text-blue-900">{selectedRequest.admin_notes}</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-ink-100">
              <button
                onClick={() => setSelectedRequest(null)}
                className="btn btn-secondary w-full"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
