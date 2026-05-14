'use client';

import { useEffect, useState, useRef } from 'react';
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

export default function AdminMessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [customer, setCustomer] = useState<{ id: string; full_name: string; email: string; company_name: string } | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState<{name: string, url: string}[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch conversations list
  useEffect(() => {
    fetchConversations();
  }, []);

  // Fetch messages when customer selected
  useEffect(() => {
    if (selectedCustomerId) {
      fetchMessages(selectedCustomerId);
    }
  }, [selectedCustomerId]);

  // Auto-scroll to bottom
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
      // Update unread count in conversations
      setConversations(prev => prev.map(c => 
        c.customer_id === customerId ? { ...c, unread_count: 0 } : c
      ));
    } catch (error) {
      console.error('Failed to fetch messages:', error);
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
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

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
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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

  const unreadTotal = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="page-header">
        <div>
          <span className="section-label">Admin Portal</span>
          <h1 className="display text-4xl text-ink-900">
            Messages
            {unreadTotal > 0 && (
              <span className="ml-3 badge badge-red">{unreadTotal} unread</span>
            )}
          </h1>
          <p className="text-sm text-ink-900/50 mt-1">
            Communicate with customers about their campaigns, design requests, and support inquiries.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-[320px_1fr] gap-4 h-[calc(100vh-280px)] min-h-[500px]">
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
              <div className="p-4 border-b border-ink-100 flex items-center justify-between bg-ink-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-soft flex items-center justify-center">
                    <span className="text-sm font-semibold text-brand">
                      {customer?.full_name?.charAt(0) || customer?.email?.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-ink-900">{customer?.full_name || customer?.email}</p>
                    <p className="text-xs text-ink-900/50">{customer?.company_name || 'Individual'}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCustomerId(null)}
                  className="text-xs text-ink-900/50 hover:text-ink-900"
                >
                  Close
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center text-sm text-ink-900/50 py-8">
                    No messages yet. Start the conversation below.
                  </div>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.is_from_customer ? 'justify-start' : 'justify-end'}`}
                    >
                      <div className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                        m.is_from_customer
                          ? 'bg-ink-100 text-ink-900 rounded-bl-none'
                          : 'bg-brand text-white rounded-br-none'
                      }`}>
                        <p className="text-xs opacity-70 mb-1">
                          {m.is_from_customer ? 'Customer' : 'You'} • {new Date(m.created_at).toLocaleString()}
                        </p>
                        <p className="text-sm">{m.content}</p>
                        {m.attachment_url && (
                          <a
                            href={m.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`text-xs underline mt-2 block ${
                              m.is_from_customer ? 'text-ink-700' : 'text-white/80'
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
                {/* Attachments preview */}
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {attachments.map((att, i) => (
                      <div key={i} className="flex items-center gap-2 bg-white border border-ink-200 rounded-lg px-3 py-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-ink-500">
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                        </svg>
                        <span className="text-sm text-ink-700 truncate max-w-[150px]">{att.name}</span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(i)}
                          className="text-ink-400 hover:text-red-500"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
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
                    {/* File upload button */}
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
    </div>
  );
}
