import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabaseServer } from '@/lib/supabase-server';
import { money } from '@/lib/format';
import PrintButton from './PrintButton';

export const dynamic = 'force-dynamic';

export default async function ReceiptDetailPage({ params }: { params: { id: string } }) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: r } = await supabase
    .from('receipts')
    .select(`
      id, receipt_number, amount, issued_at, customer_id,
      customer:profiles(full_name, email, phone, company_name, billing_address, account_type),
      booking:bookings(
        id, start_date, end_date, duration, slots_per_day,
        scheduled_days_count, price_per_slot, days_of_week,
        package:packages(name),
        location:locations(name),
        ad:ads(title),
        campaign:campaigns(
          id, title, start_date, end_date, duration, slots_per_day,
          scheduled_days_count, total_price,
          ad:ads(title),
          bookings(
            total_price, price_per_slot, scheduled_days_count,
            location:locations(name)
          )
        )
      ),
      payment:payments(method, reference, submitted_at)
    `)
    .eq('id', params.id)
    .single();

  // RLS already enforces this at DB level; redirect explicitly so no
  // partial data can leak into the component tree.
  if (!r || (r as any).customer_id !== user.id) redirect('/dashboard/receipts');

  const bk  = r.booking  as any;
  const cu  = r.customer as any;
  const py  = r.payment  as any;
  const cam = bk?.campaign as any;
  const isCampaign = !!cam;

  const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const METHOD_LABELS: Record<string, string> = {
    ecocash: 'EcoCash', bank_transfer: 'Bank Transfer',
    onemoney: 'OneMoney', cash: 'Cash', other: 'Other',
  };

  const src = isCampaign ? cam : bk;
  const campaignLocations: { name: string; price: number }[] = isCampaign
    ? (cam.bookings ?? []).map((b: any) => ({
        name: b.location?.name ?? '—',
        price: Number(b.total_price ?? 0),
      }))
    : [{ name: bk?.location?.name ?? '—', price: Number(r.amount) }];

  const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  // Data passed to PrintButton via data attributes (avoids serialising through props)
  const pdfData = {
    receiptNumber:   r.receipt_number,
    logoUrl:         `${appUrl}/logo.jpg`,
    customerName:    cu?.full_name ?? '—',
    customerEmail:   cu?.email ?? '',
    customerPhone:   cu?.phone ?? '',
    companyName:     cu?.company_name ?? '',
    issuedDate:      new Date(r.issued_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    paymentMethod:   METHOD_LABELS[py?.method] ?? '—',
    reference:       py?.reference ?? '',
    campaignTitle:   isCampaign ? (cam.title ?? cam.ad?.title ?? '—') : (bk?.ad?.title ?? '—'),
    locationSummary: campaignLocations.map(l => l.name).join(', '),
    duration:        String(src?.duration ?? '—'),
    slotsPerDay:     String(src?.slots_per_day ?? '—'),
    scheduledDays:   String(src?.scheduled_days_count ?? '—'),
    startDate:       src?.start_date ?? '—',
    endDate:         src?.end_date ?? '—',
    amount:          fmt.format(Number(r.amount)),
    locations:       JSON.stringify(campaignLocations.map(l => ({ name: l.name, price: fmt.format(l.price) }))),
  };

  return (
    <>
      {/* Hidden data carrier for PrintButton */}
      <div id="receipt-data" className="hidden" {...Object.fromEntries(
        Object.entries(pdfData).map(([k, v]) => [`data-${k.replace(/([A-Z])/g, '-$1').toLowerCase()}`, v])
      )} />

      <div className="max-w-2xl mx-auto space-y-6">

        {/* Actions bar */}
        <div className="no-print flex items-center justify-between">
          <Link href="/dashboard/receipts" className="btn btn-ghost h-9 px-4 text-sm font-medium flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Back to receipts
          </Link>
          <PrintButton />
        </div>

        {/* Receipt document */}
        <div id="receipt-card" className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">

          {/* Header band */}
          <div className="bg-[#2d2a6e] px-8 py-7">
            <div className="flex items-start justify-between mb-6">
              {/* Left: receipt label + number */}
              <div>
                <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">Official Receipt</p>
                <p className="text-white font-bold text-2xl tracking-tight mono">{r.receipt_number}</p>
              </div>
              {/* Right: Logo */}
              <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-white/10 ring-1 ring-white/20 shrink-0">
                <Image src="/logo.jpg" alt="RAREVISION" width={40} height={40} className="object-contain" style={{ width: 'auto', height: 'auto' }} />
              </div>
            </div>
            {/* Company info below */}
            <div className="border-t border-white/10 pt-4">
              <p className="text-white font-bold text-base tracking-tight">RAREVISION</p>
              <p className="text-white/50 text-xs mt-0.5">WE FOLLOW THE DREAM &nbsp;·&nbsp; info@rarevision.tech</p>
            </div>
          </div>

          <div className="px-8 py-7 space-y-7">

            {/* Meta row */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-ink-900/35 mb-1.5">Issued to</p>
                <p className="font-semibold text-ink-900">{cu?.full_name ?? '—'}</p>
                {cu?.company_name && <p className="text-ink-900/60">{cu.company_name}</p>}
                <p className="text-ink-900/50">{cu?.email}</p>
                {cu?.phone && <p className="text-ink-900/50">{cu.phone}</p>}
                {cu?.billing_address && <p className="text-ink-900/50 text-xs mt-1">{cu.billing_address}</p>}
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-ink-900/35 mb-1.5">Date issued</p>
                <p className="font-semibold text-ink-900">
                  {new Date(r.issued_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-ink-900/35 mt-3 mb-1.5">Payment method</p>
                <p className="font-semibold text-[#2d2a6e]">{METHOD_LABELS[py?.method] ?? '—'}</p>
                {py?.reference && <p className="text-xs text-[#f5a623] font-medium">Ref: {py.reference}</p>}
              </div>
            </div>

            <hr className="border-ink-100" />

            {/* Campaign details */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-ink-900/35 mb-3">Campaign Details</p>
              <div className="rounded-xl border border-ink-100 divide-y divide-ink-100 overflow-hidden text-sm">
                {[
                  ['Campaign title',  isCampaign ? (cam.title ?? cam.ad?.title) : bk?.ad?.title ?? '—'],
                  ['Slot duration',   `${src?.duration ?? '—'}s`],
                  ['Slots per day',   `${src?.slots_per_day ?? '—'}`],
                  ['Start date',      src?.start_date ?? '—'],
                  ['End date',        src?.end_date ?? '—'],
                  ['Scheduled days',  `${src?.scheduled_days_count ?? '—'}`],
                  ...(!isCampaign ? [
                    ['Package',       bk?.package?.name ?? '—'],
                    ['Location',      bk?.location?.name ?? '—'],
                    ['Play days',     Array.isArray(bk?.days_of_week) ? bk.days_of_week.map((d: number) => DOW_LABELS[d]).join(', ') : '—'],
                    ['Price per slot',money(Number(bk?.price_per_slot ?? 0))],
                  ] : []),
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between px-4 py-3 bg-white">
                    <span className="text-ink-900/50">{k}</span>
                    <span className="font-semibold text-ink-900 text-right ml-4">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Per-location breakdown for campaigns */}
            {isCampaign && campaignLocations.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-ink-900/35 mb-3">Location Breakdown</p>
                <div className="rounded-xl border border-ink-100 divide-y divide-ink-100 overflow-hidden text-sm">
                  {campaignLocations.map((loc, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3 bg-white">
                      <span className="text-ink-900/70">{loc.name}</span>
                      <span className="font-semibold text-ink-900">{money(loc.price)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Total */}
            <div className="rounded-xl bg-[#2d2a6e]/5 border border-[#2d2a6e]/10 p-5 flex items-center justify-between">
              <div className="text-sm text-ink-900/55">
                <p>{isCampaign ? `${campaignLocations.length} location${campaignLocations.length > 1 ? 's' : ''}` : (bk?.package?.name ?? 'Package')}</p>
                {!isCampaign && <p className="mt-0.5">{bk?.slots_per_day} slots/day × {bk?.scheduled_days_count} days × {money(Number(bk?.price_per_slot ?? 0))}/slot</p>}
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#2d2a6e]/60 mb-1">Total Paid</p>
                <p className="font-bold text-3xl text-[#2d2a6e] tracking-tight">{money(Number(r.amount))}</p>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-ink-900/30 leading-relaxed space-y-1">
              <p>This is a computer-generated receipt and does not require a signature.</p>
              <p>RAREVISION &nbsp;·&nbsp; WE FOLLOW THE DREAM &nbsp;·&nbsp; info@rarevision.tech</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
