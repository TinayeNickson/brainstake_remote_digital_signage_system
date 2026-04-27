'use client';

import { useState } from 'react';

export default function PrintButton() {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    const el = document.getElementById('receipt-data') as HTMLElement | null;
    if (!el) return;
    const get = (k: string) => el.dataset[k] ?? '';

    setLoading(true);
    try {
      const { jsPDF } = await import('jspdf');

      // Fetch logo and convert to base64 so jsPDF can embed it
      let logoBase64: string | null = null;
      try {
        const res = await fetch('/logo.png');
        const blob = await res.blob();
        logoBase64 = await new Promise<string>(resolve => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch { /* logo optional */ }

      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const W   = 210;
      const pad = 18;
      const R   = W - pad; // right margin
      let y     = pad;

      // ── LOGO top-right ────────────────────────────────────────────
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', R - 20, y - 4, 20, 20);
      }

      // ── COMPANY name + contact (top-left) ─────────────────────────
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(10, 46, 31);
      doc.text('Brainstake', pad, y + 4);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text('Digital Signage Advertising', pad, y + 10);
      doc.text('info@brainstake.tech', pad, y + 15);

      y += 28;

      // ── DIVIDER ───────────────────────────────────────────────────
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(pad, y, R, y);
      y += 8;

      // ── RECEIPT LABEL + NUMBER ────────────────────────────────────
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(160, 160, 160);
      doc.text('OFFICIAL RECEIPT', pad, y);

      y += 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(15, 15, 15);
      doc.text(get('receiptNumber'), pad, y);

      y += 12;

      // ── ISSUED TO / DATE ISSUED (two columns) ─────────────────────
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(160, 160, 160);
      doc.text('ISSUED TO', pad, y);
      doc.text('DATE ISSUED', R - 50, y);

      y += 5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(20, 20, 20);
      doc.text(get('customerName'), pad, y);
      doc.text(get('issuedDate'), R - 50, y);

      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 100, 100);
      doc.text(get('customerEmail'), pad, y);

      if (get('customerPhone')) { y += 4.5; doc.text(get('customerPhone'), pad, y); }
      if (get('companyName'))   { y += 4.5; doc.text(get('companyName'),   pad, y); }

      // Payment method aligned right on same rows
      doc.setTextColor(160, 160, 160);
      doc.setFontSize(7.5);
      const pmY = y - (get('customerPhone') ? 9 : 4.5);
      doc.text('PAYMENT METHOD', R, pmY - 5, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(20, 20, 20);
      doc.text(get('paymentMethod'), R, pmY, { align: 'right' });
      if (get('reference')) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(130, 130, 130);
        doc.text(`Ref: ${get('reference')}`, R, pmY + 5, { align: 'right' });
      }

      y += 10;

      // ── DIVIDER ───────────────────────────────────────────────────
      doc.setDrawColor(220, 220, 220);
      doc.line(pad, y, R, y);
      y += 8;

      // ── CAMPAIGN DETAILS table ────────────────────────────────────
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(150, 150, 150);
      doc.text('CAMPAIGN DETAILS', pad, y);
      y += 6;

      const rows: [string, string][] = [
        ['Campaign',       get('campaignTitle')],
        ['Location(s)',    get('locationSummary')],
        ['Slot duration',  `${get('duration')}s`],
        ['Slots per day',  get('slotsPerDay')],
        ['Scheduled days', get('scheduledDays')],
        ['Start date',     get('startDate')],
        ['End date',       get('endDate')],
      ];

      try {
        const locs: { name: string; price: string }[] = JSON.parse(get('locations') || '[]');
        if (locs.length > 1) locs.forEach(l => rows.push([`  ${l.name}`, l.price]));
      } catch {}

      const rowH = 8;
      rows.forEach(([label, value], i) => {
        const ry = y + i * rowH;
        if (i % 2 === 0) {
          doc.setFillColor(247, 247, 245);
          doc.rect(pad, ry - 5, R - pad, rowH, 'F');
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(90, 90, 90);
        doc.text(label, pad + 3, ry);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(20, 20, 20);
        // Truncate long values to prevent overflow
        const maxW = 80;
        const val  = doc.splitTextToSize(value, maxW)[0] as string;
        doc.text(val, R - 3, ry, { align: 'right' });
      });

      y += rows.length * rowH + 8;

      // ── TOTAL BOX ─────────────────────────────────────────────────
      doc.setFillColor(245, 245, 242);
      doc.roundedRect(pad, y, R - pad, 16, 2, 2, 'F');
      doc.setDrawColor(210, 210, 205);
      doc.setLineWidth(0.2);
      doc.roundedRect(pad, y, R - pad, 16, 2, 2, 'S');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(120, 120, 120);
      doc.text('TOTAL PAID', pad + 5, y + 10);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(10, 46, 31);
      doc.text(get('amount'), R - 5, y + 10.5, { align: 'right' });

      y += 24;

      // ── FOOTER ────────────────────────────────────────────────────
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.2);
      doc.line(pad, y, R, y);
      y += 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(180, 180, 180);
      doc.text('This is a computer-generated receipt and does not require a signature.', W / 2, y, { align: 'center' });
      doc.text('Brainstake  ·  Digital Signage Advertising  ·  info@brainstake.tech',   W / 2, y + 5, { align: 'center' });

      doc.save(`Receipt-${get('receiptNumber')}.pdf`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      className="btn btn-primary h-9 px-4 text-sm font-semibold flex items-center gap-1.5"
    >
      {loading ? (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin"><circle cx="12" cy="12" r="10" strokeOpacity=".25"/><path d="M12 2a10 10 0 0 1 10 10" /></svg>
          Generating…
        </>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Download PDF
        </>
      )}
    </button>
  );
}
