'use client';

import { useEffect, useState, useRef } from 'react';
import { supabaseBrowser } from '@/lib/supabase-browser';

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

export default function CustomerMessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [subject, setSubject] = useState('General Inquiry');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState<{name: string, url: string}[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchMessages();
    fetchUnreadCount();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function fetchMessages() {
    setLoading(true);
    try {
      const res = await fetch('/api/messages');
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchUnreadCount() {
    try {
      const res = await fetch('/api/messages?unread_only=true');
      const data = await res.json();
      setUnreadCount(data.unread_count || 0);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
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
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function removeAttachment(index: number) {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() && attachments.length === 0) return;

    setSending(true);
    try {
      // Send message with first attachment as primary (others in content)
      const attachmentUrl = attachments.length > 0 ? attachments[0].url : null;
      const contentWithAttachments = attachments.length > 1 
        ? `${newMessage}\n\n[Additional attachments: ${attachments.slice(1).map(a => a.name).join(', ')}]`
        : newMessage;

      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: contentWithAttachments,
          subject,
          message_type: 'general',
          attachment_url: attachmentUrl,
        }),
      });

      if (res.ok) {
        setNewMessage('');
        setAttachments([]);
        await fetchMessages();
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

  async function markAllRead() {
    try {
      await fetch('/api/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mark_all_read: true }),
      });
      setUnreadCount(0);
      await fetchMessages();
    } catch (error) {
      console.error('Failed to mark messages read:', error);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="page-header">
        <div>
          <span className="section-label">Communication</span>
          <h1 className="display text-4xl text-ink-900">
            Messages
            {unreadCount > 0 && (
              <span className="ml-3 badge badge-red">{unreadCount} new</span>
            )}
          </h1>
          <p className="text-sm text-ink-900/50 mt-1">
            Communicate directly with the RareVision team. Ask questions, request design services, or get support.
          </p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="btn btn-secondary h-11">
            Mark all read
          </button>
        )}
      </div>

      <div className="paper overflow-hidden flex flex-col h-[calc(100vh-300px)] min-h-[500px]">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-full text-ink-900/50">
              Loading messages...
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-brand-soft flex items-center justify-center mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brand">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <p className="text-ink-900/60 font-medium">No messages yet</p>
              <p className="text-sm text-ink-900/40 mt-1 max-w-xs">
                Start a conversation with our team. We're here to help with your campaigns and design needs.
              </p>
            </div>
          ) : (
            <>
              {messages.slice().reverse().map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.is_from_customer ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] rounded-2xl px-5 py-3 ${
                    m.is_from_customer
                      ? 'bg-brand text-white rounded-br-none'
                      : 'bg-ink-100 text-ink-900 rounded-bl-none'
                  } ${!m.is_read && !m.is_from_customer ? 'ring-2 ring-brand/30' : ''}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium opacity-70">
                        {m.is_from_customer ? 'You' : 'RareVision Team'}
                      </span>
                      <span className="text-xs opacity-50">
                        {new Date(m.created_at).toLocaleString()}
                      </span>
                      {m.message_type === 'design_request' && (
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          m.is_from_customer ? 'bg-white/20' : 'bg-brand/20 text-brand'
                        }`}>
                          Design
                        </span>
                      )}
                    </div>
                    <p className="text-sm">{m.content}</p>
                    {m.attachment_url && (
                      <a
                        href={m.attachment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`text-xs underline mt-2 block ${
                          m.is_from_customer ? 'text-white/80' : 'text-brand'
                        }`}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline mr-1">
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                        </svg>
                        View Attachment
                      </a>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Compose area */}
        <div className="border-t border-ink-100 bg-ink-50/50 p-6">
          <form onSubmit={sendMessage} className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="label text-xs">Subject</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="input h-10 text-sm"
                >
                  <option value="General Inquiry">General Inquiry</option>
                  <option value="Design Request">Design Request</option>
                  <option value="Campaign Support">Campaign Support</option>
                  <option value="Billing Question">Billing Question</option>
                  <option value="Technical Issue">Technical Issue</option>
                </select>
              </div>
            </div>
            
            {/* Attachments preview */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
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
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message here... (Press Enter to send, Shift+Enter for new line)"
                className="input flex-1 resize-none h-24"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(e);
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
                  disabled={sending || (!newMessage.trim() && attachments.length === 0)}
                  className="btn btn-primary h-12 px-6"
                >
                {sending ? (
                  'Sending...'
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2">
                      <line x1="22" y1="2" x2="11" y2="13"/>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                    Send
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
