/**
 * A small static map for cards (Home's territory card): your zones and any
 * rival zones nearby drawn as shapes over a quiet street grid. No map tiles,
 * so it costs nothing to render.
 */
import React, { useMemo } from 'react';
import Svg, { Rect, Path, G, Circle } from 'react-native-svg';
import { useTheme } from '@theme';

type Ring = [number, number][]; // [lng, lat]

export function ZonePreview({ own, rivals = [], fading = [], width, height }: {
  own: Ring[]; rivals?: Ring[]; fading?: Ring[]; width: number; height: number;
}) {
  const C = useTheme();
  const paths = useMemo(() => {
    const all = [...own, ...rivals, ...fading].filter(r => r.length >= 3);
    if (all.length === 0) return null;
    const pts = all.flat();
    const midLat = pts.reduce((n, p) => n + p[1], 0) / pts.length;
    const kx = Math.cos((midLat * Math.PI) / 180);
    const xs = pts.map(p => p[0] * kx), ys = pts.map(p => -p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const pad = 18;
    const scale = Math.min((width - pad * 2) / Math.max(maxX - minX, 1e-6), (height - pad * 2) / Math.max(maxY - minY, 1e-6));
    const offX = (width - (maxX - minX) * scale) / 2, offY = (height - (maxY - minY) * scale) / 2;
    const toPath = (r: Ring) => r.map(([lng, lat], i) => `${i ? 'L' : 'M'}${(offX + (lng * kx - minX) * scale).toFixed(1)} ${(offY + (-lat - minY) * scale).toFixed(1)}`).join(' ') + ' Z';
    return { own: own.map(toPath), rivals: rivals.map(toPath), fading: fading.map(toPath) };
  }, [own, rivals, fading, width, height]);

  return (
    <Svg width={width} height={height}>
      <Rect width={width} height={height} fill={C.stone} />
      <G stroke={C.card} strokeWidth={8} strokeLinecap="round">
        <Path d={`M-10 ${height * 0.58} L${width + 10} ${height * 0.5}`} />
        <Path d={`M${width * 0.5} -10 L${width * 0.53} ${height + 10}`} />
        <Path d={`M${width * 0.16} -10 L${width * 0.13} ${height + 10}`} />
        <Path d={`M${width * 0.83} -10 L${width * 0.86} ${height + 10}`} />
      </G>
      {paths?.rivals.map((d, i) => <Path key={`r${i}`} d={d} fill={C.rivalAmber} fillOpacity={0.26} stroke={C.rivalAmber} strokeWidth={2.4} strokeLinejoin="round" />)}
      {paths?.fading.map((d, i) => <Path key={`f${i}`} d={d} fill="none" stroke={C.brandGreen} strokeWidth={2} strokeDasharray="5 4" />)}
      {paths?.own.map((d, i) => <Path key={`o${i}`} d={d} fill={C.brandGreen} fillOpacity={0.3} stroke={C.brandGreen} strokeWidth={2.4} strokeLinejoin="round" />)}
      {!paths && <Circle cx={width / 2} cy={height / 2} r={7} fill={C.ink} stroke={C.card} strokeWidth={3} />}
    </Svg>
  );
}
