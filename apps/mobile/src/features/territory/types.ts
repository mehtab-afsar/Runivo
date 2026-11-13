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
  /** [lng, lat] of the zone's centre, for naming it. */
  center?:    [number, number];
  /** The zone's outline, [lng, lat], for running to it. */
  ring?:      [number, number][];
}
