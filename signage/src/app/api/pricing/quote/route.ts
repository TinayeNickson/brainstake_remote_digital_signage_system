import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';

const schema = z.object({
  location_id: z.string().uuid(),
  duration: z.enum(['15', '30', '60']),
  slots_per_day: z.number().int().positive(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days_of_week: z.array(z.number().int().min(0).max(6)).min(1).max(7),
});

export async function POST(req: NextRequest) {
  const { user, supabase, error } = await requireUser();
  if (error || !supabase) return error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', issues: parsed.error.issues }, { status: 400 });
  }
  const p = parsed.data;

  const { data, error: rpcErr } = await supabase.rpc('quote_price', {
    p_location_id: p.location_id,
    p_duration: p.duration,
    p_slots_per_day: p.slots_per_day,
    p_start: p.start_date,
    p_end: p.end_date,
    p_dow: p.days_of_week,
  });
  if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 400 });

  // RPCs that "returns table(...)" come back as arrays
  const quote = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({ quote });
}
