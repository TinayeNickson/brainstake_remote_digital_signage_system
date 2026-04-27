import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';

const schema = z.object({
  booking_id: z.string().uuid(),
  device_id: z.string().uuid().nullable(),
});

export async function POST(req: NextRequest) {
  const { supabase, error } = await requireRole(['admin']);
  if (error || !supabase) return error;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }
  const { booking_id, device_id } = parsed.data;

  // verify booking is active and device's location matches (if device provided)
  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .select('id, status, location_id')
    .eq('id', booking_id)
    .single();
  if (bErr || !booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  if (booking.status !== 'active') {
    return NextResponse.json({ error: 'Booking is not active' }, { status: 409 });
  }

  if (device_id) {
    const { data: device, error: dErr } = await supabase
      .from('devices')
      .select('id, location_id, active')
      .eq('id', device_id)
      .single();
    if (dErr || !device) return NextResponse.json({ error: 'Device not found' }, { status: 404 });
  }

  const { data, error: uErr } = await supabase
    .from('bookings')
    .update({ device_id })
    .eq('id', booking_id)
    .select()
    .single();
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 400 });

  return NextResponse.json({ booking: data });
}
