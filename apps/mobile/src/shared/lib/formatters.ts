export function fmtDist(meters: number): string {
  return (meters / 1000).toFixed(2);
}

export function fmtDistShort(meters: number): string {
  return (meters / 1000).toFixed(1);
}

// Distance-unit conversion — the run tracking engine (useActiveRun, claimEngine,
// process-run-territory) stays km-native throughout, since PACE/territory math
// is defined in km; these only convert values already computed, at the point
// they're about to be displayed.
export const KM_TO_MI = 0.621371;

export function convertKm(km: number, unit: 'km' | 'mi'): number {
  return unit === 'mi' ? km * KM_TO_MI : km;
}

// `minPerKm` is pace as decimal minutes-per-km (e.g. 5.43 = 5:26/km) — the raw
// numeric form threaded through run/summary screens before formatting to "M:SS".
export function convertPaceMinPerKm(minPerKm: number, unit: 'km' | 'mi'): number {
  return unit === 'mi' ? minPerKm / KM_TO_MI : minPerKm;
}

// Same conversion, but for the already-formatted "M:SS" pace strings that
// useActiveRun's live GPS loop produces (no raw decimal available there).
export function convertPaceStringPerKm(paceStr: string, unit: 'km' | 'mi'): string {
  if (unit === 'km') return paceStr;
  const [m, s] = paceStr.split(':').map(Number);
  if (isNaN(m)) return paceStr;
  const converted = convertPaceMinPerKm(m + (s || 0) / 60, unit);
  // Round to whole seconds first, then split: rounding the seconds part alone
  // printed "5:60" for 5:59.6.
  const total = Math.round(converted * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function fmtDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}min`;
}

export function fmtPace(secPerKm: number): string {
  const total = Math.round(secPerKm);
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')}`;
}

export function fmtRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function fmtEventDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

export function fmtEventTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

/** "32:44" or "1:05:12": a duration as a stopwatch reads it. */
export function fmtClock(sec: number): string {
  const t = Math.max(0, Math.round(sec));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), x = t % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`;
}
