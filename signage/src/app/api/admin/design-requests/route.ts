import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

/**
 * GET /api/admin/design-requests?status=<status>
 *
 * Returns all design requests with customer info.
 * Status filter: pending, in_progress, submitted, approved, rejected, all
 */
export async function GET(req: NextRequest) {
  const { error: authError } = await requireRole(['admin']);
  if (authError) return authError;

  const admin = supabaseAdmin();
  const statusFilter = req.nextUrl.searchParams.get('status') || 'all';

  let query = admin
    .from('design_requests')
    .select(`
      *,
      customer:customer_id(id, full_name, email, company_name, phone),
      campaign:campaign_id(id, title),
      ad:ad_id(id, title, media_url, format)
    `)
    .order('created_at', { ascending: false });

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get stats
  const { data: stats } = await admin
    .from('design_requests')
    .select('status', { count: 'exact' });

  const statusCounts = {
    total: stats?.length || 0,
    pending: stats?.filter(s => s.status === 'pending').length || 0,
    in_progress: stats?.filter(s => s.status === 'in_progress').length || 0,
    submitted: stats?.filter(s => s.status === 'submitted').length || 0,
    approved: stats?.filter(s => s.status === 'approved').length || 0,
    rejected: stats?.filter(s => s.status === 'rejected').length || 0,
    revision_requested: stats?.filter(s => s.status === 'revision_requested').length || 0,
  };

  return NextResponse.json({
    filter: statusFilter,
    stats: statusCounts,
    requests: data || [],
  });
}

/**
 * PATCH /api/admin/design-requests
 *
 * Update design request status and upload design.
 */
export async function PATCH(req: NextRequest) {
  const { user, error: authError } = await requireRole(['admin']);
  if (authError || !user) return authError;

  const admin = supabaseAdmin();
  const body = await req.json().catch(() => ({}));

  const { request_id, status, design_url, admin_notes } = body;

  if (!request_id || !status) {
    return NextResponse.json(
      { error: 'request_id and status are required' },
      { status: 400 }
    );
  }

  const { data: existing } = await admin
    .from('design_requests')
    .select('*')
    .eq('id', request_id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Design request not found' }, { status: 404 });
  }

  const updates: any = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (design_url) updates.design_url = design_url;
  if (admin_notes) updates.admin_notes = admin_notes;
  if (status === 'submitted') updates.submitted_at = new Date().toISOString();

  const { data, error } = await admin
    .from('design_requests')
    .update(updates)
    .eq('id', request_id)
    .select(`
      *,
      customer:customer_id(id, full_name, email)
    `)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Send notification message to customer
  const messageContent = status === 'submitted'
    ? `Your design request "${existing.title}" is ready for review! Please check your design requests to approve or request revisions.`
    : `Your design request "${existing.title}" status has been updated to: ${status}.`;

  await admin
    .from('messages')
    .insert({
      sender_id: user.id,
      recipient_id: existing.customer_id,
      subject: status === 'submitted' ? 'Your Design is Ready!' : 'Design Request Update',
      content: messageContent,
      message_type: 'design_review',
      is_from_customer: false,
      is_read: false,
    });

  return NextResponse.json({
    success: true,
    request: data,
  });
}
