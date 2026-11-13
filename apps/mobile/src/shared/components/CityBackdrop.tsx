import React, { useMemo } from 'react';
import { G, Path, Rect } from 'react-native-svg';
import { RunivoMapColors as M } from '@theme/runivoMapStyle';

/**
 * A small drawn city — blocks, white streets, a park, sometimes a river — as on
 * the mock's feed and summary cards. It is decoration under a route thumbnail,
 * not a real map, so it renders instantly in long lists. Same `seed`, same city.
 */

function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    return ((h >>> 0) % 10000) / 10000;
  };
}

/** Cut [0, len] at uneven street positions. */
function cuts(len: number, min: number, max: number, r: () => number): number[] {
  const out = [0];
  let x = 0;
  while (x < len) { x += min + r() * (max - min); out.push(Math.min(x, len + 40)); }
  return out;
}

export function CityBackdrop({ width, height, seed }: { width: number; height: number; seed: string }) {
  const parts = useMemo(() => {
    const r = rng(seed || 'runivo');
    const xs = cuts(width, 26, 58, r);
    const ys = cuts(height, 22, 46, r);
    const blocks: string[] = [];
    for (let i = 0; i < xs.length - 1; i++) {
      for (let j = 0; j < ys.length - 1; j++) {
        const x = xs[i] + 3, y = ys[j] + 3, w = xs[i + 1] - xs[i] - 6, h = ys[j + 1] - ys[j] - 6;
        if (w > 4 && h > 4) blocks.push(`M${x + 2} ${y}h${w - 4}a2 2 0 0 1 2 2v${h - 4}a2 2 0 0 1-2 2h${-(w - 4)}a2 2 0 0 1-2-2v${-(h - 4)}a2 2 0 0 1 2-2z`);
      }
    }
    // Park: a soft blob over a few blocks.
    const px = width * (0.1 + r() * 0.55), py = height * (0.1 + r() * 0.45);
    const pw = width * (0.22 + r() * 0.18), ph = height * (0.35 + r() * 0.25);
    const park = `M${px} ${py + ph * 0.2}C${px + pw * 0.3} ${py - ph * 0.08} ${px + pw * 0.75} ${py - ph * 0.02} ${px + pw} ${py + ph * 0.25}L${px + pw * 1.05} ${py + ph * 0.85}C${px + pw * 0.75} ${py + ph * 1.08} ${px + pw * 0.3} ${py + ph * 1.1} ${px + pw * 0.05} ${py + ph * 0.92}Z`;
    // River: half the cities get one along the bottom.
    const ry = height * (0.72 + r() * 0.2);
    const river = r() < 0.5
      ? `M-10 ${ry}C${width * 0.2} ${ry - 18} ${width * 0.4} ${ry + 16} ${width * 0.62} ${ry - 4}S${width * 0.9} ${ry - 20} ${width + 10} ${ry - 6}`
      : null;
    // Two main roads, slightly off-axis.
    const a = height * (0.2 + r() * 0.5), b = width * (0.25 + r() * 0.5);
    const mains = `M0 ${a}L${width} ${a - 10 + r() * 20}M${b} 0L${b + 14 - r() * 28} ${height}`;
    const streets = xs.map(x => `M${x} 0V${height}`).join('') + ys.map(y => `M0 ${y}H${width}`).join('');
    return { blocks: blocks.join(''), park, river, mains, streets };
  }, [width, height, seed]);

  return (
    <G>
      <Rect width={width} height={height} fill={M.ground} />
      <Path d={parts.blocks} fill={M.building} />
      <Path d={parts.park} fill={M.park} />
      {parts.river && <Path d={parts.river} fill="none" stroke={M.water} strokeWidth={16} />}
      <Path d={parts.streets} stroke={M.road} strokeWidth={2.4} fill="none" />
      <Path d={parts.mains} stroke={M.casing} strokeWidth={8} fill="none" strokeLinecap="round" />
      <Path d={parts.mains} stroke={M.road} strokeWidth={6} fill="none" strokeLinecap="round" />
    </G>
  );
}
