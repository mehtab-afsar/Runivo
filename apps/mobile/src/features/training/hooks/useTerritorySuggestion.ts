/**
 * Today's suggestion when there's no plan session (PRD H1): a loop that
 * refreshes your nearest fading zones, or claims new ground. Uses the last
 * known position only; never asks for location here.
 */
import { streetLoop } from '@features/territory/services/loopRouting';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { getPlayer } from '@shared/services/store';
import { GAME_CONFIG } from '@shared/services/config';
import { haversineM } from '@shared/engine/runEngine';
import { ringCentroid } from '@shared/engine/targetZone';
import { planLoop, suggestedLoopKm } from '@shared/engine/planLoop';
import { fetchOwnPolygons } from '@features/territory/services/territoryService';

export interface TerritorySuggestion { title: string; sub: string; points: { lat: number; lng: number }[] }

/**
 * With `distanceKm` (T6: an easy, long or recovery session), the loop is that
 * long and only offered when it refreshes at least one fading zone.
 */
export function useTerritorySuggestion(enabled: boolean, distanceKm?: number): TerritorySuggestion | null {
  const [s, setS] = useState<TerritorySuggestion | null>(null);
  useFocusEffect(useCallback(() => {
    if (!enabled) { setS(null); return; }
    let live = true;
    (async () => {
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== 'granted') return;
      const fix = await Location.getLastKnownPositionAsync();
      const me = (await getPlayer())?.id;
      if (!fix || !me) return;
      const pos = { lat: fix.coords.latitude, lng: fix.coords.longitude };
      const own = await fetchOwnPolygons(me);
      const zones = own.map(p => ({ ring: p.polygon, fading: p.freshness < GAME_CONFIG.FRESHNESS_STALE_AT }));
      const fading = zones.filter(z => z.fading && z.ring.length >= 3)
        .map(z => haversineM(pos, ringCentroid(z.ring))).filter(d => d <= 4000).sort((a, b) => a - b);
      const km = distanceKm ? Math.max(2, Math.round(distanceKm)) : suggestedLoopKm(fading[0] ?? null);
      const circle = planLoop(pos, km * 1000, fading.length ? 'refresh' : 'new', zones);
      // On real streets when the router answers; the circle otherwise.
      const plan = (await streetLoop(circle, zones, { orsKey: process.env.EXPO_PUBLIC_ORS_KEY })) ?? circle;
      if (!live) return;
      if (distanceKm) {
        setS(fading.length && plan.refreshes
          ? { title: `${km} km loop`, sub: `This route refreshes ${plan.refreshes} of your fading zone${plan.refreshes > 1 ? 's' : ''}`, points: plan.points }
          : null);
        return;
      }
      setS(fading.length && plan.refreshes
        ? { title: `Easy ${km} km loop`, sub: `Refreshes ${plan.refreshes} of your fading zone${plan.refreshes > 1 ? 's' : ''} before a rival takes ${plan.refreshes > 1 ? 'them' : 'it'}`, points: plan.points }
        : { title: `Easy ${km} km loop`, sub: `About ${Math.round(plan.newShare * 100)}% new ground for you`, points: plan.points });
    })().catch(() => {});
    return () => { live = false; };
  }, [enabled, distanceKm]));
  return s;
}
