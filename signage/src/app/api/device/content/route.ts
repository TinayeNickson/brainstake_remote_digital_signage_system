import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

/**
 * Convert "HH:MM" or "HH:MM:SS" to total minutes since midnight.
 */
function timeToMinutes(t: string): number {
  const parts = t.split(':').map(Number);
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
}

/**
 * Convert total minutes since midnight back to "HH:MM".
 */
function minutesToTime(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/**
 * Builds a fully-ordered playlist of exactly `totalSlots` entries, with each
 * entry carrying a `scheduled_time` ("HH:MM") so the player knows when to
 * display it within the operating window.
 *
 * Strategy:
 *  1. Divide the operating window (startTime–endTime) into totalSlots equal bands.
 *  2. Ad slots (spread evenly via slot_index) occupy their corresponding band times.
 *  3. Every other position is filled with cycling fallback content.
 *  4. If there are no ads, every slot is fallback spaced across the window.
 *  5. If there is no fallback, only the ad slots are returned with times.
 */
function buildInterleavedPlaylist(
  ads: any[],
  fallbacks: any[],
  totalSlots: number,
  displayMode: string,
  startTime: string,
  endTime:   string,
): any[] {
  if (ads.length === 0 && fallbacks.length === 0) return [];

  const startMin = timeToMinutes(startTime || '06:00');
  let   endMin   = timeToMinutes(endTime   || '22:00');
  // Handle overnight windows (e.g. 20:00–02:00)
  if (endMin <= startMin) endMin += 24 * 60;
  const windowMin = Math.max(endMin - startMin, 1);

  const adSlotCount = ads.length;
  const cap = Math.max(totalSlots, adSlotCount);

  // Helper: compute the scheduled time for a 1-based slot position.
  const slotTime = (pos: number) => {
    // Place slot at the centre of its equal band within the window.
    const bandMin = windowMin / cap;
    const offsetMin = bandMin * (pos - 1) + bandMin / 2;
    return minutesToTime(startMin + Math.round(offsetMin));
  };

  if (fallbacks.length === 0) {
    // No fallback — just annotate ads with their times and return.
    return ads.map((ad, i) => ({
      ...ad,
      scheduled_time: slotTime((ad.slot_index ?? i) + 1),
    }));
  }

  // Build a slot map: position (1-based) -> ad entry
  const slotMap = new Map<number, any>();

  if (adSlotCount > 0) {
    if (adSlotCount >= cap) {
      ads.forEach((ad, i) => slotMap.set(i + 1, ad));
    } else {
      // Spread ads evenly using equal-interval distribution.
      const stride = cap / adSlotCount;
      ads.forEach((ad, i) => {
        const pos = Math.round(stride * i + stride / 2);
        const clamped = Math.max(1, Math.min(cap, pos));
        let final = clamped;
        while (slotMap.has(final) && final <= cap) final++;
        slotMap.set(final, ad);
      });
    }
  }

  // Fill every remaining position with cycling fallback content.
  let fbIdx = 0;
  const playlist: any[] = [];
  for (let pos = 1; pos <= cap; pos++) {
    const time = slotTime(pos);
    if (slotMap.has(pos)) {
      playlist.push({ ...slotMap.get(pos), slot_index: pos, scheduled_time: time });
    } else {
      const fb = fallbacks[fbIdx % fallbacks.length];
      fbIdx++;
      playlist.push({
        booking_id:        `fallback-${fb.id}-${pos}`,
        ad_id:             `fallback-${fb.id}-${pos}`,
        title:             fb.title,
        format:            fb.content_type,
        duration:          '15',
        media_url:         fb.content_url,
        slots_per_day:     1,
        display_mode:      displayMode,
        run_outside_hours: false,
        slot_index:        pos,
        scheduled_time:    time,
        is_fallback:       true,
      });
    }
  }

  return playlist;
}

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
    .select('id, start_time, end_time, display_mode, device_type, location:locations!inner(max_slots_per_day)')
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

  const maxSlots  = (deviceRow.location as any)?.max_slots_per_day ?? 100;
  const fallbacks = (fallbackResult.data ?? []) as any[];

  // Build a fully-ordered playlist of exactly maxSlots entries.
  // Ad slots are spread evenly across the operating window; fallback fills every other slot.
  const paddedAds = buildInterleavedPlaylist(
    ads,
    fallbacks,
    maxSlots,
    deviceRow.display_mode,
    deviceRow.start_time ?? '06:00',
    deviceRow.end_time   ?? '22:00',
  );

  return NextResponse.json(
    {
      device_id:     deviceId,
      override:      overrideResult.data ?? null,
      ads:           paddedAds,
      outside_ads:   outsideAds,
      fallback:      fallbacks,
      has_ads:       ads.length > 0,          // true when real ad slots exist today
      device: {
        start_time:   deviceRow.start_time,
        end_time:     deviceRow.end_time,
        display_mode: deviceRow.display_mode,
        device_type:  deviceRow.device_type ?? 'web',
        device_id:    deviceId,
      },
      slot_scheduled: slotScheduled,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
