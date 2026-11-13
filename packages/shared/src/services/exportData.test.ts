import { describe, it, expect } from 'vitest';
import { toGpx, toCsv, toGeoJson } from './exportData';
import type { StoredRun } from './store';
import type { TerritoryPolygon } from '../types/game';

const run = (o: Partial<StoredRun>): StoredRun => ({
  id: 'r1', activityType: 'run', startTime: Date.UTC(2026, 10, 1, 7), distanceMeters: 5000, durationSec: 1500,
  avgPace: '5:00', gpsPoints: [
    { lat: 12.97, lng: 77.59, timestamp: Date.UTC(2026, 10, 1, 7), speed: 3, accuracy: 5, altitude: 900 },
    { lat: 12.971, lng: 77.591, timestamp: Date.UTC(2026, 10, 1, 7, 1), speed: 3, accuracy: 5, altitude: 901 },
  ], synced: true, ...o,
} as StoredRun);

describe('export', () => {
  it('writes a GPX track per routed activity, escaping titles', () => {
    const gpx = toGpx([run({ title: 'Park & <loop>' }), run({ id: 'r2', gpsPoints: [] })]);
    expect(gpx.match(/<trk>/g)).toHaveLength(1);
    expect(gpx).toContain('Park &amp; &lt;loop&gt;');
    expect(gpx).toContain('<trkpt lat="12.9700000" lon="77.5900000"><ele>900.0</ele><time>2026-11-01T07:00:00.000Z</time></trkpt>');
    expect(gpx).toContain('<type>running</type>');
  });

  it('writes every activity to CSV, quoting commas and marking excluded ones', () => {
    const csv = toCsv([run({ description: 'easy, then fast' }), run({ id: 'r2', excluded: true, gpsPoints: [] })]).trim().split('\n');
    expect(csv).toHaveLength(3);
    expect(csv[1]).toContain('"easy, then fast"');
    expect(csv[2]).toContain(',no,');
  });

  it('closes polygon rings in GeoJSON', () => {
    const z = { id: 'z', runId: 'r1', polygon: [[77.59, 12.97], [77.6, 12.97], [77.6, 12.98], [77.59, 12.98]], areaM2: 1000.4, tier: 'standard', freshness: 80, claimedAt: '2026-11-01' } as unknown as TerritoryPolygon;
    const g = JSON.parse(toGeoJson([z]));
    const ring = g.features[0].geometry.coordinates[0];
    expect(ring).toHaveLength(5);
    expect(ring[4]).toEqual(ring[0]);
    expect(g.features[0].properties.areaM2).toBe(1000);
  });
});
