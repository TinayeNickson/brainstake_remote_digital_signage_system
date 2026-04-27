import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

const rowSchema = z.object({
  method:       z.string().min(1).max(40),
  label:        z.string().min(1).max(80),
  instructions: z.string().max(1000),
  is_enabled:   z.boolean(),
  sort_order:   z.number().int().min(0).max(99),
});

const putSchema = z.array(rowSchema).min(1).max(10);

/** GET — public, no auth needed — returns all enabled settings ordered */
export async function GET() {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('payment_settings')
    .select('method, label, instructions, is_enabled, sort_order')
    .order('sort_order');
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ settings: data ?? [] });
}

/** PUT — accountant or admin only — upsert full list */
export async function PUT(req: NextRequest) {
  const { supabase, error, user } = await requireRole(['accountant', 'admin']);
  if (error || !supabase) return error;

  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', detail: parsed.error.flatten() }, { status: 400 });
  }

  const rows = parsed.data.map(r => ({ ...r, updated_at: new Date().toISOString(), updated_by: user!.id }));

  const { data, error: uErr } = await supabase
    .from('payment_settings')
    .upsert(rows, { onConflict: 'method' })
    .select();
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 400 });
  return NextResponse.json({ settings: data });
}
