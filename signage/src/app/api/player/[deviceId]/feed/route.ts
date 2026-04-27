import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

// Legacy endpoint kept for backward compatibility. Resolves the device token
// by ID and delegates to /api/device/content. New integrations should call
// /api/device/content directly with Authorization: Bearer <api_token>.
export async function GET(
  req: NextRequest,
  { params }: { params: { deviceId: string } }
) {
  const admin = supabaseAdmin();

  const urlToken    = req.nextUrl.searchParams.get('token');
  const authHeader  = req.headers.get('authorization') ?? '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const suppliedToken = urlToken ?? bearerToken;

  let resolvedToken = suppliedToken;
  if (!resolvedToken) {
    const { data: dev } = await admin
      .from('devices')
      .select('api_token')
      .eq('id', params.deviceId)
      .maybeSingle();
    resolvedToken = dev?.api_token ?? null;
  }

  if (!resolvedToken) {
    return NextResponse.json({ error: 'Device not found' }, { status: 404 });
  }

  const contentUrl = new URL('/api/device/content', req.nextUrl.origin);
  const upstreamRes = await fetch(contentUrl.toString(), {
    headers: { Authorization: `Bearer ${resolvedToken}` },
    cache: 'no-store',
  });

  const json = await upstreamRes.json();
  if (!upstreamRes.ok) {
    return NextResponse.json(json, { status: upstreamRes.status });
  }

  return NextResponse.json(
    {
      ads:        json.ads,
      outsideAds: json.outside_ads,
      fallback:   json.fallback,
      override:   json.override,
      device:     json.device,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
