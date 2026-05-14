import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

/**
 * GET /api/messages
 *
 * Returns the current user's messages (as customer).
 * Query param: unread_only=true to get only unread count
 */
export async function GET(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const unreadOnly = req.nextUrl.searchParams.get('unread_only') === 'true';

  // Get unread count
  if (unreadOnly) {
    const { data: count, error } = await supabase
      .rpc('get_unread_count', { p_user_id: user.id });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ unread_count: count || 0 });
  }

  // Get all messages for this customer
  // This includes messages they sent + messages sent to them + admin replies to their messages
  const { data: messages, error } = await supabase
    .from('messages')
    .select(`
      id,
      content,
      subject,
      message_type,
      attachment_url,
      is_read,
      is_from_customer,
      created_at,
      sender:sender_id(id, full_name, email),
      recipient:recipient_id(id, full_name, email),
      campaign:campaign_id(id, title)
    `)
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Mark admin messages as read
  await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('recipient_id', user.id)
    .eq('is_read', false);

  return NextResponse.json({
    messages: messages || [],
  });
}

/**
 * POST /api/messages
 *
 * Send a message to admin.
 */
export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { content, subject = 'General Inquiry', message_type = 'general', campaign_id, attachment_url } = body;

  if (!content) {
    return NextResponse.json(
      { error: 'content is required' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      sender_id: user.id,
      recipient_id: null, // null = to admin
      campaign_id,
      subject,
      content,
      message_type,
      attachment_url,
      is_from_customer: true,
      is_read: false,
    })
    .select('id, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: 'Message sent to admin',
    id: data.id,
  });
}

/**
 * PATCH /api/messages
 *
 * Mark messages as read.
 */
export async function PATCH(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { mark_all_read = true } = body;

  if (mark_all_read) {
    const { error } = await supabase
      .rpc('mark_messages_read', { p_user_id: user.id });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
