import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';

const createSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(500).nullable().optional(),
  base_slots_per_day: z.number().int().min(1),
  allows_15s: z.boolean().default(true),
  allows_30s: z.boolean().default(true),
  allows_60s: z.boolean().default(false),
  sort_order: z.number().int().min(0).optional().default(0),
  active: z.boolean().optional().default(true),
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

  const { data, error: iErr } = await supabase
    .from('packages')
    .insert(parsed.data)
    .select()
    .single();
  if (iErr) return NextResponse.json({ error: iErr.message }, { status: 400 });
  return NextResponse.json({ package: data });
}

export async function PATCH(req: NextRequest) {
  const { supabase, error } = await requireRole(['admin']);
  if (error || !supabase) return error;

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', detail: parsed.error.flatten() }, { status: 400 });
  }
  const { id, ...patch } = parsed.data;
  const { data, error: uErr } = await supabase
    .from('packages')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 400 });
  return NextResponse.json({ package: data });
}
