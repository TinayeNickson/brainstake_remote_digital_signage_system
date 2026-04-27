import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const { supabase, error } = await requireUser();
  if (error || !supabase) return error;

  const sp = req.nextUrl.searchParams;
  const locationId = sp.get('location_id');
  const start = sp.get('start');
  const end = sp.get('end');
  if (!locationId || !start || !end) {
    return NextResponse.json({ error: 'location_id, start, end required' }, { status: 400 });
  }

  const { data, error: rpcErr } = await supabase.rpc('location_daily_availability', {
    p_location_id: locationId,
    p_start: start,
    p_end: end,
  });
  if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 400 });
  return NextResponse.json({ availability: data });
}
