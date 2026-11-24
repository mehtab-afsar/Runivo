import type { RunSession } from './types';

/**
 * Accumulates climb. Gains under 0.5 m are GPS altitude noise. Altitude is commonly null
 * on the first fix or two (no 3D lock yet); zero-filling it recorded a fake "sea level"
 * reading, so the first real altitude (say 40 m) counted as a one-off +40 m gain. Only
 * deltas between two genuine readings count; samples without altitude are skipped.
 */
export function trackElevation(s: RunSession, altitude: number | null | undefined): void {
  if (altitude === null || altitude === undefined) return;
  if (s.prevAltitude !== null && altitude > s.prevAltitude + 0.5) {
    s.elevationGain += altitude - s.prevAltitude;
  }
  s.prevAltitude = altitude;
}
