import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

/**
 * GET /api/admin/adverts
 *
 * Returns all adverts with their assignments to screens/devices.
 * Query params:
 *   - status: 'active' | 'expired' | 'all' (default: 'all')
 *   - location_id: filter by specific location
 *   - device_id: filter by specific device
 *   - date: YYYY-MM-DD to check status for (default: today)
 *
 * Response includes:
 *   - advert details
 *   - customer info
 *   - assigned devices/screens
 *   - assignment status (active/expired/scheduled)
 */
export async function GET(req: NextRequest) {
  const { error: authError } = await requireRole(['admin']);
  if (authError) return authError;

  const admin = supabaseAdmin();
  const { searchParams } = req.nextUrl;

  const statusFilter = searchParams.get('status') || 'all';
  const locationId = searchParams.get('location_id');
  const deviceId = searchParams.get('device_id');
  const dateParam = searchParams.get('date') || new Date().toISOString().slice(0, 10);

  // Build the base query for bookings with all related data
  let query = admin
    .from('bookings')
    .select(`
      id,
      status,
      start_date,
      end_date,
      slots_per_day,
      price,
      device_id,
      location:locations(id, name, description),
      device:devices(id, code, name, active),
      ad:ads(
        id,
        title,
        media_url,
        format,
        duration,
        customer:profiles(id, full_name, email, company_name)
      ),
      campaign:campaigns(id, title, total_price)
    `)
    .order('created_at', { ascending: false });

  // Apply filters
  if (locationId) {
    query = query.eq('location_id', locationId);
  }
  if (deviceId) {
    query = query.eq('device_id', deviceId);
  }

  const { data: bookings, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Process and classify each booking
  const today = new Date(dateParam);
  today.setHours(0, 0, 0, 0);

  const processed = (bookings || []).map((b: any) => {
    const endDate = b.end_date ? new Date(b.end_date) : null;
    if (endDate) endDate.setHours(23, 59, 59, 999);

    let assignmentStatus: 'active' | 'expired' | 'scheduled' | 'unassigned' = 'unassigned';

    if (b.status === 'active' && b.device_id) {
      if (endDate && endDate < today) {
        assignmentStatus = 'expired';
      } else if (new Date(b.start_date) > today) {
        assignmentStatus = 'scheduled';
      } else {
        assignmentStatus = 'active';
      }
    } else if (b.status === 'completed' || (endDate && endDate < today)) {
      assignmentStatus = 'expired';
    } else if (!b.device_id) {
      assignmentStatus = 'unassigned';
    } else {
      assignmentStatus = 'scheduled';
    }

    return {
      booking_id: b.id,
      booking_status: b.status,
      assignment_status: assignmentStatus,
      start_date: b.start_date,
      end_date: b.end_date,
      slots_per_day: b.slots_per_day,
      price: b.price,
      advert: {
        id: b.ad?.id,
        title: b.ad?.title,
        media_url: b.ad?.media_url,
        format: b.ad?.format,
        duration: b.ad?.duration,
      },
      customer: {
        id: b.ad?.customer?.id,
        name: b.ad?.customer?.full_name,
        email: b.ad?.customer?.email,
        company: b.ad?.customer?.company_name,
      },
      location: {
        id: b.location?.id,
        name: b.location?.name,
        description: b.location?.description,
      },
      device: b.device ? {
        id: b.device.id,
        code: b.device.code,
        name: b.device.name,
        active: b.device.active,
      } : null,
      campaign: b.campaign ? {
        id: b.campaign.id,
        title: b.campaign.title,
      } : null,
    };
  });

  // Filter by status if requested
  let filtered = processed;
  if (statusFilter === 'active') {
    filtered = processed.filter(p => p.assignment_status === 'active');
  } else if (statusFilter === 'expired') {
    filtered = processed.filter(p => p.assignment_status === 'expired');
  } else if (statusFilter === 'scheduled') {
    filtered = processed.filter(p => p.assignment_status === 'scheduled');
  } else if (statusFilter === 'unassigned') {
    filtered = processed.filter(p => p.assignment_status === 'unassigned');
  }

  // Get summary stats
  const stats = {
    total: processed.length,
    active: processed.filter(p => p.assignment_status === 'active').length,
    expired: processed.filter(p => p.assignment_status === 'expired').length,
    scheduled: processed.filter(p => p.assignment_status === 'scheduled').length,
    unassigned: processed.filter(p => p.assignment_status === 'unassigned').length,
  };

  return NextResponse.json({
    date: dateParam,
    filter: statusFilter,
    stats,
    count: filtered.length,
    assignments: filtered,
  });
}
