import { haptic } from './haptics';
import { playSound } from './sounds';

export const feedback = {
  gpsLocked:   () => { haptic.success(); playSound('gps_locked'); },
  runStart:    () => { haptic.heavy();   playSound('run_start'); },
  kmTick:      () => { haptic.light();   playSound('km_tick'); },
  zoneClaimed: () => { haptic.medium();  playSound('zone_claimed'); },
  runPause:    () => { haptic.light();   playSound('run_pause'); },
  runComplete: () => { haptic.success(); playSound('run_complete'); },
  awardUnlock: () => { haptic.success(); playSound('award_unlock'); },
  rankUp:      () => {
    haptic.success();
    setTimeout(() => haptic.success(), 300);
    playSound('rank_up');
  },
  paceCap:     () => { haptic.success(); playSound('pace_cap'); },
  rivalNearby: () => { haptic.warning(); playSound('rival_nearby'); },
} as const;
