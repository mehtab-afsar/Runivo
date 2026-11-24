/** GPS tuning shared by the watcher, the fix handler and the background merge. */
import * as Location from 'expo-location';
import { isOnFoot } from '@shared/engine/runEngine';
import { MAX_FOOT_SPEED_MS, MAX_RIDE_SPEED_MS } from '../../services/gpsFilter';

/**
 * Fastest believable speed for the sport. Same split as the server: every territory
 * sport is on foot, everything else rides.
 */
export const maxSpeedFor = (activityType: string): number =>
  (isOnFoot(activityType) ? MAX_FOOT_SPEED_MS : MAX_RIDE_SPEED_MS);

/**
 * 'standard' still needs to be good enough for territory-corridor accuracy: it is one
 * step down from BestForNavigation, not a big drop to Balanced/Low, since claimed-zone
 * geometry and the PACE economy both depend on this track.
 */
export function resolveGpsAccuracy(setting: 'standard' | 'high'): Location.Accuracy {
  return setting === 'standard' ? Location.Accuracy.High : Location.Accuracy.BestForNavigation;
}
