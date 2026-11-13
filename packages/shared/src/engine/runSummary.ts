/**
 * runSummary — the free post-run summary, built from the runner's own numbers.
 * No AI call: free runners get this; Plus runners get the full PaceX debrief.
 */

export interface RunSummaryInput {
  distanceKm: number;
  durationSec: number;
  /** Average pace of the runner's recent runs (s/km), excluding this one. */
  recentAvgPaceSecPerKm?: number | null;
  newZones: number;
  stolenZones: number;
  paceEarned: number;
  /** True when the weekly cap stopped some of this run's PACE. */
  paceCapped?: boolean;
  streakDays: number;
  /** True when this run moved the streak (first run of the day). */
  streakAdvanced?: boolean;
}

export interface RunSummary {
  headline: string;
  lines: string[];
}

export function formatPace(secPerKm: number): string {
  if (!Number.isFinite(secPerKm) || secPerKm <= 0) return '–';
  const total = Math.round(secPerKm);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Seconds per km, or 0 when the run is too short to have a pace. */
export function paceSecPerKm(distanceKm: number, durationSec: number): number {
  if (distanceKm < 0.05 || durationSec <= 0) return 0;
  return durationSec / distanceKm;
}

/** Faster/slower than usual only counts beyond 3%, so GPS noise isn't news. */
const PACE_NOISE = 0.03;

export function buildRunSummary(input: RunSummaryInput): RunSummary {
  const km = Math.max(0, input.distanceKm);
  const pace = paceSecPerKm(km, input.durationSec);
  const lines: string[] = [];

  const kmText = km >= 10 ? km.toFixed(1) : km.toFixed(2);
  const zones = Math.max(0, input.newZones) + Math.max(0, input.stolenZones);

  let headline: string;
  if (input.stolenZones > 0) {
    headline = input.stolenZones === 1 ? 'You took a rival\'s zone' : `You took ${input.stolenZones} rival zones`;
  } else if (input.newZones > 0) {
    headline = 'New ground is yours';
  } else if (km >= 1) {
    headline = `${kmText} km in the bank`;
  } else {
    headline = 'Every run counts';
  }

  if (pace > 0) {
    const avg = input.recentAvgPaceSecPerKm ?? 0;
    if (avg > 0) {
      const diff = (pace - avg) / avg;
      if (diff < -PACE_NOISE) {
        lines.push(`${kmText} km at ${formatPace(pace)} /km, ${formatPace(avg - pace)} faster than your recent average.`);
      } else if (diff > PACE_NOISE) {
        lines.push(`${kmText} km at ${formatPace(pace)} /km, an easier effort than your recent ${formatPace(avg)} /km.`);
      } else {
        lines.push(`${kmText} km at ${formatPace(pace)} /km, right on your usual pace.`);
      }
    } else {
      lines.push(`${kmText} km at ${formatPace(pace)} /km.`);
    }
  }

  if (zones > 0) {
    const parts: string[] = [];
    if (input.newZones > 0) parts.push(input.newZones === 1 ? '1 new zone' : `${input.newZones} new zones`);
    if (input.stolenZones > 0) parts.push(input.stolenZones === 1 ? '1 zone taken from a rival' : `${input.stolenZones} zones taken from rivals`);
    lines.push(`${parts.join(' and ')}. Run through them again within 6 days to keep them fresh.`);
  } else if (km >= 0.2) {
    lines.push('No new ground this time. Close a loop to claim what\'s inside it.');
  }

  if (input.paceEarned > 0) {
    lines.push(input.paceCapped
      ? `+${input.paceEarned} PACE. You've reached this week's cap; it resets Monday.`
      : `+${input.paceEarned} PACE earned.`);
  } else if (input.paceCapped) {
    lines.push('No PACE this run: you\'ve reached this week\'s cap. It resets Monday.');
  } else if (km < 1) {
    lines.push('PACE pays per full kilometre. Go a little further next time.');
  }

  if (input.streakAdvanced && input.streakDays > 1) {
    const toBonus = 7 - (input.streakDays % 7);
    lines.push(toBonus === 7
      ? `${input.streakDays}-day streak. That's a streak bonus.`
      : `${input.streakDays}-day streak. ${toBonus} more ${toBonus === 1 ? 'day' : 'days'} to the next bonus.`);
  } else if (input.streakAdvanced && input.streakDays === 1) {
    lines.push('Day one of a new streak. Run tomorrow to build it.');
  }

  return { headline, lines };
}
