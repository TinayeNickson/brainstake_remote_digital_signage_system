import type { AdDuration, Location } from './types';

/**
 * Client-side price estimator. Used for live price display in the booking form.
 * The authoritative price is always computed server-side (via the quote_price
 * Postgres function) before a booking is persisted.
 */
export function countScheduledDays(start: Date, end: Date, dow: number[]): number {
  if (end < start) return 0;
  const daySet = new Set(dow);
  let n = 0;
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const stop = new Date(end);
  stop.setHours(0, 0, 0, 0);
  while (cursor <= stop) {
    if (daySet.has(cursor.getDay())) n++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return n;
}

export function getPricePerSlot(
  location: Pick<Location, 'price_15s' | 'price_30s' | 'price_60s'>,
  duration: AdDuration
): number {
  if (duration === '15') return location.price_15s;
  if (duration === '30') return location.price_30s;
  return location.price_60s;
}

export function estimatePrice(
  location: Pick<Location, 'price_15s' | 'price_30s' | 'price_60s'>,
  duration: AdDuration,
  slotsPerDay: number,
  start: Date,
  end: Date,
  dow: number[]
): { pricePerSlot: number; scheduledDays: number; total: number } {
  const pricePerSlot = getPricePerSlot(location, duration);
  const scheduledDays = countScheduledDays(start, end, dow);
  const total = pricePerSlot * slotsPerDay * scheduledDays;
  return { pricePerSlot, scheduledDays, total };
}
