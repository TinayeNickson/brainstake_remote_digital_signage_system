import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

/**
 * POST /api/admin/slots/generate
 *
 * Body (JSON):
 *   { device_id: string, date?: string }   -- date defaults to today (YYYY-MM-DD)
 *
 * Calls generate_slot_assignments(device_id, date) for the given device
 * and returns the number of slots assigned.
 *
 * Can also be called with { all: true } to regenerate for ALL devices today.
 */
export async function POST(req: NextRequest) {
  const admin = supabaseAdmin();
  const body  = await req.json().catch(() => ({}));

  const date: string = body.date ?? new Date().toISOString().slice(0, 10);

  // ── Regenerate ALL devices ───────────────────────────────────────────
  if (body.all === true) {
    const { data: devices, error: dErr } = await admin
      .from('devices')
      .select('id');
    if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 });

    const results: { device_id: string; slots: number; error?: string }[] = [];
    for (const d of devices ?? []) {
      const { data, error } = await admin.rpc('generate_slot_assignments', {
        p_device_id: d.id,
        p_date:      date,
      });
      results.push({ device_id: d.id, slots: data ?? 0, error: error?.message });
    }
    return NextResponse.json({ date, results });
  }

  // ── Single device ────────────────────────────────────────────────────
  const { device_id } = body;
  if (!device_id) {
    return NextResponse.json(
      { error: 'device_id is required (or pass all: true)' },
      { status: 400 }
    );
  }

  const { data, error } = await admin.rpc('generate_slot_assignments', {
    p_device_id: device_id,
    p_date:      date,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ device_id, date, slots_assigned: data });
}
