import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export interface ReceiptEmailData {
  to: string;
  customerName: string;
  receiptNumber: string;
  receiptId?: string;
  bookingId: string;
  locationName: string;
  duration: string;
  slotsPerDay: number;
  scheduledDays: number;
  startDate: string;
  endDate: string;
  amount: number;
  issuedAt: string;
}

export function receiptHtml(d: ReceiptEmailData): string {
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(d.amount);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const portalLink = d.receiptId ? `${appUrl}/dashboard/receipts/${d.receiptId}` : `${appUrl}/dashboard/receipts`;
  const issuedDate = new Date(d.issuedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Receipt ${d.receiptNumber}</title></head>
<body style="font-family:Helvetica,Arial,sans-serif;color:#1a1a17;background:#f0f0ec;margin:0;padding:32px 16px;">
  <div style="max-width:580px;margin:0 auto;">

    <!-- Card -->
    <div style="background:#fff;border:1px solid #ddd8cc;border-radius:8px;overflow:hidden;">

      <!-- Header -->
      <div style="background:#0a2e1f;padding:28px 36px;">
        <!-- Top row: receipt info left, logo right -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
          <tr>
            <td style="vertical-align:top;">
              <div style="color:rgba(255,255,255,.5);font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;margin-bottom:5px;">Official Receipt</div>
              <div style="color:#fff;font-size:24px;font-weight:700;font-family:monospace;letter-spacing:.04em;">${d.receiptNumber}</div>
            </td>
            <td style="text-align:right;vertical-align:top;">
              <!-- Logo box -->
              <div style="display:inline-block;background:rgba(255,255,255,0.12);border-radius:10px;padding:8px;width:48px;height:48px;box-sizing:border-box;">
                <img src="${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/logo.png" alt="Brainstake" width="32" height="32" style="display:block;width:32px;height:32px;object-fit:contain;" />
              </div>
            </td>
          </tr>
        </table>
        <!-- Company info -->
        <div style="border-top:1px solid rgba(255,255,255,0.12);padding-top:14px;">
          <div style="color:#fff;font-size:15px;font-weight:700;letter-spacing:-.01em;">Brainstake</div>
          <div style="color:rgba(255,255,255,.45);font-size:11px;margin-top:2px;">Digital Signage Advertising &nbsp;&middot;&nbsp; info@brainstake.tech</div>
        </div>
      </div>

      <!-- Body -->
      <div style="padding:28px 36px;">

        <!-- Billed to + date -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px;">
          <tr>
            <td style="vertical-align:top;width:50%;">
              <div style="color:#999;font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;margin-bottom:6px;">Issued to</div>
              <div style="font-weight:600;font-size:14px;">${d.customerName}</div>
              <div style="color:#777;margin-top:2px;">${d.to}</div>
            </td>
            <td style="vertical-align:top;text-align:right;">
              <div style="color:#999;font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;margin-bottom:6px;">Date issued</div>
              <div style="font-weight:600;font-size:14px;">${issuedDate}</div>
            </td>
          </tr>
        </table>

        <hr style="border:none;border-top:1px solid #e8e4dc;margin-bottom:24px;" />

        <!-- Campaign details -->
        <div style="color:#999;font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;margin-bottom:10px;">Campaign Details</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px;">
          <tr style="border-bottom:1px solid #f0ece4;"><td style="padding:8px 0;color:#777;">Location(s)</td><td style="padding:8px 0;text-align:right;font-weight:600;">${d.locationName}</td></tr>
          <tr style="border-bottom:1px solid #f0ece4;"><td style="padding:8px 0;color:#777;">Slot duration</td><td style="padding:8px 0;text-align:right;font-weight:600;">${d.duration}s</td></tr>
          <tr style="border-bottom:1px solid #f0ece4;"><td style="padding:8px 0;color:#777;">Slots / day</td><td style="padding:8px 0;text-align:right;font-weight:600;">${d.slotsPerDay}</td></tr>
          <tr style="border-bottom:1px solid #f0ece4;"><td style="padding:8px 0;color:#777;">Scheduled days</td><td style="padding:8px 0;text-align:right;font-weight:600;">${d.scheduledDays}</td></tr>
          <tr><td style="padding:8px 0;color:#777;">Campaign runs</td><td style="padding:8px 0;text-align:right;font-weight:600;">${d.startDate} &rarr; ${d.endDate}</td></tr>
        </table>

        <!-- Total -->
        <div style="background:#f6f4ef;border-radius:6px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
          <div style="font-size:13px;color:#777;">Total paid</div>
          <div style="font-size:26px;font-weight:800;color:#0a2e1f;">${money}</div>
        </div>

        <!-- CTA -->
        <div style="text-align:center;margin-bottom:24px;">
          <a href="${portalLink}" style="display:inline-block;background:#0f7b4a;color:#fff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:6px;text-decoration:none;letter-spacing:.01em;">View &amp; Download Receipt &rarr;</a>
        </div>

        <!-- Note -->
        <p style="font-size:12px;color:#aaa;text-align:center;margin:0;line-height:1.6;">
          Your advertisement is now active. This is a computer-generated receipt.<br/>
          Log in to your Brainstake portal to view and save a PDF copy at any time.
        </p>
      </div>

      <!-- Footer -->
      <div style="padding:14px 36px;background:#f6f4ef;border-top:1px solid #e8e4dc;font-size:11px;color:#aaa;text-align:center;letter-spacing:.05em;">
        Brainstake &middot; Digital Signage Advertising &middot; info@brainstake.tech
      </div>
    </div>
  </div>
</body></html>`;
}

export async function sendReceiptEmail(d: ReceiptEmailData) {
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set — skipping send');
    return { skipped: true };
  }
  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || 'noreply@example.com',
    to: d.to,
    subject: `Receipt ${d.receiptNumber} — your advert is live`,
    html: receiptHtml(d),
  });
  if (error) throw new Error(error.message);
  return { id: data?.id };
}

export async function sendRejectionEmail(to: string, bookingId: string, reason: string) {
  if (!resend) return { skipped: true };
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || 'noreply@example.com',
    to,
    subject: 'Payment could not be verified',
    html: `<p>Hi,</p>
<p>We couldn't verify the payment for booking <code>${bookingId}</code>.</p>
<p><b>Reason:</b> ${reason}</p>
<p>Please log in to re-upload a valid proof of payment. No slots have been consumed.</p>`,
  });
  if (error) throw new Error(error.message);
  return { sent: true };
}
