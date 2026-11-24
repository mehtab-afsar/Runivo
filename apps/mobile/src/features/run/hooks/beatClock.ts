/**
 * The pacer's beat arithmetic, kept free of React Native so it can be tested.
 *
 * `advanceBeat` is called from a 25 ms JS interval. It fires at most ONE click per
 * call. When the interval was late by a whole beat or more (the JS thread was busy,
 * or iOS suspended timers with the screen locked and then resumed them) the missed
 * beats are dropped and the clock re-anchors on `now`, instead of firing a burst of
 * catch-up clicks.
 */
export interface BeatStep {
  /** Play a click now. */
  fire: boolean;
  /** Time (ms) of the next beat. */
  next: number;
}

export function advanceBeat(next: number, now: number, intervalMs: number): BeatStep {
  if (now < next) return { fire: false, next };
  // On time, or late by less than a beat: keep the grid so the tempo does not drift.
  if (now - next < intervalMs) return { fire: true, next: next + intervalMs };
  // A beat or more behind: drop what was missed and re-anchor.
  return { fire: true, next: now + intervalMs };
}

/** The ticker may run only when every one of these holds. */
export function shouldTick(s: { enabled: boolean; running: boolean; foreground: boolean }): boolean {
  return s.enabled && s.running && s.foreground;
}
