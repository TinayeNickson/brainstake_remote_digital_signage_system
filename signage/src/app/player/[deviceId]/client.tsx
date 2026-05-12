'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const PLAYER_VERSION = '2.0';

interface FeedAd {
  booking_id: string;
  ad_id: string;
  title: string;
  format: 'image' | 'video';
  duration: '10' | '15' | '30' | '60';
  media_url: string;
  slots_per_day: number;
  display_mode: DisplayMode;
  run_outside_hours: boolean;
  slot_index?: number;
  scheduled_time?: string;  // "HH:MM" — when this slot should play
  is_fallback?: boolean;
}

interface FallbackItem {
  id: string;
  title: string;
  content_url: string;
  content_type: 'image' | 'video';
}

interface Override {
  id: string;
  title: string;
  content_url: string;
  content_type: 'image' | 'video';
  message: string | null;
}

interface DeviceInfo {
  start_time:   string;
  end_time:     string;
  display_mode: string;
}

type DisplayMode = 'fade' | 'slide' | 'none' | 'zoom';

const POLL_MS        = 30_000;
const OVERRIDE_MS    = 10_000;
const EMPTY_RETRY_MS = 10_000;
const FALLBACK_DWELL = 15_000;

/** Parse "HH:MM" into minutes since midnight. */
function hhmm(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Current time in minutes since midnight. */
function nowMin(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Find the index in playlist whose scheduled_time <= now < next slot's time.
 * Falls back to the last slot whose time has passed.
 * Returns 0 if no scheduled_time data exists.
 */
function currentSlotIndex(playlist: FeedAd[]): number {
  if (playlist.length === 0) return 0;
  if (!playlist[0].scheduled_time) return 0; // no time data — play in order
  const now = nowMin();
  let best = 0;
  for (let i = 0; i < playlist.length; i++) {
    const t = hhmm(playlist[i].scheduled_time!);
    if (t <= now) best = i;
    else break;
  }
  return best;
}

const TRANSITION_IN: Record<DisplayMode, string> = {
  fade:  'animate-[fadeIn_0.5s_ease_forwards]',
  slide: 'animate-[slideIn_0.4s_ease_forwards]',
  zoom:  'animate-[zoomIn_0.4s_ease_forwards]',
  none:  '',
};

function isWithinHours(device: DeviceInfo | null): boolean {
  if (!device) return true;
  const now  = new Date();
  const cur  = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const start = device.start_time.slice(0, 5);
  const end   = device.end_time.slice(0, 5);
  if (start <= end) {
    return cur >= start && cur < end;
  }
  // Overnight range e.g. 22:00–06:00
  return cur >= start || cur < end;
}

function expandAds(ads: FeedAd[]): FeedAd[] {
  const out: FeedAd[] = [];
  for (const a of ads) {
    if (a.format === 'image' && a.media_url.startsWith('[')) {
      try {
        const urls: string[] = JSON.parse(a.media_url);
        urls.forEach((url, i) =>
          out.push({ ...a, ad_id: `${a.ad_id}_${i}`, media_url: url })
        );
        continue;
      } catch { /* fall through to single */ }
    }
    out.push(a);
  }
  return out;
}

function buildPlaylist(ads: FeedAd[]): FeedAd[] {
  if (ads.length === 0) return [];

  // slot_index present → server already ordered slots (ads interleaved with fallback).
  // Sort by slot_index to guarantee correct playback order regardless of fetch order.
  if (ads[0].slot_index !== undefined) {
    const sorted = [...ads].sort((a, b) => (a.slot_index ?? 0) - (b.slot_index ?? 0));
    return expandAds(sorted);
  }

  // Fallback: client-side fair distribution when server sends no slot_index.
  const out: FeedAd[] = [];
  const maxSlots = Math.max(...ads.map(a => a.slots_per_day || 1));
  for (let i = 0; i < maxSlots; i++) {
    for (const a of ads) {
      if (i < (a.slots_per_day || 1)) {
        out.push(...expandAds([a]));
      }
    }
  }
  return out.length ? out : expandAds(ads);
}

function useScreenSize() {
  const [size, setSize] = useState({ w: 1920, h: 1080 });
  useEffect(() => {
    const update = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    // orientationchange fires on mobile/Android WebView before resize settles
    window.addEventListener('orientationchange', () => setTimeout(update, 150));
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);
  return size;
}

export default function PlayerClient({ deviceId, token }: { deviceId: string; token?: string }) {
  const [playlist,    setPlaylist]    = useState<FeedAd[]>([]);
  const [fallbacks,   setFallbacks]   = useState<FallbackItem[]>([]);
  const [device,      setDevice]      = useState<DeviceInfo | null>(null);
  const [idx,         setIdx]         = useState(0);
  const [fallbackIdx, setFallbackIdx] = useState(0);
  const [override,    setOverride]    = useState<Override | null>(null);
  const [loaded,      setLoaded]      = useState(false);
  const [withinHours, setWithinHours] = useState(true);
  const [hasAds,      setHasAds]      = useState(false);  // real ads exist today
  const [pendingAds,  setPendingAds]  = useState(false);  // ads arrived mid-fallback
  const [err,         setErr]         = useState<string | null>(null);
  const [animKey,     setAnimKey]     = useState(0);
  const [fullscreen,  setFullscreen]  = useState(false);

  const timer        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playlistRef  = useRef<FeedAd[]>([]);
  const preloadRef   = useRef<HTMLImageElement | HTMLVideoElement | null>(null);
  const deviceRef    = useRef<DeviceInfo | null>(null);
  const adsPoolRef   = useRef<FeedAd[]>([]);
  const outsideRef   = useRef<FeedAd[]>([]);
  const advancedRef  = useRef(false);

  const current     = withinHours ? playlistRef.current[idx] ?? playlist[idx] : undefined;
  const displayMode: DisplayMode = (current?.display_mode ?? device?.display_mode ?? 'fade') as DisplayMode;
  const transitionCls = TRANSITION_IN[displayMode] ?? '';

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Lock html element so the player page has no scrollbars on any device
  useEffect(() => {
    document.documentElement.classList.add('player-mode');
    return () => document.documentElement.classList.remove('player-mode');
  }, []);

  // Re-request fullscreen whenever the branch switches (ads ↔ fallback ↔ override)
  // if it was already active, so the screen never drops out of fullscreen mid-rotation.
  useEffect(() => {
    if (fullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, [withinHours, override, fullscreen]);

  const preloadNext = useCallback((list: FeedAd[], currentIdx: number) => {
    const next = list[(currentIdx + 1) % list.length];
    if (!next) return;
    if (next.format === 'image') {
      const img = new Image();
      img.src = next.media_url;
      preloadRef.current = img as any;
    } else if (next.format === 'video') {
      // Create video element and actually preload data
      const vid = document.createElement('video');
      vid.preload = 'auto';
      vid.src = next.media_url;
      // Force browser to start loading
      vid.load();
      preloadRef.current = vid as any;
    }
  }, []);

  useEffect(() => {
    const tick = () => {
      const nowOpen = isWithinHours(deviceRef.current);
      setWithinHours(prev => {
        if (prev === nowOpen) return prev;
        const pool = nowOpen ? adsPoolRef.current : outsideRef.current;
        const next = buildPlaylist(pool);
        playlistRef.current = next;
        setPlaylist(next);
        setIdx(0);
        setAnimKey(k => k + 1);
        return nowOpen;
      });
    };
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, []);

  const fetchFeed = useCallback(async () => {
    try {
      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};
      const res = await fetch(`/api/player/${deviceId}/feed`, { cache: 'no-store', headers });
      if (!res.ok) throw new Error(`feed ${res.status}`);
      const json = await res.json();
      const { fallback, override: ov, device: dev } = json as {
          fallback:    FallbackItem[];
          override:    Override | null;
          device:      DeviceInfo | null;
        };
      const ads         = (json.ads         ?? []) as FeedAd[];
      const outside_ads = (json.outside_ads ?? json.outsideAds ?? []) as FeedAd[];
      const newHasAds   = (json.has_ads ?? ads.filter((a: FeedAd) => !a.is_fallback).length > 0) as boolean;

      adsPoolRef.current  = ads;
      outsideRef.current  = outside_ads;
      deviceRef.current   = dev;

      setOverride(ov ?? null);
      setDevice(dev ?? null);
      setFallbacks(fallback ?? []);
      setHasAds(newHasAds);

      const open = isWithinHours(dev);
      const pool = open ? ads : outside_ads;

      setPlaylist(prev => {
        const next = buildPlaylist(pool);
        playlistRef.current = next;
        const changed =
          next.length !== prev.length ||
          next.some((a, i) => a.ad_id !== prev[i]?.ad_id);
        if (changed) {
          // If currently showing fallback and ads just arrived, don't jump
          // mid-item — set pendingAds so the switch happens after current item ends.
          if (!open && newHasAds) {
            setPendingAds(true);
            return prev; // keep showing fallback until current item finishes
          }
          // Jump to the correct time-based slot position.
          const startIdx = currentSlotIndex(next);
          setIdx(startIdx);
          setAnimKey(k => k + 1);
        }
        return next;
      });
      setErr(null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'fetch failed');
    } finally {
      setLoaded(true);
    }
  }, [token]);

  useEffect(() => {
    fetchFeed();
    const adPoll      = setInterval(fetchFeed, POLL_MS);
    const overridePoll = setInterval(fetchFeed, OVERRIDE_MS);
    return () => { clearInterval(adPoll); clearInterval(overridePoll); };
  }, [fetchFeed]);

  const advance = useCallback(() => {
    const len = playlistRef.current.length;
    setIdx(i => {
      // Jump to time-correct slot rather than just i+1, so if we're behind
      // schedule (e.g. after being paused) we catch up to the right slot.
      const candidate = len ? (i + 1) % len : 0;
      const timeBased = currentSlotIndex(playlistRef.current);
      const next = timeBased > candidate ? timeBased : candidate;
      preloadNext(playlistRef.current, next % (len || 1));
      return next % (len || 1);
    });
    setAnimKey(k => k + 1);
  }, [preloadNext]);

  const advanceFallback = useCallback(() => {
    // If ads have arrived while we were showing fallback, switch to ads now.
    if (pendingAds && withinHours) {
      setPendingAds(false);
      const startIdx = currentSlotIndex(playlistRef.current);
      setIdx(startIdx);
      setAnimKey(k => k + 1);
      return;
    }
    setFallbackIdx(i => (fallbacks.length > 1 ? (i + 1) % fallbacks.length : 0));
    setAnimKey(k => k + 1);
  }, [fallbacks.length, pendingAds, withinHours]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (override) return;

    // Show fallback when: outside hours, OR within hours but no real ads today.
    const showFallback = !withinHours || (withinHours && !hasAds && playlist.length === 0);
    if (showFallback) {
      if (fallbacks.length >= 1) {
        const fb = fallbacks[fallbackIdx];
        if (fb?.content_type === 'image') {
          timer.current = setTimeout(advanceFallback, FALLBACK_DWELL);
        } else if (fb?.content_type === 'video' && fallbacks.length > 1) {
          // Safety net only — onEnded handles the normal case.
          timer.current = setTimeout(advanceFallback, 60_000);
        }
      } else if (fallbacks.length === 0) {
        timer.current = setTimeout(fetchFeed, EMPTY_RETRY_MS);
      }
      return () => { if (timer.current) clearTimeout(timer.current); };
    }

    if (playlistRef.current.length === 0) {
      timer.current = setTimeout(fetchFeed, EMPTY_RETRY_MS);
      return () => { if (timer.current) clearTimeout(timer.current); };
    }
    const ad = playlistRef.current[idx];
    if (!ad) return;

    advancedRef.current = false;
    const bookedMs = (parseInt(ad.duration, 10) || 15) * 1_000;

    // If this slot has a scheduled_time, compute how long until the NEXT slot
    // and use that as the dwell time (so the slot plays for exactly its allocated
    // window rather than just its booked duration).
    let timerMs = ad.format === 'video' ? bookedMs + 2000 : bookedMs;
    if (ad.scheduled_time && playlistRef.current.length > 1) {
      const nextSlot = playlistRef.current[(idx + 1) % playlistRef.current.length];
      if (nextSlot?.scheduled_time) {
        const nowM     = nowMin();
        const nextM    = hhmm(nextSlot.scheduled_time);
        const curM     = hhmm(ad.scheduled_time);
        // If next slot time is ahead of now, wait until then; else use booked duration.
        const waitMs   = nextM > nowM ? (nextM - nowM) * 60_000 :
                         nextM > curM ? (nextM - curM) * 60_000 : timerMs;
        // Don't wait more than 10 min or less than booked duration.
        timerMs = Math.min(Math.max(waitMs, bookedMs), 10 * 60_000);
        if (ad.format === 'video') timerMs = bookedMs + 2000; // videos self-advance via onEnded
      }
    }

    timer.current = setTimeout(() => {
      if (!advancedRef.current) {
        advancedRef.current = true;
        advance();
      }
    }, timerMs);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [idx, advance, fetchFeed, override, withinHours, hasAds, fallbacks, fallbackIdx, advanceFallback, playlist.length]);

  if (loaded && override) {
    return (
      <div className="player-container">
        {override.content_type === 'video' ? (
          <MediaFill key={override.id} type="video" src={override.content_url} className="" />
        ) : (
          <MediaFill key={override.id} type="image" src={override.content_url} alt={override.title} className={transitionCls} />
        )}
        {override.message && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/75 px-8 py-5 text-center" style={{ zIndex: 10 }}>
            <p className="text-white text-2xl font-bold leading-snug">{override.message}</p>
          </div>
        )}
        <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-600/90 rounded-full px-3 py-1.5" style={{ zIndex: 10 }}>
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span className="text-white text-[11px] font-bold uppercase tracking-widest">Broadcast</span>
        </div>
        <FullscreenButton fullscreen={fullscreen} onClick={toggleFullscreen} />
      </div>
    );
  }

  // Show fallback when outside operating hours, OR when within hours but no real ads.
  const showFallbackScreen = loaded && (!withinHours || (withinHours && !hasAds && playlist.length === 0));

  if (showFallbackScreen) {
    const fb = fallbacks[fallbackIdx];
    if (fb) {
      return (
        <div className="player-container">
          {fb.content_type === 'video' ? (
            <MediaFill key={`fb-${fb.id}-${fallbackIdx}`} type="video" src={fb.content_url} className="" onEnded={advanceFallback} />
          ) : (
            <MediaFill key={`fb-${fb.id}-${animKey}`} type="image" src={fb.content_url} alt={fb.title} className={transitionCls} />
          )}
          {!withinHours && (
            <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-black/40 rounded-full px-2.5 py-1" style={{ zIndex: 10 }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white/60">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <span className="text-white/60 text-[10px] font-mono uppercase tracking-widest">Off hours</span>
            </div>
          )}
          <FullscreenButton fullscreen={fullscreen} onClick={toggleFullscreen} />
        </div>
      );
    }
    if (!withinHours) {
      return (
        <div className="player-container flex flex-col items-center justify-center text-white/50">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="mb-4 text-white/20">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] mb-2">Closed</div>
          <div className="text-xl">Screen offline until {device?.start_time?.slice(0, 5) ?? '—'}</div>
          <div className="font-mono text-[11px] mt-4 text-white/30">Device {deviceId.slice(0, 8)} · v{PLAYER_VERSION}</div>
          <FullscreenButton fullscreen={fullscreen} onClick={toggleFullscreen} />
        </div>
      );
    }
  }

  return (
    <div className="player-container">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center text-white/40 font-mono text-xs">
          Starting player…
        </div>
      )}

      {loaded && playlist.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] mb-4">Standby</div>
          <div className="text-2xl">No scheduled ads right now</div>
          <div className="font-mono text-[11px] mt-6 text-white/30">Device {deviceId.slice(0, 8)} · v{PLAYER_VERSION}</div>
        </div>
      )}

      {current && current.format === 'image' && (
        <MediaFill key={`${current.ad_id}-${animKey}`} type="image" src={current.media_url} alt={current.title} className={transitionCls} />
      )}

      {current && current.format === 'video' && (
        <MediaFill
          key={current.ad_id}
          type="video"
          src={current.media_url}
          className="" /* No transition animation - starts visible immediately */
          onEnded={() => {
            if (!advancedRef.current) {
              advancedRef.current = true;
              advance();
            }
          }}
          onError={advance}
        />
      )}

      {err && (
        <div className="absolute bottom-3 right-3 font-mono text-[10px] text-red-400/70" style={{ zIndex: 20 }}>{err}</div>
      )}

      <FullscreenButton fullscreen={fullscreen} onClick={toggleFullscreen} />
    </div>
  );
}

