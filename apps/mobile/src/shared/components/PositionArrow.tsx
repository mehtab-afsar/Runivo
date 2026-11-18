/**
 * The runner's position on every map: a still arrow pointing the way they are
 * going. It replaces MapLibre's native puck, whose pulsing dot and wide
 * accuracy halo read as noise and hid the street under the runner.
 *
 * Direction: while moving, the bearing of the last few metres of track; when
 * standing (or with no track), the phone's compass. Drawn as a map symbol so it
 * moves with the map natively (no JS animation; the JS puck breaks on RN 0.83).
 */
import React, { useEffect, useMemo, useState } from 'react';
import MapLibreGL from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { bearingDeg } from '@shared/engine/targetZone';
import { haversineM } from '@shared/engine/runEngine';

const ARROW = require('../../../assets/images/position-arrow.png');

type Pt = { lat: number; lng: number };

/** Bearing of the track's last stretch of at least `minM` metres, or null. */
export function trackBearing(points: Pt[], minM = 8): number | null {
  if (points.length < 2) return null;
  const last = points[points.length - 1];
  for (let i = points.length - 2; i >= 0 && i >= points.length - 30; i--) {
    if (haversineM(points[i], last) >= minM) return bearingDeg(points[i], last);
  }
  return null;
}

/** The phone's compass heading (true north when known), or null. */
function useCompass(enabled: boolean): number | null {
  const [deg, setDeg] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let sub: Location.LocationSubscription | null = null;
    let live = true;
    Location.watchHeadingAsync(h => {
      const v = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
      if (Number.isFinite(v)) setDeg(Math.round(v / 5) * 5); // 5° steps: no jitter
    }).then(s => { if (live) sub = s; else s.remove(); }).catch(() => {});
    return () => { live = false; sub?.remove(); };
  }, [enabled]);
  return deg;
}

/** Follows the phone's position itself, for maps that don't track one already. */
function useOwnPosition(enabled: boolean): Pt | null {
  const [pos, setPos] = useState<Pt | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let sub: Location.LocationSubscription | null = null;
    let live = true;
    Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, distanceInterval: 5 }, l => {
      setPos({ lat: l.coords.latitude, lng: l.coords.longitude });
    }).then(s => { if (live) sub = s; else s.remove(); }).catch(() => {});
    return () => { live = false; sub?.remove(); };
  }, [enabled]);
  return pos;
}

/** Pass lat/lng (and the run's track) where the screen already has them; leave them out to follow the phone. */
export function PositionArrow({ lat: givenLat, lng: givenLng, track, id = 'me' }: { lat?: number | null; lng?: number | null; track?: Pt[]; id?: string }) {
  const own = useOwnPosition(givenLat === undefined);
  const lat = givenLat === undefined ? own?.lat ?? null : givenLat;
  const lng = givenLng === undefined ? own?.lng ?? null : givenLng;
  const moving = track ? trackBearing(track) : null;
  const compass = useCompass(moving == null);
  const heading = moving ?? compass ?? 0;
  const shape = useMemo(() => (lat == null || lng == null ? null : {
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [lng, lat] },
    properties: { heading },
  }), [lat, lng, heading]);
  if (!shape) return null;
  return (
    <>
      <MapLibreGL.Images images={{ [`${id}-arrow`]: ARROW }} />
      <MapLibreGL.ShapeSource id={`${id}-position`} shape={shape}>
        <MapLibreGL.SymbolLayer
          id={`${id}-position-arrow`}
          style={{
            iconImage: `${id}-arrow`,
            iconSize: 0.8,
            iconRotate: ['get', 'heading'],
            iconRotationAlignment: 'map',
            iconAllowOverlap: true,
            iconIgnorePlacement: true,
          }}
        />
      </MapLibreGL.ShapeSource>
    </>
  );
}
