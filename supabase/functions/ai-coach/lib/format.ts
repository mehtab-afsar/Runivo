import type { RunRecord } from './types.ts';

export function todayISODate(): string {
  return new Date().toISOString().split('T')[0];
}

export function paceSecPerKm(r: RunRecord): number {
  if (!r.distance_m || !r.duration_sec) return 0;
  return r.duration_sec / (r.distance_m / 1000);
}

export function fmtPaceSec(sPerKm: number): string {
  const m = Math.floor(sPerKm / 60);
  const s = Math.round(sPerKm % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function fmtTime(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.round(totalSec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function fmtDist(m: number | null): string {
  if (!m) return '0 km';
  return (m / 1000).toFixed(1) + ' km';
}

export function fmtDuration(sec: number | null): string {
  if (!sec) return '0 min';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function meanSec(runs: RunRecord[]): number {
  const valid = runs.filter(r => r.distance_m && r.duration_sec);
  if (!valid.length) return 0;
  return valid.reduce((s, r) => s + paceSecPerKm(r), 0) / valid.length;
}

export const MS_PER_DAY = 86_400_000;

/** SHA-256 of a JSON-serialisable value: the ai_cache invalidation key. */
export async function contextHash(obj: unknown): Promise<string> {
  const encoded = new TextEncoder().encode(JSON.stringify(obj));
  const buf = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
