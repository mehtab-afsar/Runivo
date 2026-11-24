import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ActivityType } from '../types';
import { SPORTS } from './activities';

/** The record screen and Home's Start button remember the last sport, as Strava does. */
const KEY = 'runivo.lastSport';

export async function getLastSport(): Promise<ActivityType> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return SPORTS.some(s => s.id === v) ? (v as ActivityType) : 'run';
  } catch {
    // The remembered sport is a convenience; default to running.
    return 'run';
  }
}

export function setLastSport(id: ActivityType): void {
  AsyncStorage.setItem(KEY, id).catch(() => {});
}
