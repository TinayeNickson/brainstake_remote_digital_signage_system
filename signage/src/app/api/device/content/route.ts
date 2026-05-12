import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

/**
 * Builds a fully-ordered playlist of exactly `totalSlots` entries.
 *
 * Strategy:
 *  1. Each ad already carries a `slot_index` (from player_slots DB assignment)
 *     or will get one assigned here based on even distribution.
 *  2. Ad slots are spread as evenly as possible across positions 1..totalSlots
 *     using a stride: stride = Math.floor(totalSlots / adSlotCount).
 *  3. Every position not occupied by an ad slot is filled with fallback content,
 *     cycling through the fallback pool.
 *  4. If there are no ads at all, every slot is fallback.
 *  5. If there is no fallback, only the ad slots are returned (original behaviour).
 */
function buildInterleavedPlaylist(
  ads: any[],
  fallbacks: any[],
  totalSlots: number,
  displayMode: string,
): any[] {
  // If no fallback and no ads, return empty.
  if (ads.length === 0 && fallbacks.length === 0) return [];

  // If no fallback, just return ads as-is (already ordered by slot_index or natural order).
  if (fallbacks.length === 0) return ads;

  // Total ad entries (each entry = one slot play, slots_per_day already expanded by DB).
  const adSlotCount = ads.length;
  const cap = Math.max(totalSlots, adSlotCount); // never truncate ads

  // Build a slot map: position (1-based) -> ad entry
  const slotMap = new Map<number, any>();

  if (adSlotCount > 0) {
    if (adSlotCount >= cap) {
      // Ads fill or overflow total — assign them positions directly.
      ads.forEach((ad, i) => slotMap.set(i + 1, ad));
    } else {
      // Spread ads evenly: compute target positions using equal-interval distribution.
      // e.g. 3 ads across 80 slots → positions 14, 40, 67  (stride ~26.7)
      const stride = cap / adSlotCount;
      ads.forEach((ad, i) => {
        const pos = Math.round(stride * i + stride / 2); // centred within each band
        const clamped = Math.max(1, Math.min(cap, pos));
        // Avoid collision — nudge forward if already taken
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
    if (slotMap.has(pos)) {
      playlist.push({ ...slotMap.get(pos), slot_index: pos });
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
  // Ad slots are spread evenly across the range; fallback fills every other slot.
  const paddedAds = buildInterleavedPlaylist(ads, fallbacks, maxSlots, deviceRow.display_mode);

  return NextResponse.json(
    {
      device_id:     deviceId,
      override:      overrideResult.data ?? null,
      ads:           paddedAds,
      outside_ads:   outsideAds,
      fallback:      fallbacks,
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
