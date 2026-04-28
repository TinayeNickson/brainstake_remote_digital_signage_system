import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

const schema = z.object({
  booking_id: z.string().uuid(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const { error, user, role } = await requireRole(['admin']);
  console.log('Auth check:', { user: user?.id, role, hasError: !!error });
  if (error) {
    console.error('Auth failed:', error);
    return error;
  }

  const body = await req.json().catch(() => null);
  console.log('Date update request body:', body);

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    console.error('Schema validation failed:', parsed.error.flatten());
    return NextResponse.json({ error: 'Invalid input', detail: parsed.error.flatten() }, { status: 400 });
  }

  const { booking_id, start_date, end_date, reason } = parsed.data;
  console.log('Parsed params:', { booking_id, start_date, end_date, reason });

  // Validate dates
  if (new Date(end_date) < new Date(start_date)) {
    return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 });
  }

  // Use admin client to bypass all RPC/PostgREST issues
  const adminClient = supabaseAdmin();

  try {
    // Get current booking
    const { data: booking, error: fetchErr } = await adminClient
      .from('bookings')
      .select('id, customer_id, location_id, slots_per_day, start_date, end_date')
      .eq('id', booking_id)
      .single();

    if (fetchErr || !booking) {
      console.error('Booking fetch error:', fetchErr);
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const v_old_start = booking.start_date;
    const v_old_end = booking.end_date;

    // Update booking
    const { data: updatedBooking, error: updateErr } = await adminClient
      .from('bookings')
      .update({
        original_start_date: booking.start_date,
        original_end_date: booking.end_date,
        start_date: start_date,
        end_date: end_date,
      })
      .eq('id', booking_id)
      .select()
      .single();

    if (updateErr) {
      console.error('Update error:', updateErr);
      return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 });
    }

    // Sync booking_dates - delete dates outside new range
    const { error: deleteErr } = await adminClient
      .from('booking_dates')
      .delete()
      .eq('booking_id', booking_id)
      .or(`play_date.lt.${start_date},play_date.gt.${end_date}`);

    if (deleteErr) {
      console.error('Delete old dates error:', deleteErr);
    }

    // Generate new dates to insert
    const dates: { booking_id: string; location_id: string; play_date: string; slots: number }[] = [];
    let currentDate = new Date(start_date);
    const endDate = new Date(end_date);
    while (currentDate <= endDate) {
      dates.push({
        booking_id: booking_id,
        location_id: booking.location_id,
        play_date: currentDate.toISOString().split('T')[0],
        slots: booking.slots_per_day,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Insert new dates (skip duplicates)
    for (const date of dates) {
      const { error: insertErr } = await adminClient
        .from('booking_dates')
        .upsert(date, { onConflict: 'booking_id,play_date' });
      
      if (insertErr) {
        console.error('Insert date error:', insertErr);
      }
    }

    // Build and send notification
    const message = `Your ad schedule has been changed from ${v_old_start}–${v_old_end} to ${start_date}–${end_date}.` + 
      (reason ? ` Reason: ${reason}` : '');

    const { error: notifErr } = await adminClient
      .from('notifications')
      .insert({
        customer_id: booking.customer_id,
        type: 'booking_date_changed',
        title: 'Your ad schedule has been updated',
        message: message,
        booking_id: booking_id,
        created_by: user?.id,
        metadata: {
          old_start: v_old_start,
          old_end: v_old_end,
          new_start: start_date,
          new_end: end_date,
          reason: reason || null,
        },
      });

    if (notifErr) {
      console.error('Notification error:', notifErr);
    }

    return NextResponse.json({ booking: updatedBooking });

  } catch (err) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
