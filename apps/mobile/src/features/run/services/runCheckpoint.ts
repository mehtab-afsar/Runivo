/**
 * The in-run crash checkpoint (audit P1-14).
 *
 * It used to be one AsyncStorage row holding every GPS point as JSON objects,
 * rewritten whole every 30 s. At ~150 bytes a point that row passed Android's
 * 2 MB per-row limit after about 3.5 hours at 1 fix a second, so an ultra run's
 * checkpoint silently stopped saving, and every write re-sent the whole run.
 *
 * Now points are stored compactly (an array per point, times relative to the
 * start, ~45 bytes) in parts of PART_SIZE points. Only parts that changed are
 * written. Keys:
 *   `<prefix><runId>`        meta: { v: 2, startTime, activityType, parts }
 *   `<prefix><runId>#<n>`    part n: [[lat, lng, dtMs, speed, accuracy, altitude], …]
 * A checkpoint written by an older build (one row with `points`) still reads.
 */
import type { GPSPoint } from '../hooks/useActiveRun';

export const PART_SIZE = 4000;
export type PackedPoint = [number, number, number, number, number, number];

export interface CheckpointMeta {
  v: 2; startTime: number; activityType: string; parts: number;
  /** A fix came from a mock location provider: a recovered run must stay flagged. */
  mocked?: boolean;
}

const r = (n: number, dp: number) => { const f = 10 ** dp; return Math.round(n * f) / f; };

export function packPoint(p: GPSPoint, startTime: number): PackedPoint {
  return [r(p.lat, 6), r(p.lng, 6), p.timestamp - startTime, r(p.speed, 1), Math.round(p.accuracy), Math.round(p.altitude)];
}

export function unpackPoint(a: PackedPoint, startTime: number): GPSPoint {
  return { lat: a[0], lng: a[1], timestamp: startTime + a[2], speed: a[3], accuracy: a[4], altitude: a[5] };
}

export const partKey = (metaKey: string, n: number) => `${metaKey}#${n}`;
export const isPartKey = (key: string) => key.includes('#');

/**
 * The rows to write so storage holds `points`, given that parts below
 * `writtenFullParts` are already stored and full. Returns the rows and the new
 * count of stored full parts.
 */
export function checkpointWrites(
  metaKey: string, startTime: number, activityType: string, points: GPSPoint[], writtenFullParts: number, mocked = false,
): { rows: [string, string][]; fullParts: number } {
  const parts = Math.ceil(points.length / PART_SIZE);
  const rows: [string, string][] = [];
  for (let n = writtenFullParts; n < parts; n++) {
    const slice = points.slice(n * PART_SIZE, (n + 1) * PART_SIZE);
    rows.push([partKey(metaKey, n), JSON.stringify(slice.map(p => packPoint(p, startTime)))]);
  }
  const meta: CheckpointMeta = { v: 2, startTime, activityType, parts, ...(mocked && { mocked: true }) };
  rows.push([metaKey, JSON.stringify(meta)]);
  return { rows, fullParts: Math.floor(points.length / PART_SIZE) };
}

/** Rebuilds the checkpoint from its meta row and a reader for part rows. */
export async function readCheckpoint(
  metaRaw: string, readPart: (n: number) => Promise<string | null>,
): Promise<{ startTime: number; activityType: string; points: GPSPoint[]; mocked: boolean }> {
  const parsed = JSON.parse(metaRaw) as Partial<CheckpointMeta> & { points?: GPSPoint[]; startTime: number; activityType?: string };
  if (parsed.v !== 2) {
    return { startTime: parsed.startTime, activityType: parsed.activityType ?? 'run', points: parsed.points ?? [], mocked: false };
  }
  const points: GPSPoint[] = [];
  for (let n = 0; n < (parsed.parts ?? 0); n++) {
    const raw = await readPart(n);
    if (!raw) break; // a missing part: keep what came before it
    for (const a of JSON.parse(raw) as PackedPoint[]) points.push(unpackPoint(a, parsed.startTime));
  }
  return { startTime: parsed.startTime, activityType: parsed.activityType ?? 'run', points, mocked: parsed.mocked === true };
}
