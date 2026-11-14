/** JS side of the RunivoWorkouts native module (Apple Watch scheduling, T7). */
import { requireOptionalNativeModule } from 'expo';

export interface WatchStep { kind: 'warmup' | 'run' | 'recover' | 'cooldown'; distanceM?: number; durationSec?: number }
export interface WatchSession { title: string; date: string; steps: WatchStep[] }

interface Native { isSupported(): Promise<boolean>; schedule(s: WatchSession): Promise<boolean> }

/** Null on Android and on builds made before this module existed. */
export function getWatchWorkouts(): Native | null {
  try { return requireOptionalNativeModule<Native>('RunivoWorkouts'); } catch { return null; }
}
