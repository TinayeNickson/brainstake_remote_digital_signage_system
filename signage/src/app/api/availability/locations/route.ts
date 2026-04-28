import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const { supabase, error } = await requireUser();
  if (error || !supabase) return error;

  const sp = req.nextUrl.searchParams;
  const start = sp.get('start');
  const end = sp.get('end');
  
  if (!start || !end) {
    return NextResponse.json({ error: 'start and end dates required' }, { status: 400 });
  }

  // Fetch all active locations first
  const { data: locations, error: locErr } = await supabase
    .from('locations')
    .select('id, max_slots_per_day')
    .eq('active', true);

  if (locErr) {
    return NextResponse.json({ error: locErr.message }, { status: 500 });
  }

  // Fetch availability for each location
  const availability: Record<string, { max_slots: number; min_available: number; booked: number }> = {};

  for (const loc of locations || []) {
    const { data, error: rpcErr } = await supabase.rpc('location_daily_availability', {
      p_location_id: loc.id,
      p_start: start,
      p_end: end,
    });

    if (rpcErr) {
      return NextResponse.json({ error: rpcErr.message }, { status: 500 });
    }

    // Calculate minimum available slots across all days in the range
    // and total booked slots (average per day)
    const rows = data || [];
    const minAvailable = rows.length > 0 
      ? Math.min(...rows.map((r: any) => r.available))
      : loc.max_slots_per_day;
    const totalBooked = rows.reduce((sum: number, r: any) => sum + r.booked, 0);
    const avgBooked = rows.length > 0 ? Math.round(totalBooked / rows.length) : 0;

    availability[loc.id] = {
      max_slots: loc.max_slots_per_day,
      min_available: Math.max(0, minAvailable),
      booked: avgBooked,
    };
  }

  return NextResponse.json({ availability });
}
