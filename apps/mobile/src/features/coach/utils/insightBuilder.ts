import type { SessionWithStatus } from '../hooks/usePlanScreen';
import type { TerritoryPolygon } from '@shared/types/game';
import { GAME_CONFIG } from '@shared/services/config';

export function computeCurrentFreshness(t: TerritoryPolygon): number {
  const daysSince = (Date.now() - new Date(t.lastDefendedAt).getTime()) / GAME_CONFIG.MS_PER_DAY;
  return Math.max(0, t.freshness - daysSince * GAME_CONFIG.FRESHNESS_DECAY_PER_DAY);
}

export function getStaleZones(territories: TerritoryPolygon[], userId: string): TerritoryPolygon[] {
  return territories.filter(
    t => t.ownerId === userId && computeCurrentFreshness(t) < GAME_CONFIG.FRESHNESS_STALE_AT,
  );
}

// session.day uses abbreviated format: 'Mon','Tue','Wed','Thu','Fri','Sat','Sun'
const TODAY_ABBREVS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function getTodaySession(sessions: SessionWithStatus[]): SessionWithStatus | null {
  const abbrev = TODAY_ABBREVS[new Date().getDay()];
  return sessions.find(s => s.day === abbrev && s.status !== 'completed') ?? null;
}

export function buildInsightMessage(params: {
  todaySession: SessionWithStatus | null;
  staleZones: TerritoryPolygon[];
  playerName: string;
  paceWeeklyEarned: number;
  paceWeeklyCap: number;
}): { headline: string; body: string } {
  const { todaySession, staleZones, playerName, paceWeeklyEarned, paceWeeklyCap } = params;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const remaining = paceWeeklyCap - paceWeeklyEarned;

  if (todaySession && staleZones.length > 0) {
    return {
      headline: `${todaySession.type} today`,
      body: `${staleZones.length} zone${staleZones.length > 1 ? 's' : ''} going stale. Route through them to defend and earn PACE.`,
    };
  }
  if (todaySession) {
    return {
      headline: `${todaySession.type} today`,
      body: todaySession.description || 'Stay consistent. Every session counts.',
    };
  }
  if (staleZones.length > 0) {
    return {
      headline: `${staleZones.length} zone${staleZones.length > 1 ? 's' : ''} going stale`,
      body: "Your territory is decaying. A run through it resets the clock before a rival can steal it.",
    };
  }
  if (remaining > 0) {
    return {
      headline: `${greeting}, ${playerName}`,
      body: `${remaining} PACE left to earn this week. Your next run counts.`,
    };
  }
  return {
    headline: `${greeting}, ${playerName}`,
    body: 'Weekly cap reached. Consistency is the game.',
  };
}
