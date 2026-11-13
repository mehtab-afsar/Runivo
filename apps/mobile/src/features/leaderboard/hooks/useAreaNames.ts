import { useEffect, useState } from 'react';
import * as Location from 'expo-location';

/** "Bengaluru" and "Indiranagar" for the local boards' labels; never asks for permission. */
export function useAreaNames(): { city: string | null; area: string | null } {
  const [names, setNames] = useState<{ city: string | null; area: string | null }>({ city: null, area: null });
  useEffect(() => {
    (async () => {
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== 'granted') return;
      const fix = await Location.getLastKnownPositionAsync();
      if (!fix) return;
      const [r] = await Location.reverseGeocodeAsync({ latitude: fix.coords.latitude, longitude: fix.coords.longitude });
      if (r) setNames({ city: r.city ?? r.subregion ?? null, area: r.district ?? r.subregion ?? null });
    })().catch(() => {});
  }, []);
  return names;
}
