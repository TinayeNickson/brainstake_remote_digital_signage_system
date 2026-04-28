import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';

const schema = z.object({
  booking_id: z.string().uuid(),
  reason: z.string().min(1).max(500),
});

export async function POST(req: NextRequest) {
  const { supabase, error } = await requireRole(['admin']);
  if (error || !supabase) return error;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { booking_id, reason } = parsed.data;

  const { data, error: rpcErr } = await supabase.rpc('admin_suspend_booking', {
    p_booking_id: booking_id,
    p_reason: reason,
  });

  if (rpcErr) {
    return NextResponse.json({ error: rpcErr.message }, { status: 400 });
  }

  return NextResponse.json({ booking: data });
}
