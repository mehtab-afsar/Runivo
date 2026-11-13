/**
 * "Export my data" (PRD X4): activities as GPX and CSV, zones as GeoJSON.
 * Pure functions over stored data so they can be tested without a device.
 */
import type { StoredRun } from './store';
import type { TerritoryPolygon } from '../types/game';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const iso = (ms: number) => new Date(ms).toISOString();

const GPX_TYPE: Record<string, string> = { run: 'running', trail_run: 'trail_running', trail: 'trail_running', walk: 'walking', hike: 'hiking', cycle: 'cycling' };

/** One GPX file with a track per activity that has a route. */
export function toGpx(runs: StoredRun[]): string {
  const tracks = runs
    .filter(r => r.gpsPoints?.length >= 2)
    .sort((a, b) => a.startTime - b.startTime)
    .map(r => {
      const pts = r.gpsPoints.map(p => {
        const ele = Number.isFinite(p.altitude) ? `<ele>${p.altitude.toFixed(1)}</ele>` : '';
        const time = p.timestamp ? `<time>${iso(p.timestamp)}</time>` : '';
        return `      <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lng.toFixed(7)}">${ele}${time}</trkpt>`;
      }).join('\n');
      const name = esc(r.title || `${r.activityType ?? 'run'} ${iso(r.startTime).slice(0, 10)}`);
      return `  <trk>\n    <name>${name}</name>\n    <type>${GPX_TYPE[r.activityType ?? 'run'] ?? 'running'}</type>\n    <trkseg>\n${pts}\n    </trkseg>\n  </trk>`;
    });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Runivo" xmlns="http://www.topografix.com/GPX/1/1">\n${tracks.join('\n')}\n</gpx>\n`;
}

const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Every activity, one row each (including ones without a route). */
export function toCsv(runs: StoredRun[]): string {
  const head = ['id', 'date', 'type', 'title', 'distance_km', 'duration_sec', 'avg_pace', 'elevation_gain_m', 'counted', 'description'];
  const rows = [...runs].sort((a, b) => a.startTime - b.startTime).map(r => [
    r.id, iso(r.startTime), r.activityType ?? 'run', r.title ?? '', (r.distanceMeters / 1000).toFixed(3),
    Math.round(r.durationSec), r.avgPace ?? '', r.elevationGainM ?? '', r.excluded ? 'no' : 'yes', r.description ?? '',
  ].map(csvCell).join(','));
  return [head.join(','), ...rows].join('\n') + '\n';
}

/** Your zones as a GeoJSON FeatureCollection of polygons. */
export function toGeoJson(zones: TerritoryPolygon[]): string {
  const features = zones.filter(z => z.polygon?.length >= 4).map(z => {
    const ring = z.polygon.map(([lng, lat]) => [lng, lat]);
    const [f, l] = [ring[0], ring[ring.length - 1]];
    if (f[0] !== l[0] || f[1] !== l[1]) ring.push(f);
    return {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [ring] },
      properties: { id: z.id, runId: z.runId, areaM2: Math.round(z.areaM2), tier: z.tier, freshness: z.freshness, claimedAt: z.claimedAt },
    };
  });
  return JSON.stringify({ type: 'FeatureCollection', features }, null, 1);
}
