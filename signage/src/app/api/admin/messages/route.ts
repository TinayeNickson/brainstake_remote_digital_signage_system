import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

/**
 * GET /api/admin/messages?customer_id=<uuid>
 *
 * Returns messages for a specific customer conversation.
 * If no customer_id provided, returns all conversations summary.
 */
export async function GET(req: NextRequest) {
  const { error: authError } = await requireRole(['admin']);
  if (authError) return authError;

  const admin = supabaseAdmin();
  const customerId = req.nextUrl.searchParams.get('customer_id');

  // If customer_id provided, get full conversation
  if (customerId) {
    const { data: messages, error } = await admin
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
      .or(`sender_id.eq.${customerId},recipient_id.eq.${customerId}`)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get customer details
    const { data: customer } = await admin
      .from('profiles')
      .select('id, full_name, email, company_name, account_type')
      .eq('id', customerId)
      .single();

    // Mark messages as read (from customer to admin)
    await admin
      .from('messages')
      .update({ is_read: true })
      .eq('sender_id', customerId)
      .eq('is_read', false);

    return NextResponse.json({
      customer,
      messages: messages || [],
    });
  }

  // Otherwise return all conversations summary
  const { data: conversations, error } = await admin
    .rpc('get_admin_conversations');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    conversations: conversations || [],
  });
}

/**
 * POST /api/admin/messages
 *
 * Send a message to a customer.
 */
export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireRole(['admin']);
  if (authError || !user) return authError;

  const admin = supabaseAdmin();
  const body = await req.json().catch(() => ({}));

  const { customer_id, content, subject = 'Re: Your Inquiry', message_type = 'general', attachment_url, campaign_id } = body;

  if (!customer_id || !content) {
    return NextResponse.json(
      { error: 'customer_id and content are required' },
      { status: 400 }
    );
  }

  const { data, error } = await admin
    .from('messages')
    .insert({
      sender_id: user.id,
      recipient_id: customer_id,
      campaign_id,
      subject,
      content,
      message_type,
      attachment_url,
      is_from_customer: false,
      is_read: false,
    })
    .select('id, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: 'Message sent',
    id: data.id,
  });
}
