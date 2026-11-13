/**
 * Watch activities that play the game (PRD X3): the provider's sport mapped
 * to Runivo's, the GPS track pulled out of the payload, and the same
 * plausibility check a phone run gets from validate_run_distance.
 * Pure, no Deno APIs, so vitest covers it.
 */

export interface TrackPoint { lat: number; lng: number; timestamp: number; hr?: number }

/** Provider activity type → Runivo activity type, or null for sports we don't record. */
export function runivoSport(providerType: string | null | undefined): 'run' | 'trail_run' | 'walk' | 'hike' | 'cycle' | null {
  const t = (providerType ?? '').toLowerCase();
  if (/trail/.test(t)) return 'trail_run';
  if (/run|jog|track/.test(t)) return 'run';
  if (/hik|mountaineer/.test(t)) return 'hike';
  if (/walk/.test(t)) return 'walk';
  if (/cycl|bik|ride/.test(t)) return 'cycle';
  return null;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

/**
 * GPS samples in either shape we know:
 *  - Garmin activity details: samples[] with latitudeInDegree / longitudeInDegree
 *    and startTimeInSeconds (or timerDurationInSeconds from the summary start);
 *  - generic: points[] / track[] / samples[] with lat|latitude, lng|lon|longitude,
 *    and timestamp|time (ms, s or ISO).
 */
export function extractTrack(a: Record<string, unknown>, summaryStartSec?: number | null): TrackPoint[] {
  const raw = (a.samples ?? a.points ?? a.track ?? a.gpsPoints ?? []) as Record<string, unknown>[];
  if (!Array.isArray(raw)) return [];
  const out: TrackPoint[] = [];
  for (const s of raw) {
    const lat = num(s.latitudeInDegree ?? s.lat ?? s.latitude);
    const lng = num(s.longitudeInDegree ?? s.lng ?? s.lon ?? s.longitude);
    if (lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) continue;
    let ts: number | null = null;
    const start = num(s.startTimeInSeconds);
    const offset = num(s.timerDurationInSeconds ?? s.clockDurationInSeconds);
    if (start != null) ts = start * 1000;
    else if (offset != null && summaryStartSec != null) ts = (summaryStartSec + offset) * 1000;
    else {
      const t = s.timestamp ?? s.time;
      const n = num(t);
      if (n != null) ts = n < 1e11 ? n * 1000 : n;
      else if (typeof t === 'string' && !Number.isNaN(Date.parse(t))) ts = Date.parse(t);
    }
    if (ts == null) continue;
    const hr = num(s.heartRate ?? s.heart_rate ?? s.hr);
    out.push(hr != null && hr > 30 && hr < 240 ? { lat, lng, timestamp: ts, hr: Math.round(hr) } : { lat, lng, timestamp: ts });
  }
  return out.sort((x, y) => x.timestamp - y.timestamp);
}

/** Same ceilings as validate_run_distance: 5.5 m/s on foot, 22 m/s on a bike, +10%. */
export function plausible(distanceM: number, durationSec: number, sport: string): boolean {
  if (!(distanceM >= 0) || !(durationSec > 0)) return false;
  const cap = sport === 'cycle' ? 22 : 5.5;
  return distanceM <= durationSec * cap * 1.1;
}
