import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

/**
 * GET /api/design-requests
 *
 * Returns the current user's design requests.
 */
export async function GET(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const statusFilter = req.nextUrl.searchParams.get('status') || 'all';

  let query = supabase
    .from('design_requests')
    .select(`
      *,
      campaign:campaign_id(id, title, start_date, end_date),
      ad:ad_id(id, title, media_url, format)
    `)
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false });

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    requests: data || [],
  });
}

/**
 * POST /api/design-requests
 *
 * Create a new design request.
 */
export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    title,
    description,
    design_type = 'advert',
    campaign_id,
    ad_id,
  } = body;

  if (!title || !description) {
    return NextResponse.json(
      { error: 'title and description are required' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('design_requests')
    .insert({
      customer_id: user.id,
      campaign_id,
      ad_id,
      title,
      description,
      design_type,
      status: 'pending',
    })
    .select('id, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also send a message to admin about the new design request
  await supabase
    .from('messages')
    .insert({
      sender_id: user.id,
      recipient_id: null,
      subject: `New Design Request: ${title}`,
      content: `A new design request has been submitted: "${title}". Please review and start the design process.`,
      message_type: 'design_request',
      is_from_customer: true,
      is_read: false,
    });

  return NextResponse.json({
    message: 'Design request submitted',
    id: data.id,
  });
}

/**
 * PATCH /api/design-requests
 *
 * Customer reviews and approves/rejects a submitted design.
 */
export async function PATCH(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { request_id, action, feedback } = body;

  if (!request_id || !action) {
    return NextResponse.json(
      { error: 'request_id and action are required' },
      { status: 400 }
    );
  }

  if (!['approved', 'rejected', 'revision_requested'].includes(action)) {
    return NextResponse.json(
      { error: 'action must be approved, rejected, or revision_requested' },
      { status: 400 }
    );
  }

  // Verify the request belongs to this customer and is in 'submitted' status
  const { data: existing } = await supabase
    .from('design_requests')
    .select('*')
    .eq('id', request_id)
    .eq('customer_id', user.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Design request not found' }, { status: 404 });
  }

  if (existing.status !== 'submitted') {
    return NextResponse.json(
      { error: 'Can only review designs that are submitted' },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from('design_requests')
    .update({
      status: action,
      customer_feedback: feedback || '',
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', request_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Notify admin of customer decision
  const notificationMessage = action === 'approved'
    ? `Design request "${existing.title}" has been APPROVED by the customer!`
    : action === 'revision_requested'
    ? `Design request "${existing.title}" needs REVISIONS. Customer feedback: ${feedback}`
    : `Design request "${existing.title}" was rejected. Customer feedback: ${feedback}`;

  await supabase
    .from('messages')
    .insert({
      sender_id: user.id,
      recipient_id: null,
      subject: `Design ${action}: ${existing.title}`,
      content: notificationMessage,
      message_type: 'design_review',
      is_from_customer: true,
      is_read: false,
    });

  return NextResponse.json({
    success: true,
    status: action,
    request: data,
  });
}
