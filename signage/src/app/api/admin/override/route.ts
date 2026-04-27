import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

const createSchema = z.object({
  title:        z.string().min(1).max(200),
  content_url:  z.string().url(),
  content_type: z.enum(['image', 'video']).default('image'),
  message:      z.string().max(500).optional(),
});

const updateSchema = z.object({
  id:        z.string().uuid(),
  is_active: z.boolean().optional(),
  title:     z.string().min(1).max(200).optional(),
  message:   z.string().max(500).optional(),
});

/** GET — list all overrides (most recent first) */
export async function GET() {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('system_overrides')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ overrides: data ?? [] });
}

/** POST — create a new override (NOT active by default) */
export async function POST(req: NextRequest) {
  const { supabase, error, user } = await requireRole(['admin']);
  if (error || !supabase) return error;

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', detail: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error: iErr } = await supabase
    .from('system_overrides')
    .insert({ ...parsed.data, created_by: user!.id })
    .select()
    .single();
  if (iErr) return NextResponse.json({ error: iErr.message }, { status: 400 });
  return NextResponse.json({ override: data });
}

/** PATCH — activate/deactivate or update an override */
export async function PATCH(req: NextRequest) {
  const { supabase, error } = await requireRole(['admin']);
  if (error || !supabase) return error;

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', detail: parsed.error.flatten() }, { status: 400 });
  }

  const { id, is_active, ...rest } = parsed.data;

  // If activating this one, deactivate all others first
  if (is_active === true) {
    await supabase
      .from('system_overrides')
      .update({ is_active: false, deactivated_at: new Date().toISOString() })
      .eq('is_active', true)
      .neq('id', id);
  }

  const patch: Record<string, unknown> = { ...rest };
  if (is_active !== undefined) {
    patch.is_active = is_active;
    if (is_active) patch.activated_at   = new Date().toISOString();
    else           patch.deactivated_at = new Date().toISOString();
  }

  const { data, error: uErr } = await supabase
    .from('system_overrides')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 400 });
  return NextResponse.json({ override: data });
}

/** DELETE — remove an override record */
export async function DELETE(req: NextRequest) {
  const { supabase, error } = await requireRole(['admin']);
  if (error || !supabase) return error;

  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error: dErr } = await supabase
    .from('system_overrides')
    .delete()
    .eq('id', id);
  if (dErr) return NextResponse.json({ error: dErr.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
