/** A small drawing of an activity's route, for lists and the pinned card. */
import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { useTheme } from '@theme';

export function RouteThumb({ points, width, height, radius = 12, stroke = 2.5 }: {
  points: { lat: number; lng: number }[] | undefined; width: number; height: number; radius?: number; stroke?: number;
}) {
  const C = useTheme();
  const path = useMemo(() => {
    if (!points || points.length < 2) return null;
    const step = Math.max(1, Math.floor(points.length / 200));
    const pts = points.filter((_, i) => i % step === 0);
    const lat0 = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
    const k = Math.cos((lat0 * Math.PI) / 180);
    const xs = pts.map(p => p.lng * k), ys = pts.map(p => -p.lat);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const pad = stroke * 3;
    const span = Math.max(maxX - minX, maxY - minY, 1e-9);
    const scale = Math.min((width - pad * 2) / Math.max(maxX - minX, 1e-9), (height - pad * 2) / Math.max(maxY - minY, 1e-9), (Math.max(width, height) - pad * 2) / span);
    const ox = (width - (maxX - minX) * scale) / 2, oy = (height - (maxY - minY) * scale) / 2;
    return xs.map((x, i) => `${((x - minX) * scale + ox).toFixed(1)},${((ys[i] - minY) * scale + oy).toFixed(1)}`).join(' ');
  }, [points, width, height, stroke]);

  return (
    <View style={{ width, height, borderRadius: radius, backgroundColor: C.surface, overflow: 'hidden' }}>
      {path && (
        <Svg width={width} height={height}>
          <Polyline points={path} fill="none" stroke={C.red} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
    </View>
  );
}
