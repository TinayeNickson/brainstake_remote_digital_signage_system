import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';

const locConfigSchema = z.object({
  location_id:  z.string().uuid(),
  slots_per_day: z.number().int().positive(),
  start_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days_of_week: z.array(z.number().int().min(0).max(6)).min(1).max(7),
});

const schemaV3 = z.object({
  ad_id:            z.string().uuid(),
  location_configs: z.array(locConfigSchema).min(1).max(20),
  duration:         z.enum(['15', '30', '60']),
  package_id:       z.string().uuid().optional().nullable(),
});

const schemaV2 = z.object({
  ad_id:           z.string().uuid(),
  location_slots:  z.record(z.string().uuid(), z.number().int().positive()),
  duration:        z.enum(['15', '30', '60']),
  start_date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days_of_week:    z.array(z.number().int().min(0).max(6)).min(1).max(7),
  package_id:      z.string().uuid().optional().nullable(),
});

const schemaV1 = z.object({
  ad_id:         z.string().uuid(),
  location_ids:  z.array(z.string().uuid()).min(1).max(20),
  duration:      z.enum(['15', '30', '60']),
  slots_per_day: z.number().int().positive(),
  start_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days_of_week:  z.array(z.number().int().min(0).max(6)).min(1).max(7),
  package_id:    z.string().uuid().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const { supabase, error } = await requireUser();
  if (error || !supabase) return error;

  const body = await req.json().catch(() => null);

  if (body && Array.isArray(body.location_configs)) {
    // v3
    const parsed = schemaV3.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', issues: parsed.error.issues }, { status: 400 });
    }
    const p = parsed.data;

    const { data, error: rpcErr } = await supabase.rpc('create_campaign_atomic_v3', {
      p_ad_id:            p.ad_id,
      p_location_configs: p.location_configs,
      p_duration:         p.duration,
      p_package_id:       p.package_id ?? null,
    });

    if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 400 });
    console.log('[Create Campaign API] v3 - Created:', {
      campaignId: data?.id,
      customerId: data?.customer_id,
      title: data?.title
    });
    return NextResponse.json({ campaign: data });
  }

  if (body && typeof body.location_slots === 'object' && !Array.isArray(body.location_slots)) {
    // v2
    const parsed = schemaV2.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', issues: parsed.error.issues }, { status: 400 });
    }
    const p = parsed.data;

    const { data, error: rpcErr } = await supabase.rpc('create_campaign_atomic_v2', {
      p_ad_id:          p.ad_id,
      p_location_slots: p.location_slots,
      p_duration:       p.duration,
      p_start:          p.start_date,
      p_end:            p.end_date,
      p_dow:            p.days_of_week,
      p_package_id:     p.package_id ?? null,
    });

    if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 400 });
    return NextResponse.json({ campaign: data });
  }

  const parsed = schemaV1.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', issues: parsed.error.issues }, { status: 400 });
  }
  const p = parsed.data;

  const { data, error: rpcErr } = await supabase.rpc('create_campaign_atomic', {
    p_ad_id:         p.ad_id,
    p_location_ids:  p.location_ids,
    p_duration:      p.duration,
    p_slots_per_day: p.slots_per_day,
    p_start:         p.start_date,
    p_end:           p.end_date,
    p_dow:           p.days_of_week,
    p_package_id:    p.package_id ?? null,
  });

  if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 400 });
  return NextResponse.json({ campaign: data });
}
