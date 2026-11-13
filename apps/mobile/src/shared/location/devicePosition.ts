import * as Location from 'expo-location';

export interface DevicePosition { lat: number; lng: number }

/**
 * The device's position, without ever asking for permission. Uses the last
 * known fix when it's fresh enough; otherwise, if location is already
 * granted, takes one quick low-accuracy fix (a fresh install or a simulator
 * often has no last known position yet). Returns null when location isn't
 * granted or no fix arrives in time.
 */
export async function positionIfAllowed(opts: { maxAgeMs?: number; timeoutMs?: number } = {}): Promise<DevicePosition | null> {
  const { maxAgeMs = 6 * 60 * 60 * 1000, timeoutMs = 6000 } = opts;
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== 'granted') return null;
    let pos = await Location.getLastKnownPositionAsync({ maxAge: maxAgeMs });
    if (!pos) {
      pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
        new Promise<null>(resolve => setTimeout(() => resolve(null), timeoutMs)),
      ]);
    }
    if (!pos) return null;
    const { latitude: lat, longitude: lng } = pos.coords;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

/** Whether location is already granted (never prompts). */
export async function locationGranted(): Promise<boolean> {
  try {
    return (await Location.getForegroundPermissionsAsync()).status === 'granted';
  } catch {
    return false;
  }
}
