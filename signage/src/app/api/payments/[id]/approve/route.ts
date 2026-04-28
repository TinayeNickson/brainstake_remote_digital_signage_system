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

  // Enrich for email - use separate queries to avoid row multiplication
  const admin = supabaseAdmin();

  // Get receipt with booking
  const { data: receiptData, error: receiptErr } = await admin
    .from('receipts')
    .select(`
      id, receipt_number, amount, issued_at, booking_id,
      booking:bookings!inner(
        id, start_date, end_date, duration, slots_per_day, scheduled_days, campaign_id,
        customer:profiles!inner(email, full_name),
        location:locations(name)
      )
    `)
    .eq('id', (receipt as any).id)
    .single();

  if (receiptErr) {
    console.error('[approve] receipt fetch error:', receiptErr);
  }

  const b: any = receiptData?.booking;
  const campaignId = b?.campaign_id;
  const isCampaign = !!campaignId;

  // Fetch campaign separately if needed
  let c: any = null;
  if (isCampaign && campaignId) {
    const { data: campaignData } = await admin
      .from('campaigns')
      .select('id, title, start_date, end_date, duration, slots_per_day, scheduled_days_count, customer:profiles(email, full_name)')
      .eq('id', campaignId)
      .single();
    c = campaignData;
  }

  const customerEmail = isCampaign ? c?.customer?.email : b?.customer?.email;
  const customerName  = isCampaign ? c?.customer?.full_name : b?.customer?.full_name;

  if (customerEmail) {
    try {
      // For campaign receipts, fetch all locations
      let locationName = b?.location?.name ?? '';
      if (isCampaign && campaignId) {
        const { data: campaignBookings } = await admin
          .from('bookings')
          .select('location:locations(name)')
          .eq('campaign_id', campaignId);
        locationName = (campaignBookings ?? [])
          .map((bk: any) => bk.location?.name)
          .filter(Boolean)
          .join(', ');
      }

      const src = isCampaign ? c : b;
      await sendReceiptEmail({
        to: customerEmail,
        customerName: customerName ?? customerEmail,
        receiptNumber: receiptData?.receipt_number,
        receiptId: (receipt as any).id,
        bookingId: isCampaign ? c?.id : b?.id,
        locationName,
        duration: src?.duration,
        slotsPerDay: src?.slots_per_day,
        scheduledDays: src?.scheduled_days_count ?? src?.scheduled_days,
        startDate: src?.start_date,
        endDate: src?.end_date,
        amount: Number(receiptData?.amount),
        issuedAt: receiptData?.issued_at,
      });
    } catch (e: any) {
      console.error('[approve] email send failed:', e?.message);
      // Email failure should NOT undo approval
    }
  }

  return NextResponse.json({ receipt });
}
