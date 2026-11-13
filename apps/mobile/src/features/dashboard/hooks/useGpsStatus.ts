import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';

export type GpsStatus = 'checking' | 'ready' | 'searching' | 'off';

/**
 * GPS readiness for the Start run pill. Never prompts: 'off' when location
 * isn't granted, 'ready' once a fix exists (last known within 2 minutes, or a
 * fresh low-accuracy fix), 'searching' while none has arrived.
 */
export function useGpsStatus(): GpsStatus {
  const [status, setStatus] = useState<GpsStatus>('checking');

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    (async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (cancelled) return;
        if (perm.status !== 'granted') { setStatus('off'); return; }
        const last = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60 * 1000 });
        if (cancelled) return;
        if (last) { setStatus('ready'); return; }
        setStatus('searching');
        const fix = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
          new Promise<null>(resolve => setTimeout(() => resolve(null), 8000)),
        ]);
        if (!cancelled) setStatus(fix ? 'ready' : 'searching');
      } catch {
        if (!cancelled) setStatus('off');
      }
    })();
    return () => { cancelled = true; };
  }, []));

  return status;
}
