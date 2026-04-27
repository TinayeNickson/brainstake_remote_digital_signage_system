import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { sendRejectionEmail } from '@/lib/email';

const schema = z.object({ reason: z.string().min(3).max(500) });

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, supabase, error } = await requireRole(['accountant', 'admin']);
  if (error || !user || !supabase) return error;

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'reason required' }, { status: 400 });
  }

  const { data, error: rpcErr } = await supabase.rpc('reject_payment', {
    p_payment_id: params.id,
    p_reason: parsed.data.reason,
  });
  if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: detail } = await admin
    .from('payments')
    .select(`
      booking_id, campaign_id,
      booking:bookings(customer:profiles!bookings_customer_id_fkey(email)),
      campaign:campaigns(id, customer:profiles!campaigns_customer_id_fkey(email))
    `)
    .eq('id', params.id)
    .single();
  const d: any = detail;
  const email = d?.campaign?.customer?.email ?? d?.booking?.customer?.email;
  const refId = d?.campaign_id ?? d?.booking_id;
  if (email) {
    try { await sendRejectionEmail(email, refId, parsed.data.reason); }
    catch (e: any) { console.error('[reject] email failed:', e?.message); }
  }

  return NextResponse.json({ payment: data });
}
