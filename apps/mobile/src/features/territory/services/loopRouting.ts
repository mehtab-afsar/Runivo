import { loopAt, scoreLoop, type LoopPlan, type LoopZone } from '@shared/engine/planLoop';

/**
 * Turns a planned loop (a circle of the right length) into one that follows
 * real streets and paths, using a walking router:
 *
 *  - With EXPO_PUBLIC_ORS_KEY set: OpenRouteService's foot-walking "round
 *    trip", which builds a loop of a given length from a start point. Free key
 *    at openrouteservice.org; the one to use in production.
 *  - Without it: the free OSRM foot router run by FOSSGIS
 *    (routing.openstreetmap.de), routed through points on the circle. Fine for
 *    testing; its usage policy is fair use, not app-scale traffic.
 *
 * Returns null when the router can't be reached, so callers keep the circle.
 */
type LatLng = { lat: number; lng: number };
type FetchLike = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

const OSRM = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot/';
const ORS = 'https://api.openrouteservice.org/v2/directions/foot-walking/geojson';
const TIMEOUT_MS = 8000;

/** n points spread evenly along the circle, closed back at the start. */
export function waypointsFor(points: LatLng[], n = 6): LatLng[] {
  if (points.length < 3) return points;
  const out: LatLng[] = [];
  for (let i = 0; i < n; i++) out.push(points[Math.round((i / n) * (points.length - 1))]);
  out.push(points[0]);
  return out;
}

export interface RoutedLine { points: LatLng[]; lengthM: number }

/** OSRM route response → line, or null. */
export function parseOsrm(json: unknown): RoutedLine | null {
  const r = (json as { code?: string; routes?: { distance?: number; geometry?: { coordinates?: [number, number][] } }[] })?.routes?.[0];
  if ((json as { code?: string })?.code !== 'Ok' || !r?.geometry?.coordinates || r.geometry.coordinates.length < 4) return null;
  return { points: r.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })), lengthM: Number(r.distance) || 0 };
}

/** OpenRouteService GeoJSON response → line, or null. */
export function parseOrs(json: unknown): RoutedLine | null {
  const f = (json as { features?: { geometry?: { coordinates?: [number, number][] }; properties?: { summary?: { distance?: number } } }[] })?.features?.[0];
  const coords = f?.geometry?.coordinates;
  if (!coords || coords.length < 4) return null;
  return { points: coords.map(([lng, lat]) => ({ lat, lng })), lengthM: Number(f?.properties?.summary?.distance) || 0 };
}

async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try { return await run(ctl.signal); } catch { return null; } finally { clearTimeout(t); }
}

async function osrmThrough(waypoints: LatLng[], fetchImpl: FetchLike): Promise<RoutedLine | null> {
  const coords = waypoints.map(p => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
  return withTimeout(async signal => {
    const res = await fetchImpl(`${OSRM}${coords}?overview=full&geometries=geojson&continue_straight=false`, { signal, headers: { 'User-Agent': 'Runivo/1.0 (loop planner)' } });
    return res.ok ? parseOsrm(await res.json()) : null;
  });
}

async function orsRoundTrip(start: LatLng, lengthM: number, heading: number, key: string, fetchImpl: FetchLike): Promise<RoutedLine | null> {
  return withTimeout(async signal => {
    const res = await fetchImpl(ORS, {
      method: 'POST', signal,
      headers: { Authorization: key, 'Content-Type': 'application/json' },
      // The seed picks one of the router's loop shapes; the heading keeps it stable per direction.
      body: JSON.stringify({ coordinates: [[start.lng, start.lat]], options: { round_trip: { length: Math.round(lengthM), points: 5, seed: Math.round(heading / 30) } } }),
    });
    return res.ok ? parseOrs(await res.json()) : null;
  });
}

/** The planned loop, rerouted onto streets. null: keep the circle. */
export async function streetLoop(
  plan: LoopPlan,
  own: LoopZone[],
  opts: { orsKey?: string; fetchImpl?: FetchLike } = {},
): Promise<LoopPlan | null> {
  const fetchImpl = opts.fetchImpl ?? (fetch as unknown as FetchLike);
  const start = plan.points[0];
  const target = plan.lengthM;
  let line: RoutedLine | null;

  if (opts.orsKey) {
    line = await orsRoundTrip(start, target, plan.heading, opts.orsKey, fetchImpl);
  } else {
    // Streets are longer than the circle they follow; one resize brings the
    // loop close to the length asked for.
    line = await osrmThrough(waypointsFor(plan.points), fetchImpl);
    if (line && line.lengthM > 0 && Math.abs(line.lengthM - target) / target > 0.15) {
      const smaller = loopAt(start, target * (target / line.lengthM), plan.heading);
      const second = await osrmThrough(waypointsFor(smaller), fetchImpl);
      if (second && Math.abs(second.lengthM - target) < Math.abs(line.lengthM - target)) line = second;
    }
  }
  if (!line) return null;
  return { ...plan, points: line.points, lengthM: line.lengthM || target, ...scoreLoop(line.points, own) };
}
