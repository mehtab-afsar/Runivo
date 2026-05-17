import type { RootStackParamList } from '@navigation/AppNavigator';

type RunSummaryParams = RootStackParamList['RunSummary'];

export function buildRunSummaryParams(result: Record<string, unknown> & {
  runId: string;
  distance: number;
  elapsed: number;
  pace: string | number;
  territoriesClaimed: number;
  gpsPoints?: { lat: number; lng: number }[];
}): RunSummaryParams {
  return {
    runId: result.runId,
    runData: {
      distance:           result.distance,
      duration:           result.elapsed,
      pace:               typeof result.pace === 'string' ? parseFloat(result.pace.replace(':', '.')) || 0 : result.pace,
      territoriesClaimed: result.territoriesClaimed,
      route:              result.gpsPoints?.map(p => ({ lat: p.lat, lng: p.lng })),
      actionType:         result.actionType as string || 'claim',
      success:            (result.success as boolean) ?? true,
      preRunLevel:        result.preRunLevel as number,
      newLevel:           result.newLevel as number,
      newStreak:          result.newStreak as number,
      completedMissions:  result.completedMissions as { id: string; title: string }[],
      startTime:          Date.now() - result.elapsed * 1000,
      elevationGainM:     (result.run as any)?.elevationGainM as number | undefined,
      paceEarned:           result.paceEarned as number | undefined,
      paceBreakdown:        result.paceBreakdown as any,
      cappedAt:             result.cappedAt as number | undefined,
      territory:            result.territory as any,
      runnerRank:           result.runnerRank as any,
      paceTotalEarned:      result.paceTotalEarned as number | undefined,
      runnerRankPaceToNext: result.runnerRankPaceToNext as number | undefined,
      rivalZonesStolen:     0,
    },
  };
}
