import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';

const DISPLAY_MODES = ['fade', 'slide', 'none', 'zoom'] as const;

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const createSchema = z.object({
  code: z.string().min(2).max(40),
  name: z.string().min(2).max(120),
  location_id: z.string().uuid(),
  guard_id: z.string().uuid(),
  active: z.boolean().optional().default(true),
  max_slots_per_day: z.number().int().min(1).max(9999).optional().default(100),
  display_mode: z.enum(DISPLAY_MODES).optional().default('fade'),
  start_time: z.string().regex(timeRegex).optional().default('08:00'),
  end_time:   z.string().regex(timeRegex).optional().default('22:00'),
});

const updateSchema = createSchema.partial().extend({
  id: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const { supabase, error } = await requireRole(['admin']);
  if (error || !supabase) return error;

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', detail: parsed.error.flatten() }, { status: 400 });
  }

  // Enforce 1:1 — the guard must not already be assigned.
  const { data: taken } = await supabase
    .from('devices')
    .select('id')
    .eq('guard_id', parsed.data.guard_id)
    .maybeSingle();
  if (taken) {
    return NextResponse.json({ error: 'That guard is already assigned to another device' }, { status: 409 });
  }

  const { data, error: iErr } = await supabase
    .from('devices')
    .insert(parsed.data)
    .select('*, api_token')
    .single();
  if (iErr) return NextResponse.json({ error: iErr.message }, { status: 400 });
  return NextResponse.json({ device: data });
}

export async function DELETE(req: NextRequest) {
  const { supabase, error } = await requireRole(['admin']);
  if (error || !supabase) return error;

  const { id, action } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  if (action === 'regenerate_token') {
    const { data, error: rErr } = await supabase
      .rpc('regenerate_device_token', { p_device_id: id });
    if (rErr) return NextResponse.json({ error: rErr.message }, { status: 400 });
    return NextResponse.json({ api_token: data });
  }

  if (action === 'regenerate_pairing_code') {
    const { data, error: rErr } = await supabase
      .rpc('regenerate_pairing_code', { p_device_id: id });
    if (rErr) return NextResponse.json({ error: rErr.message }, { status: 400 });
    return NextResponse.json({ pairing_code: data });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

export async function PATCH(req: NextRequest) {
  const { supabase, error } = await requireRole(['admin']);
  if (error || !supabase) return error;

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', detail: parsed.error.flatten() }, { status: 400 });
  }
  const { id, ...patch } = parsed.data;

  if (patch.guard_id) {
    const { data: taken } = await supabase
      .from('devices')
      .select('id')
      .eq('guard_id', patch.guard_id)
      .neq('id', id)
      .maybeSingle();
    if (taken) {
      return NextResponse.json({ error: 'That guard is already assigned to another device' }, { status: 409 });
    }
  }

  const { data, error: uErr } = await supabase
    .from('devices')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 400 });
  return NextResponse.json({ device: data });
}
