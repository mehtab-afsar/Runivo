import { useEffect, useState } from 'react';
import * as Location from 'expo-location';

/**
 * Whether foreground location permission is currently granted.
 *
 * Guards MapLibre's `<UserLocation>`: its native renderer raises an NSException
 * from -[MLRNNativeUserLocation setMap:] when attached to a map without location
 * authorization, and an unhandled ObjC exception aborts the whole process. So a
 * user who taps "Don't Allow" would hard-crash the app the moment any screen
 * with a map rendered — onboarding, the dashboard mini-map, the territory map,
 * and both run maps.
 *
 * Always gate the user-location layer on this:
 *   {granted && <ML.UserLocation visible renderMode="native" />}
 *
 * Only *reads* the current status — it never prompts. Screens that legitimately
 * need to request permission (onboarding, run setup) do so themselves.
 */
export function useLocationGranted(): boolean {
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Location.getForegroundPermissionsAsync()
      .then(({ status }) => { if (!cancelled) setGranted(status === 'granted'); })
      .catch(() => { if (!cancelled) setGranted(false); });
    return () => { cancelled = true; };
  }, []);

  return granted;
}
