import { friendColor } from '@theme/territory';
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import type { LiveFriendRunner } from '../hooks/useLiveFriendRuns';
import { Avatar } from '@mobile/shared/components/Avatar';

const TICK_MS = 200;

// Positions arrive roughly every 6s (LIVE_SHARE_INTERVAL_MS in useActiveRun.ts).
// Snapping the marker straight to each new point would look like a teleport;
// this tweens from the last displayed point to the new one over that same
// window, so a friend's avatar reads as running rather than jumping.
export function LiveFriendMarker({ runner, onPress }: { runner: LiveFriendRunner; onPress?: () => void }) {
  const [display, setDisplay] = useState({ lat: runner.lat, lng: runner.lng });
  const fromRef   = useRef({ lat: runner.lat, lng: runner.lng });
  const toRef     = useRef({ lat: runner.lat, lng: runner.lng });
  const startRef  = useRef(Date.now());
  const spanRef   = useRef(6000);
  const prevUpdatedAtRef = useRef(runner.updatedAt);

  useEffect(() => {
    fromRef.current  = display;
    toRef.current     = { lat: runner.lat, lng: runner.lng };
    startRef.current  = Date.now();
    spanRef.current    = Math.min(10_000, Math.max(1000, runner.updatedAt - prevUpdatedAtRef.current || 6000));
    prevUpdatedAtRef.current = runner.updatedAt;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runner.lat, runner.lng, runner.updatedAt]);

  useEffect(() => {
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - startRef.current) / spanRef.current);
      const from = fromRef.current;
      const to = toRef.current;
      setDisplay({
        lat: from.lat + (to.lat - from.lat) * t,
        lng: from.lng + (to.lng - from.lng) * t,
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);


  return (
    <MapLibreGL.PointAnnotation id={`live-friend-${runner.userId}`} coordinate={[display.lng, display.lat]} onSelected={onPress}>
      <View style={ss.wrap}>
        {/* Ring colour is per friend and never your trail red or rival blue. */}
        <View style={[ss.pulse, { borderColor: friendColor(runner.userId) }]} />
        <View style={[ss.dot, { backgroundColor: friendColor(runner.userId), overflow: 'hidden' }]}>
          <Avatar name={runner.username} uri={runner.avatarUrl} size={20} />
        </View>
      </View>
    </MapLibreGL.PointAnnotation>
  );
}

const ss = StyleSheet.create({
  wrap:   { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  pulse:  { position: 'absolute', width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, opacity: 0.35 },
  dot:    { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  initial:{ fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
});
