import type { TerritoryTier } from '@shared/types/game';

export type TerritoryFilter = 'all' | 'mine' | 'rivals' | 'stale';

export interface TerritoryDetails {
  id:         string;
  ownerId:    string;
  ownerName:  string;
  isOwn:      boolean;
  freshness:  number;
  tier:       TerritoryTier;
  areaM2:     number;
  claimedAt:  string;
  isLoopFill: boolean;
}
