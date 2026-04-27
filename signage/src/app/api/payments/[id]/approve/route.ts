import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { sendReceiptEmail } from '@/lib/email';

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, supabase, error } = await requireRole(['accountant', 'admin']);
  if (error || !user || !supabase) return error;

  // The RPC flips payment -> approved, booking -> active, inserts a receipt.
  const { data: receipt, error: rpcErr } = await supabase.rpc('approve_payment', {
    p_payment_id: params.id,
  });
  if (rpcErr) {
    console.error('[approve_payment] RPC error:', rpcErr);
    return NextResponse.json({ error: rpcErr.message }, { status: 400 });
  }

  // Enrich for email
  const admin = supabaseAdmin();
  const { data: enriched } = await admin
    .from('receipts')
    .select(`
      receipt_number, amount, issued_at,
      booking:bookings(
        id, start_date, end_date, duration, slots_per_day, scheduled_days_count,
        customer:profiles!bookings_customer_id_fkey(email, full_name),
        location:locations(name),
        campaign:campaigns(
          id, title, start_date, end_date, duration, slots_per_day, scheduled_days_count,
          customer:profiles!campaigns_customer_id_fkey(email, full_name),
          bookings(location:locations(name))
        )
      )
    `)
    .eq('id', (receipt as any).id)
    .single();

  const r: any = enriched;
  const b: any = r?.booking;
  const isCampaign = !!b?.campaign;
  const customerEmail = b?.customer?.email;
  const customerName  = b?.customer?.full_name;
  if (customerEmail) {
    try {
      const locationName = isCampaign
        ? (b.campaign?.bookings ?? []).map((bk: any) => bk.location?.name).filter(Boolean).join(', ')
        : (b?.location?.name ?? '');
      const src = isCampaign ? b.campaign : b;
      await sendReceiptEmail({
        to: customerEmail,
        customerName: customerName ?? customerEmail,
        receiptNumber: r.receipt_number,
        receiptId: (receipt as any).id,
        bookingId: isCampaign ? b.campaign?.id : b.id,
        locationName,
        duration: src?.duration,
        slotsPerDay: src?.slots_per_day,
        scheduledDays: src?.scheduled_days_count,
        startDate: src?.start_date,
        endDate: src?.end_date,
        amount: Number(r.amount),
        issuedAt: r.issued_at,
      });
    } catch (e: any) {
      console.error('[approve] email send failed:', e?.message);
      // Email failure should NOT undo approval
    }
  }

  return NextResponse.json({ receipt });
}
