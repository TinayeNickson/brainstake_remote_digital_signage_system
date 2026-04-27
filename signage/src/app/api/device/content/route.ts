import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const admin = supabaseAdmin();

  const urlToken    = req.nextUrl.searchParams.get('token');
  const authHeader  = req.headers.get('authorization') ?? '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token       = urlToken ?? bearerToken;

  if (!token) {
    return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
  }

  const { data: deviceRow, error: tokenErr } = await admin
    .from('devices')
    .select('id, start_time, end_time, display_mode, device_type')
    .eq('api_token', token)
    .maybeSingle();

  if (tokenErr || !deviceRow) {
    return NextResponse.json({ error: 'Invalid device token' }, { status: 401 });
  }

  const deviceId = deviceRow.id;
  const today    = new Date().toISOString().slice(0, 10);

  const [
    heartbeat,
    overrideResult,
    slotsResult,
    feedResult,
    fallbackResult,
  ] = await Promise.all([
    admin.from('devices')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', deviceId),

    admin.from('system_overrides')
      .select('id, title, content_url, content_type, message')
      .eq('is_active', true)
      .maybeSingle(),

    admin.rpc('player_slots', { p_device_id: deviceId, p_date: today }),

    admin.rpc('player_feed', { p_device_id: deviceId }),

    admin.from('fallback_content')
      .select('id, title, content_url, content_type')
      .eq('is_active', true)
      .order('sort_order')
      .order('created_at'),
  ]);

  void heartbeat;

  if (feedResult.error) {
    return NextResponse.json({ error: feedResult.error.message }, { status: 500 });
  }

  const slotAds = slotsResult.data ?? [];
  let allAds: any[];
  let slotScheduled = false;

  if (slotAds.length > 0) {
    slotScheduled = true;
    allAds = slotAds.map((s: any) => ({
      booking_id:        s.booking_id,
      ad_id:             s.ad_id,
      title:             s.title,
      format:            s.format,
      duration:          s.duration,
      media_url:         s.media_url,
      slots_per_day:     1,
      display_mode:      s.display_mode,
      run_outside_hours: s.run_outside_hours,
      slot_index:        s.slot_index,
    }));
  } else {
    // No slot assignments yet for today — generate them asynchronously while
    // serving the raw feed so the first request of the day isn't blocked.
    allAds = feedResult.data ?? [];
    void Promise.resolve(
      admin.rpc('generate_slot_assignments', { p_device_id: deviceId, p_date: today })
    );
  }

  const ads        = allAds.filter((a: any) => !a.run_outside_hours);
  const outsideAds = allAds.filter((a: any) =>  a.run_outside_hours);

  return NextResponse.json(
    {
      device_id:     deviceId,
      override:      overrideResult.data ?? null,
      ads,
      outside_ads:   outsideAds,
      fallback:      fallbackResult.data ?? [],
      device: {
        start_time:  deviceRow.start_time,
        end_time:    deviceRow.end_time,
        display_mode: deviceRow.display_mode,
        device_type:  deviceRow.device_type ?? 'web',
      },
      slot_scheduled: slotScheduled,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
