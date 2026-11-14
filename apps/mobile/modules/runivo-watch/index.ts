/** JS side of the RunivoWatch module (L4). Null on Android and older builds. */
import { requireOptionalNativeModule } from 'expo';

export type WatchCommand = 'start' | 'pause' | 'resume' | 'end';
export interface WatchState {
  phase: 'ready' | 'running' | 'paused' | 'done';
  distance: string; unit: string; time: string; pace: string; paceLabel: string; zone?: string;
}

interface Native {
  isAvailable(): boolean;
  sendState(state: WatchState): void;
  addListener(event: 'onCommand', fn: (e: { command: WatchCommand }) => void): { remove(): void };
}

export function getWatch(): Native | null {
  try { return requireOptionalNativeModule<Native>('RunivoWatch'); } catch { return null; }
}
