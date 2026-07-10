/**
 * Formats a live speed reading (km/sec, e.g. distanceKm / elapsedSec) as a
 * "m:ss" pace string. Was duplicated identically in useActiveRun.ts and
 * RunScreen.tsx (the crash-recovery reconstruction path) — single-sourced here.
 * Not to be confused with the other pace formatters in the codebase that take
 * a different unit (seconds-per-km, or minutes-per-km as a float) for
 * different display contexts (splits, run summary) — those remain separate on
 * purpose since forcing them into one shape would require auditing every call
 * site's unit convention under time pressure.
 */
export function formatPace(kmPerSec: number): string {
  if (kmPerSec <= 0) return '0:00';
  const secPerKm = 1 / kmPerSec;
  const minutes = Math.floor(secPerKm / 60);
  const seconds = Math.floor(secPerKm % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
