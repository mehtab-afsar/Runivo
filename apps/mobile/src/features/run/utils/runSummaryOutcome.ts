import { TIER_CONFIG, formatArea } from '@shared/constants/territory';
import { tierForArea } from '@shared/engine/runEngine';
import type { Sport } from '../constants/activities';
import type { PassedRunData } from '../hooks/useRunSummary';
import type { PacePart, ServerResult } from './runSummaryTypes';
import { capFirst, rejectionText } from './runSummaryFormatters';

export interface RunOutcome {
  stolen: number;
  newZones: number;
  noGain: boolean;
  noGainReason: string | null;
  claimedArea: number;
  headline: string;
}

/**
 * What the run did to the map. The server's verdict wins over the phone's preview:
 * when it gave this run no new or stolen ground, say so and why, and don't show a zone (T9).
 */
export function computeOutcome(
  runData: PassedRunData,
  serverResult: ServerResult | null,
  serverAreaM2: number | null,
  ride: boolean,
  sport: Pick<Sport, 'verb'>,
): RunOutcome {
  const stolen = serverResult?.stolenZones ?? (runData.rivalZonesStolen ?? 0);
  const newZones = serverResult?.newZones ?? (runData.territory ? 1 : 0);
  const noGain = !!serverResult && newZones + stolen === 0;
  const noGainReason = !serverResult || !noGain ? null
    : serverResult.rejectedReason ? rejectionText(serverResult.rejectedReason)
    : serverResult.territoryCapReached ? 'You hold the most zones a free account can. This run defended your ground but claimed nothing new.'
    : runData.territory ? 'All of this ground was already yours or a fresh rival zone, so nothing new was claimed. Your own zones were refreshed.'
    : null;
  const claimedArea = serverResult ? (serverResult.claimedAreaM2 ?? serverAreaM2 ?? 0) : (serverAreaM2 ?? runData.territory?.areaM2 ?? 0);
  // Hero line says what the run actually did, plainest outcome last.
  const headline = ride ? 'Ride done.'
    : serverResult?.rejectedReason ? 'Not scored.'
    : noGain && runData.territory ? 'No new ground.'
    : !runData.success && runData.actionType ? 'Loop not claimed.'
    : stolen > 0 ? `Stole ${stolen} zone${stolen === 1 ? '' : 's'}.`
    : runData.actionType === 'defend' ? 'Defended.'
    : runData.actionType === 'fortify' ? 'Fortified.'
    : runData.territory && claimedArea > 0 ? `Claimed ${formatArea(claimedArea)}.`
    : newZones > 0 ? 'New zone.'
    : ride ? 'Ride done.'
    : `${capFirst(sport.verb)} done.`;
  return { stolen, newZones, noGain, noGainReason, claimedArea, headline };
}

/** The ground to draw on the hero map, and its "District · 0.18 km²" label. */
export function zoneForHero(
  runData: PassedRunData,
  outcome: Pick<RunOutcome, 'noGain' | 'claimedArea'>,
  serverResult: ServerResult | null,
) {
  const terr = outcome.noGain ? null : (runData.territory ?? null);
  const terrTier = terr ? (serverResult && outcome.claimedArea > 0 ? tierForArea(outcome.claimedArea) : terr.tier) : null;
  const zoneLabel = terr && terrTier
    ? `${TIER_CONFIG[terrTier].label.charAt(0)}${TIER_CONFIG[terrTier].label.slice(1).toLowerCase()} · ${formatArea(outcome.claimedArea || terr.areaM2)}`
    : null;
  return { terr, zoneLabel };
}

export interface PacePartColors { distance: string; stolen: string; newZone: string; streak: string }

/** What the server paid, when it has answered; the phone's estimate until then. */
export function paceParts(
  runData: PassedRunData,
  serverResult: ServerResult | null,
  colors: PacePartColors,
): PacePart[] {
  const sb = serverResult?.paceBreakdown;
  const bd = sb
    ? { fromDistance: sb.distance, fromNewZones: sb.newZones, fromStolenZones: sb.stolenZones, fromStreak: sb.streak }
    : serverResult?.rejectedReason ? { fromDistance: 0, fromNewZones: 0, fromStolenZones: 0, fromStreak: 0 }
    : runData.paceBreakdown;
  return [
    { key: 'distance', label: `${Math.floor(runData.distance)} km`, value: bd?.fromDistance ?? 0, color: colors.distance },
    { key: 'stolen',   label: 'Zones stolen', value: bd?.fromStolenZones ?? 0, color: colors.stolen },
    { key: 'new',      label: 'New zone',     value: bd?.fromNewZones ?? 0, color: colors.newZone },
    { key: 'streak',   label: 'Streak',       value: bd?.fromStreak ?? 0, color: colors.streak },
  ].filter(p => p.value > 0);
}

/** What the PaceX debrief card is told about the run. */
export function paceXSummary(
  runData: PassedRunData,
  serverResult: ServerResult | null,
  recentAvgPaceSecPerKm: number | null,
  stolen: number,
  paceEarned: number,
  paceCapped: boolean,
) {
  return {
    distanceKm:            runData.distance,
    durationSec:           runData.duration,
    recentAvgPaceSecPerKm,
    newZones:              serverResult?.newZones ?? (runData.territory ? 1 : 0),
    stolenZones:           stolen,
    paceEarned,
    paceCapped,
    streakDays:            serverResult?.streakDays ?? (runData.newStreak ?? 0),
    streakAdvanced:        (runData.paceBreakdown?.fromStreak ?? 0) > 0 || (runData.newStreak ?? 0) > 0,
  };
}
