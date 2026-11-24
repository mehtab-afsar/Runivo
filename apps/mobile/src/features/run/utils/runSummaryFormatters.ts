import { ENGINE } from '@shared/engine/runEngine';
import type { RunnerRank } from '@shared/types/game';
import { convertKm } from '@mobile/shared/lib/formatters';
import type { ExtraStat, PrLine } from './runSummaryTypes';

/** mm:ss, or h:mm:ss from one hour up (a 65-minute run is "1:05:00", not "65:00"). */
export function fmt(s: number): string {
  const t = Math.max(0, Math.floor(s));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${String(m).padStart(2, '0')}:${ss}`;
}

/** Pace in decimal minutes → "m:ss". Zero, NaN and Infinity (zero-distance runs) show "–:––". */
export function pace(p: number): string {
  if (!Number.isFinite(p) || p <= 0) return '–:––';
  const total = Math.round(p * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** "run" → "Run". */
export function capFirst(s: string): string {
  return `${s.charAt(0).toUpperCase()}${s.slice(1)}`;
}

/** Average speed for a ride, in the runner's unit per hour ("0.0" for a zero-length ride). */
export function rideSpeed(distanceKm: number, durationSec: number, unit: 'km' | 'mi'): string {
  return durationSec > 0 ? (convertKm(distanceKm, unit) / (durationSec / 3600)).toFixed(1) : '0.0';
}

const RANK_ORDER: RunnerRank[] = ['pacer', 'strider', 'chaser', 'hunter', 'sovereign'];

export function rankProgress(totalPace: number, rank: RunnerRank) {
  if (rank === 'sovereign') return { pct: 1, nextName: '', paceToNext: 0 };
  const idx      = RANK_ORDER.indexOf(rank);
  const current  = (ENGINE.RANK_THRESHOLDS as Record<string, number>)[rank];
  const nextRank = RANK_ORDER[idx + 1] as RunnerRank;
  const next     = (ENGINE.RANK_THRESHOLDS as Record<string, number>)[nextRank];
  const span     = next - current;
  return {
    pct:        span > 0 ? Math.min(1, (totalPace - current) / span) : 0,
    nextName:   nextRank.charAt(0).toUpperCase() + nextRank.slice(1),
    paceToNext: Math.max(0, next - totalPace),
  };
}

/** Plain words for why the server scored a run at zero. */
export function rejectionText(reason: string): string {
  switch (reason) {
    case 'run_too_short':     return 'Runs shorter than a minute aren\'t scored.';
    case 'insufficient_gps':  return 'The phone recorded too few GPS points to check this run.';
    case 'mock_location':     return 'This phone reported a simulated location during the run, so it earns no PACE or ground.';
    case 'trace_too_large':   return 'This run\'s GPS trace was too large to check.';
    case 'activity_type':
    case 'duration':
    case 'trace_before_start':
    case 'trace_after_end':
    case 'trace_in_future':
    case 'run_mismatch':      return 'The GPS trace didn\'t match the saved run (its time or sport), so it couldn\'t be scored.';
    case 'gps_point':
    case 'bad_request':       return 'Some GPS points were invalid, so the run couldn\'t be scored.';
    default:                  return 'The run couldn\'t be verified, so it earned no PACE or ground.';
  }
}

const IMPORT_SOURCES: Record<string, string> = { apple_health: 'Apple Health', garmin: 'Garmin', coros: 'COROS', polar: 'Polar' };

/** "Today, 7:42 AM · Garmin" for the activity header. */
export function whenLineFor(startMs: number, importSource?: string | null): string {
  const d = new Date(startMs);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const day = new Date(startMs); day.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  const t = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const label = diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  return `${label}, ${t}${importSource ? ` · ${IMPORT_SOURCES[importSource] ?? importSource}` : ''}`;
}

/** 24-hour clock time the run ended. */
export function finishTimeLabel(startMs: number, durationSec: number): string {
  return new Date(startMs + durationSec * 1000)
    .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

interface StoredExtras {
  elevationGainM?: number;
  heartRateAvg?: number;
  perceivedEffort?: number | null;
}

/** Optional header stats: only what the stored run actually has. */
export function extraStatsFor(stored: StoredExtras | null, distanceUnit: 'km' | 'mi'): ExtraStat[] {
  const elevM = stored?.elevationGainM;
  return [
    ...(elevM != null ? [{ label: 'Elevation', value: `${Math.round(distanceUnit === 'mi' ? elevM * 3.28084 : elevM)} ${distanceUnit === 'mi' ? 'ft' : 'm'}` }] : []),
    ...(stored?.heartRateAvg ? [{ label: 'Avg HR', value: String(Math.round(stored.heartRateAvg)) }] : []),
    ...(stored?.perceivedEffort ? [{ label: 'Effort', value: stored.perceivedEffort >= 8 ? 'Hard' : stored.perceivedEffort >= 5 ? 'Moderate' : 'Easy' }] : []),
  ];
}

/** Honest "faster than usual" line (not a PR claim) when pace beats the recent average. */
export function fasterThanUsual(
  ride: boolean, recentAvgPace: number | null, distanceKm: number, durationSec: number,
): PrLine | null {
  const thisPaceSec = distanceKm > 0 ? durationSec / distanceKm : 0;
  return !ride && recentAvgPace && distanceKm >= 1 && thisPaceSec > 0 && thisPaceSec < recentAvgPace * 0.97
    ? { title: 'Faster than your usual pace', sub: `${Math.round(recentAvgPace - thisPaceSec)} s/km quicker than your recent runs` }
    : null;
}

/**
 * kcal for the story card. Only with a weight on file: the card omits kcal rather
 * than show a guess built on an assumed weight.
 */
export function estimateCalories(weightKg: number | null, distanceKm: number, durationSec: number): number | null {
  if (!weightKg) return null;
  const speedKmh = durationSec > 0 ? (distanceKm / durationSec) * 3600 : 0;
  const met = Math.max(3.5, Math.min(18, 2.5 + 0.9 * speedKmh));
  return Math.round((met * weightKg * durationSec) / 3600);
}
