import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { z } from 'zod';

const schema = z.object({
  pairing_code: z.string().min(4).max(10),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'pairing_code is required' }, { status: 400 });
  }

  const admin = supabaseAdmin();

  const { data, error } = await admin.rpc('pair_device', {
    p_code: parsed.data.pairing_code,
  });

  if (error) {
    void admin.rpc('record_failed_pair_attempt', { p_code: parsed.data.pairing_code });
    return NextResponse.json({ error: 'Invalid pairing code' }, { status: 401 });
  }

  return NextResponse.json(data);
}
