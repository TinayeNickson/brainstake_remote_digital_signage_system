'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase-browser';

interface Conversation {
  customer_id: string;
  customer_name: string;
  customer_email: string;
  last_message_at: string;
  unread_count: number;
  last_message_preview: string;
}

interface Message {
  id: string;
  content: string;
  subject: string;
  message_type: string;
  attachment_url: string | null;
  is_read: boolean;
  is_from_customer: boolean;
  created_at: string;
  sender: { id: string; full_name: string; email: string } | null;
  recipient: { id: string; full_name: string; email: string } | null;
  campaign: { id: string; title: string } | null;
}

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
  customer: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  messages?: Message[];
}

function CommunicationHubContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'designs' ? 'designs' : 'messages';
  
  const [activeTab, setActiveTab] = useState<'messages' | 'designs'>(initialTab);
  
  // Messages state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [customer, setCustomer] = useState<{ id: string; full_name: string; email: string; company_name: string } | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState<{name: string, url: string}[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Design requests state
  const [designRequests, setDesignRequests] = useState<DesignRequest[]>([]);
  const [selectedDesign, setSelectedDesign] = useState<DesignRequest | null>(null);
  const [designFilter, setDesignFilter] = useState('all');
  const [adminNotes, setAdminNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Common state
  const [loading, setLoading] = useState(true);

  // Fetch data
  useEffect(() => {
    fetchConversations();
    fetchDesignRequests();
  }, []);

  useEffect(() => {
    if (selectedCustomerId && activeTab === 'messages') {
      fetchMessages(selectedCustomerId);
    }
  }, [selectedCustomerId, activeTab]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function fetchConversations() {
    try {
      const res = await fetch('/api/admin/messages');
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchMessages(customerId: string) {
    try {
      const res = await fetch(`/api/admin/messages?customer_id=${customerId}`);
      const data = await res.json();
      setMessages(data.messages || []);
      setCustomer(data.customer || null);
      setConversations(prev => prev.map(c => 
        c.customer_id === customerId ? { ...c, unread_count: 0 } : c
      ));
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  }

  async function fetchDesignRequests() {
    try {
      const res = await fetch('/api/admin/design-requests');
      const data = await res.json();
      setDesignRequests(data.requests || []);
    } catch (error) {
      console.error('Failed to fetch design requests:', error);
    }
  }

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const supabase = supabaseBrowser();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('message-attachments')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('message-attachments')
        .getPublicUrl(fileName);

      setAttachments(prev => [...prev, { name: file.name, url: publicUrl }]);
      return publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      if (file.size > 10 * 1024 * 1024) {
        alert(`File ${file.name} is too large. Max size is 10MB.`);
        return;
      }
      uploadFile(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeAttachment(index: number) {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCustomerId || (!replyContent.trim() && attachments.length === 0)) return;

    setSending(true);
    try {
      const attachmentUrl = attachments.length > 0 ? attachments[0].url : null;
      const contentWithAttachments = attachments.length > 1 
        ? `${replyContent}\n\n[Additional attachments: ${attachments.slice(1).map(a => a.name).join(', ')}]`
        : replyContent;

      const res = await fetch('/api/admin/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: selectedCustomerId,
          content: contentWithAttachments,
          subject: 'Re: Your Message',
          attachment_url: attachmentUrl,
        }),
      });

      if (res.ok) {
        setReplyContent('');
        setAttachments([]);
        await fetchMessages(selectedCustomerId);
        await fetchConversations();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  }

  async function updateDesignStatus(requestId: string, status: string, notes?: string) {
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/design-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: requestId,
          status,
          admin_notes: notes,
        }),
      });

      if (res.ok) {
        setSelectedDesign(null);
        setAdminNotes('');
        await fetchDesignRequests();
      }
    } catch (error) {
      console.error('Failed to update design:', error);
    } finally {
      setSubmitting(false);
    }
  }

  const unreadTotal = conversations.reduce((sum, c) => sum + c.unread_count, 0);
  const pendingDesigns = designRequests.filter(d => ['pending', 'in_progress', 'submitted'].includes(d.status)).length;

  const filteredDesigns = designFilter === 'all' 
    ? designRequests 
    : designRequests.filter(d => d.status === designFilter);

  const statusConfig: Record<string, { class: string; label: string; icon: string }> = {
    pending: { class: 'badge badge-amber', label: 'Pending', icon: '⏳' },
    in_progress: { class: 'badge badge-blue', label: 'In Progress', icon: '🎨' },
    submitted: { class: 'badge badge-purple', label: 'Ready for Review', icon: '👁️' },
    approved: { class: 'badge badge-green', label: 'Approved', icon: '✅' },
    rejected: { class: 'badge badge-red', label: 'Rejected', icon: '❌' },
    revision_requested: { class: 'badge badge-orange', label: 'Revision Needed', icon: '🔧' },
  };

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="page-header">
        <div>
          <span className="section-label">Admin Portal</span>
          <h1 className="display text-4xl text-ink-900">Communication Hub</h1>
          <p className="text-sm text-ink-900/50 mt-1 max-w-lg">
            Unified messaging and design request management. Communicate with customers and track design workflows.
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-ink-200">
        <button
          onClick={() => { setActiveTab('messages'); setSelectedDesign(null); }}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'messages' 
              ? 'border-brand text-brand' 
              : 'border-transparent text-ink-500 hover:text-ink-900'
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Messages
          {unreadTotal > 0 && (
            <span className="badge badge-red text-xs ml-1">{unreadTotal}</span>
          )}
        </button>
        <button
          onClick={() => { setActiveTab('designs'); setSelectedCustomerId(null); }}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'designs' 
              ? 'border-brand text-brand' 
              : 'border-transparent text-ink-500 hover:text-ink-900'
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
          </svg>
          Design Requests
          {pendingDesigns > 0 && (
            <span className="badge badge-amber text-xs ml-1">{pendingDesigns}</span>
          )}
        </button>
      </div>

      {/* MESSAGES TAB */}
      {activeTab === 'messages' && (
        <div className="grid grid-cols-[320px_1fr] gap-4 h-[calc(100vh-320px)] min-h-[500px]">
          {/* Conversations sidebar */}
          <div className="paper overflow-hidden flex flex-col">
            <div className="p-4 border-b border-ink-100 bg-ink-50/50">
              <h3 className="font-semibold text-ink-900">Conversations</h3>
              <p className="text-xs text-ink-900/50">{conversations.length} customers</p>
            </div>
            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="p-4 text-center text-sm text-ink-900/50">Loading...</div>
              ) : conversations.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-ink-900/50">No messages yet</p>
                </div>
              ) : (
                <div className="divide-y divide-ink-100">
                  {conversations.map((c) => (
                    <button
                      key={c.customer_id}
                      onClick={() => setSelectedCustomerId(c.customer_id)}
                      className={`w-full p-4 text-left hover:bg-ink-50 transition-colors ${
                        selectedCustomerId === c.customer_id ? 'bg-brand-soft/50' : ''
                      } ${c.unread_count > 0 ? 'bg-blue-50/30' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-ink-200 flex items-center justify-center shrink-0">
                          <span className="text-sm font-semibold text-ink-700">
                            {c.customer_name?.charAt(0) || c.customer_email.charAt(0)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm text-ink-900 truncate">
                              {c.customer_name || c.customer_email}
                            </p>
                            {c.unread_count > 0 && (
                              <span className="badge badge-red text-xs">{c.unread_count}</span>
                            )}
                          </div>
                          <p className="text-xs text-ink-900/60 truncate mt-0.5">
                            {c.last_message_preview}
                          </p>
                          <p className="text-xs text-ink-900/40 mt-1">
                            {new Date(c.last_message_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Chat area */}
          <div className="paper overflow-hidden flex flex-col">
            {!selectedCustomerId ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-ink-100 flex items-center justify-center mx-auto mb-4">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink-400">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                  </div>
                  <p className="text-ink-900/60 font-medium">Select a conversation</p>
                  <p className="text-sm text-ink-900/40 mt-1">Choose a customer to view messages</p>
                </div>
              </div>
            ) : (
              <>
                {/* Chat header */}
                <div className="p-4 border-b border-ink-100 bg-ink-50/50 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-ink-900">{customer?.full_name || customer?.email}</h3>
                    {customer?.company_name && (
                      <p className="text-xs text-ink-900/50">{customer.company_name}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setActiveTab('designs')}
                    className="btn btn-sm btn-secondary"
                  >
                    View Design Requests
                  </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.length === 0 ? (
                    <div className="text-center text-sm text-ink-900/50 py-8">No messages yet</div>
                  ) : (
                    messages.map((m) => (
                      <div
                        key={m.id}
                        className={`flex ${m.is_from_customer ? 'justify-start' : 'justify-end'}`}
                      >
                        <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                          m.is_from_customer
                            ? 'bg-ink-100 text-ink-900 rounded-bl-none'
                            : 'bg-brand text-white rounded-br-none'
                        }`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium opacity-70">
                              {m.is_from_customer 
                                ? (m.sender?.full_name || 'Customer')
                                : 'You (Admin)'}
                            </span>
                            <span className="text-xs opacity-50">
                              {new Date(m.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                          {m.attachment_url && (
                            <a
                              href={m.attachment_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`text-xs underline mt-2 block ${
                                m.is_from_customer ? 'text-brand' : 'text-white/80'
                              }`}
                            >
                              📎 View Attachment
                            </a>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply form */}
                <form onSubmit={sendReply} className="p-4 border-t border-ink-100 bg-ink-50/50">
                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {attachments.map((att, i) => (
                        <div key={i} className="flex items-center gap-2 bg-white border border-ink-200 rounded-lg px-3 py-2">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-ink-500">
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                          </svg>
                          <span className="text-sm text-ink-700 truncate max-w-[150px]">{att.name}</span>
                          <button type="button" onClick={() => removeAttachment(i)} className="text-ink-400 hover:text-red-500">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-3">
                    <textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder="Type your message..."
                      className="input flex-1 resize-none h-20"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendReply(e);
                        }
                      }}
                    />
                    <div className="flex flex-col gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        className="hidden"
                        multiple
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,video/*,audio/*"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="btn btn-secondary h-10 px-3"
                        title="Attach files"
                      >
                        {uploading ? (
                          <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                          </svg>
                        )}
                      </button>
                      <button
                        type="submit"
                        disabled={sending || (!replyContent.trim() && attachments.length === 0)}
                        className="btn btn-primary h-11 px-4"
                      >
                        {sending ? 'Sending...' : 'Send'}
                      </button>
                    </div>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* DESIGN REQUESTS TAB */}
      {activeTab === 'designs' && (
        <div className="space-y-4">
          {/* Filter tabs */}
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'all', label: 'All Requests', count: designRequests.length },
              { key: 'pending', label: 'Pending', count: designRequests.filter(d => d.status === 'pending').length },
              { key: 'in_progress', label: 'In Progress', count: designRequests.filter(d => d.status === 'in_progress').length },
              { key: 'submitted', label: 'Ready for Review', count: designRequests.filter(d => d.status === 'submitted').length },
            ].map((filter) => (
              <button
                key={filter.key}
                onClick={() => setDesignFilter(filter.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  designFilter === filter.key
                    ? 'bg-brand text-white'
                    : 'bg-ink-100 text-ink-700 hover:bg-ink-200'
                }`}
              >
                {filter.label}
                {filter.count > 0 && (
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                    designFilter === filter.key ? 'bg-white/20' : 'bg-white'
                  }`}>
                    {filter.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Design requests list */}
          <div className="paper overflow-hidden">
            {filteredDesigns.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-ink-100 flex items-center justify-center mx-auto mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-ink-400">
                    <path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
                  </svg>
                </div>
                <p className="text-ink-900/60 font-medium">No design requests found</p>
                <p className="text-sm text-ink-900/40 mt-1">
                  {designFilter === 'all' ? 'Design requests will appear here when customers submit them.' : `No ${designFilter.replace('_', ' ')} requests.`}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-ink-100">
                {filteredDesigns.map((request) => (
                  <div key={request.id} className="p-5 hover:bg-ink-50/50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-ink-900">{request.title}</h3>
                          <span className={`${statusConfig[request.status]?.class || 'badge'} text-xs`}>
                            {statusConfig[request.status]?.icon} {statusConfig[request.status]?.label || request.status}
                          </span>
                        </div>
                        <p className="text-sm text-ink-900/70 mb-3 line-clamp-2">{request.description}</p>
                        <div className="flex items-center gap-4 text-xs text-ink-900/50">
                          <span className="capitalize">{request.design_type}</span>
                          <span>•</span>
                          <span>{request.customer?.full_name || request.customer?.email || 'Unknown'}</span>
                          <span>•</span>
                          <span>Requested {new Date(request.created_at).toLocaleDateString()}</span>
                        </div>
                        {request.admin_notes && (
                          <div className="mt-3 bg-blue-50/50 border border-blue-100 p-3 rounded-lg">
                            <p className="text-xs text-blue-700 font-medium">Admin Note:</p>
                            <p className="text-sm text-blue-900 mt-0.5">{request.admin_notes}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        {request.status === 'pending' && (
                          <button
                            onClick={() => updateDesignStatus(request.id, 'in_progress')}
                            disabled={submitting}
                            className="btn btn-primary"
                          >
                            Start Work
                          </button>
                        )}
                        {request.status === 'in_progress' && (
                          <button
                            onClick={() => setSelectedDesign(request)}
                            className="btn btn-primary"
                          >
                            Submit Design
                          </button>
                        )}
                        {request.status === 'submitted' && (
                          <button
                            onClick={() => setSelectedDesign(request)}
                            className="btn btn-secondary"
                          >
                            View / Manage
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedDesign(request)}
                          className="btn btn-sm btn-secondary"
                        >
                          Details
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Design Detail/Submit Modal */}
      {selectedDesign && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-ink-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-ink-900">{selectedDesign.title}</h2>
                  <span className={`${statusConfig[selectedDesign.status]?.class || 'badge'} text-xs mt-2 inline-block`}>
                    {statusConfig[selectedDesign.status]?.label || selectedDesign.status}
                  </span>
                </div>
                <button onClick={() => setSelectedDesign(null)} className="text-ink-400 hover:text-ink-900">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Customer</label>
                <p className="text-ink-900">{selectedDesign.customer?.full_name || selectedDesign.customer?.email}</p>
              </div>
              <div>
                <label className="label">Description</label>
                <p className="text-ink-900/70 text-sm">{selectedDesign.description}</p>
              </div>

              {/* Design preview for submitted/review states */}
              {selectedDesign.design_url && (
                <div className="bg-ink-50 rounded-xl p-4">
                  <label className="label">Design Preview</label>
                  <div className="aspect-video bg-ink-100 rounded-lg overflow-hidden border border-ink-200 mt-2">
                    <img src={selectedDesign.design_url} alt="Design" className="w-full h-full object-contain" />
                  </div>
                  <a
                    href={selectedDesign.design_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-sm btn-secondary inline-flex items-center gap-2 mt-3"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Download
                  </a>
                </div>
              )}

              {/* Admin notes */}
              <div>
                <label className="label">Admin Notes</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes or feedback..."
                  className="input h-24 resize-none"
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="p-6 border-t border-ink-100 bg-ink-50/30">
              {selectedDesign.status === 'in_progress' ? (
                <div className="flex gap-3">
                  <button
                    onClick={() => updateDesignStatus(selectedDesign.id, 'submitted', adminNotes)}
                    disabled={submitting || !selectedDesign.design_url}
                    className="btn btn-primary flex-1"
                  >
                    Mark as Ready for Review
                  </button>
                  <button onClick={() => setSelectedDesign(null)} className="btn btn-secondary">
                    Close
                  </button>
                </div>
              ) : selectedDesign.status === 'submitted' ? (
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => updateDesignStatus(selectedDesign.id, 'approved', adminNotes)}
                    disabled={submitting}
                    className="btn btn-primary"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => updateDesignStatus(selectedDesign.id, 'revision_requested', adminNotes)}
                    disabled={submitting}
                    className="btn btn-amber"
                  >
                    Request Changes
                  </button>
                  <button onClick={() => setSelectedDesign(null)} className="btn btn-secondary">
                    Close
                  </button>
                </div>
              ) : (
                <button onClick={() => setSelectedDesign(null)} className="btn btn-secondary w-full">
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CommunicationHubPage() {
  return (
    <Suspense fallback={
      <div className="space-y-5">
        <div className="page-header">
          <div>
            <span className="section-label">Admin Portal</span>
            <h1 className="display text-4xl text-ink-900">Communication Hub</h1>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-ink-500">Loading...</div>
        </div>
      </div>
    }>
      <CommunicationHubContent />
    </Suspense>
  );
}
