// Shared by IntelligenceTab and StatsTab — both previously carried byte-identical
// copies of every function below.

/** Monday of the week containing `d`, as an ISO date string (YYYY-MM-DD). */
export function isoWeekStart(d: Date): string {
  const day = new Date(d);
  const dow = day.getDay() === 0 ? 6 : day.getDay() - 1; // Mon=0
  day.setDate(day.getDate() - dow);
  day.setHours(0, 0, 0, 0);
  return day.toISOString().slice(0, 10);
}

/** "4:32" → seconds per km. */
export function parsePaceSec(pace: string): number {
  const [m, s] = pace.split(':').map(Number);
  if (isNaN(m)) return 0;
  return m * 60 + (s || 0);
}

/** Total seconds → "Xh Ym" or "Ym". */
export function fmtTime(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Riegel race-time prediction: extrapolate a finish time at `targetDist` from a
 *  known time (`baseSec`) at `baseDist`, formatted as "h:mm:ss" or "m:ss". */
export function riegelPredict(baseSec: number, baseDist: number, targetDist: number): string {
  const t = baseSec * Math.pow(targetDist / baseDist, 1.06);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
