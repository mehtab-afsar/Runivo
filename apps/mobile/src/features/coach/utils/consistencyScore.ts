import type { SessionWithStatus } from '../hooks/usePlanScreen';

export interface ConsistencyScore {
  score: number;
  runDaysHit: number;
  runDaysTarget: number;
  missedCount: number;
}

export function computeConsistencyScore(sessions: SessionWithStatus[]): ConsistencyScore {
  const runSessions   = sessions.filter(s => s.type !== 'Rest');
  const completed     = sessions.filter(s => s.status === 'completed' && s.type !== 'Rest');
  const missed        = sessions.filter(s => s.status === 'missed');
  const runDaysTarget = runSessions.length;
  const runDaysHit    = completed.length;
  const score = runDaysTarget > 0
    ? Math.round((runDaysHit / runDaysTarget) * 100)
    : 100;
  return { score, runDaysHit, runDaysTarget, missedCount: missed.length };
}
