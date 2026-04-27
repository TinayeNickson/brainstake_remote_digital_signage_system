import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth';

const createSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(500).nullable().optional(),
  price_15s: z.number().nonnegative(),
  price_30s: z.number().nonnegative(),
  price_60s: z.number().nonnegative().optional().default(0),
  max_slots_per_day: z.number().int().min(1).max(10000),
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
    .from('locations')
    .insert(parsed.data)
    .select()
    .single();
  if (iErr) return NextResponse.json({ error: iErr.message }, { status: 400 });
  return NextResponse.json({ location: data });
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
    .from('locations')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 400 });
  return NextResponse.json({ location: data });
}
