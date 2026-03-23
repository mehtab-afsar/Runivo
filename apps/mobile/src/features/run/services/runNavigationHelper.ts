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
      xpEarned:           result.xpEarned as number,
      leveledUp:          result.leveledUp as boolean,
      preRunLevel:        result.preRunLevel as number,
      newLevel:           result.newLevel as number,
      newStreak:          result.newStreak as number,
      completedMissions:  result.completedMissions as { id: string; title: string }[],
      startTime:          Date.now() - result.elapsed * 1000,
    },
  };
}
