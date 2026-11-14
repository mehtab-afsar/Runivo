/**
 * H5: "14°C · sunset 17:42" under Start. Open-Meteo (no key), last known
 * position only, cached for 30 minutes. Says nothing when it can't know.
 */
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';

let cache: { at: number; line: string } | null = null;

export function useWeatherLine(): string | null {
  const [line, setLine] = useState<string | null>(cache?.line ?? null);
  useFocusEffect(useCallback(() => {
    if (cache && Date.now() - cache.at < 30 * 60_000) { setLine(cache.line); return; }
    let live = true;
    (async () => {
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== 'granted') return;
      const fix = await Location.getLastKnownPositionAsync();
      if (!fix) return;
      const { latitude: lat, longitude: lng } = fix.coords;
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lng.toFixed(2)}&current=temperature_2m,precipitation&daily=sunrise,sunset&timezone=auto&forecast_days=1`;
      const res = await fetch(url);
      if (!res.ok) return;
      const j = await res.json() as { current?: { temperature_2m?: number; precipitation?: number }; daily?: { sunrise?: string[]; sunset?: string[] } };
      const t = j.current?.temperature_2m;
      const sunset = j.daily?.sunset?.[0], sunrise = j.daily?.sunrise?.[0];
      const now = new Date();
      const hhmm = (iso?: string) => iso ? iso.slice(11, 16) : null;
      const afterSunset = sunset ? now.getHours() * 60 + now.getMinutes() > Number(sunset.slice(11, 13)) * 60 + Number(sunset.slice(14, 16)) : false;
      const parts = [
        typeof t === 'number' ? `${Math.round(t)}°C` : null,
        (j.current?.precipitation ?? 0) > 0.1 ? 'rain' : null,
        afterSunset ? (hhmm(sunrise) && `sunrise ${hhmm(sunrise)}`) : (hhmm(sunset) && `sunset ${hhmm(sunset)}`),
      ].filter(Boolean);
      if (!parts.length || !live) return;
      const l = parts.join(' · ');
      cache = { at: Date.now(), line: l };
      setLine(l);
    })().catch(() => {});
    return () => { live = false; };
  }, []));
  return line;
}
