import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';

const schema = z.union([
  z.object({
    campaign_id: z.string().uuid(),
    booking_id:  z.undefined().optional(),
    amount:      z.number().positive(),
    method:      z.enum(['ecocash', 'bank_transfer', 'onemoney', 'cash', 'other']),
    reference:   z.string().max(200).optional().nullable(),
    proof_path:  z.string().min(1),
    proof_url:   z.string().url(),
  }),
  z.object({
    booking_id:  z.string().uuid(),
    campaign_id: z.undefined().optional(),
    amount:      z.number().positive(),
    method:      z.enum(['ecocash', 'bank_transfer', 'onemoney', 'cash', 'other']),
    reference:   z.string().max(200).optional().nullable(),
    proof_path:  z.string().min(1),
    proof_url:   z.string().url(),
  }),
]);

export async function POST(req: NextRequest) {
  const { user, supabase, error } = await requireUser();
  if (error || !user || !supabase) return error;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', issues: parsed.error.issues }, { status: 400 });
  }
  const p = parsed.data;

  if (p.campaign_id) {
    const { data: campaign, error: cErr } = await supabase
      .from('campaigns')
      .select('id, customer_id, total_price')
      .eq('id', p.campaign_id)
      .single();

    if (cErr || !campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    if (campaign.customer_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (Number(p.amount) !== Number(campaign.total_price)) {
      return NextResponse.json({ error: `Amount must equal ${campaign.total_price}` }, { status: 400 });
    }

    const { data: payment, error: pErr } = await supabase
      .rpc('submit_campaign_payment', {
        p_campaign_id: p.campaign_id,
        p_amount:      p.amount,
        p_method:      p.method,
        p_reference:   p.reference ?? null,
        p_proof_path:  p.proof_path,
        p_proof_url:   p.proof_url,
      })
      .single();
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });

    return NextResponse.json({ payment });
  }

  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .select('id, customer_id, total_price, status')
    .eq('id', p.booking_id!)
    .single();

  if (bErr || !booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  if (booking.customer_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!['awaiting_payment', 'rejected'].includes(booking.status)) {
    return NextResponse.json({ error: `Booking is ${booking.status}` }, { status: 409 });
  }
  if (Number(p.amount) !== Number(booking.total_price)) {
    return NextResponse.json({ error: `Amount must equal ${booking.total_price}` }, { status: 400 });
  }

  const { data: payment, error: pErr } = await supabase
    .rpc('submit_booking_payment', {
      p_booking_id: p.booking_id,
      p_amount:     p.amount,
      p_method:     p.method,
      p_reference:  p.reference ?? null,
      p_proof_path: p.proof_path,
      p_proof_url:  p.proof_url,
    })
    .single();

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });

  return NextResponse.json({ payment });
}