interface MediaFillProps {
  type:      'image' | 'video';
  src:       string;
  alt?:      string;
  className?: string;
  onEnded?:  () => void;
  onError?:  () => void;
}

function MediaFill({ type, src, alt = '', className = '', onEnded, onError }: MediaFillProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  // Load and play video when src changes - wait for canplay to avoid stuttering
  useEffect(() => {
    setReady(false);
    if (type === 'video' && videoRef.current) {
      const v = videoRef.current;
      v.currentTime = 0;
      v.load();

      let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
      let stallCheck: ReturnType<typeof setInterval> | null = null;

      const playWhenReady = () => {
        if (fallbackTimer) clearTimeout(fallbackTimer);
        v.currentTime = 0;
        v.play().catch(() => {});
        setReady(true);
      };

      // Fallback: show video after 1.5s even if not fully buffered
      fallbackTimer = setTimeout(() => {
        v.play().catch(() => {});
        setReady(true);
      }, 1500);

      // Detect and recover from mid-playback stalls
      stallCheck = setInterval(() => {
        if (v.paused && v.readyState >= 3 && !v.ended) {
          // Video paused but has enough data - try to resume
          v.play().catch(() => {});
        }
      }, 1000);

      v.addEventListener('canplaythrough', playWhenReady, { once: true });

      return () => {
        if (fallbackTimer) clearTimeout(fallbackTimer);
        if (stallCheck) clearInterval(stallCheck);
        v.removeEventListener('canplaythrough', playWhenReady);
      };
    }
  }, [type, src]);

  return (
    <div className={`player-media-layer ${className}`}>
      {/* For images: blurred background fills gaps when aspect ratios differ */}
      {type === 'image' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" aria-hidden
          className="absolute inset-0 w-full h-full object-cover scale-110 blur-lg opacity-80 pointer-events-none" />
      )}

      {/* For videos: Blurred backdrop using CSS only - avoids dual video decoding */}
      {type === 'video' && (
        <div
          className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden"
          style={{
            background: 'radial-gradient(ellipse at center, #1a1a2e 0%, #0d0d1a 50%, #000 100%)',
          }}
        >
          {/* Animated gradient to simulate motion when video has letterboxing */}
          <div
            className="absolute inset-0 opacity-40"
            style={{
              background: 'linear-gradient(45deg, #1a1a2e, #16213e, #0f3460, #1a1a2e)',
              backgroundSize: '400% 400%',
              animation: 'gradientShift 15s ease infinite',
            }}
          />
        </div>
      )}

      {/* Foreground — always contain so nothing is ever cropped */}
      {type === 'video' ? (
        <video
          ref={videoRef}
          src={src}
          autoPlay
          playsInline
          preload="auto"
          loop={!onEnded}
          onEnded={onEnded}
          onError={onError}
          onStalled={() => videoRef.current?.play().catch(() => {})}
          onWaiting={() => {
            // When buffering, try to resume after a short delay
            setTimeout(() => videoRef.current?.play().catch(() => {}), 500);
          }}
          className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ${ready ? 'opacity-100' : 'opacity-0'}`}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className="absolute inset-0 w-full h-full object-contain"
          style={{ imageRendering: '-webkit-optimize-contrast' }}
        />
      )}
    </div>
  );
}

function FullscreenButton({ fullscreen, onClick }: { fullscreen: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      className="absolute top-3 left-3 p-2 rounded-lg bg-white/5 hover:bg-white/15 transition-colors text-white/30 hover:text-white/70"
      style={{ zIndex: 50 }}
    >
      {fullscreen ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
        </svg>
      )}
    </button>
  );
}
