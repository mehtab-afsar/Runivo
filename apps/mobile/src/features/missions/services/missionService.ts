import {
  ensureTodaysMissions,
  claimMissionReward as claimRewardStore,
} from '@shared/services/missionStore';
import type { Mission } from '@shared/services/missions';

export async function fetchMissions(): Promise<Mission[]> {
  return ensureTodaysMissions();
}

export async function claimMissionReward(missionId: string): Promise<boolean> {
  const result = await claimRewardStore(missionId);
  return result !== null;
}
