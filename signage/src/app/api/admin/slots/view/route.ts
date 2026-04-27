import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

/**
 * GET /api/admin/slots/view?device_id=<uuid>&date=<YYYY-MM-DD>
 *
 * Returns today's slot assignments for a device for the visual distribution chart.
 */
export async function GET(req: NextRequest) {
  const admin     = supabaseAdmin();
  const device_id = req.nextUrl.searchParams.get('device_id');
  const date      = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);

  if (!device_id) {
    return NextResponse.json({ error: 'device_id required' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('ad_slot_assignments')
    .select('slot_index, booking_id, bookings(ads(title))')
    .eq('device_id', device_id)
    .eq('scheduled_date', date)
    .order('slot_index');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const slots = (data ?? []).map((row: any) => ({
    slot_index:  row.slot_index,
    booking_id:  row.booking_id,
    title:       row.bookings?.ads?.title ?? 'Unknown',
  }));

  return NextResponse.json({ device_id, date, slots });
}
