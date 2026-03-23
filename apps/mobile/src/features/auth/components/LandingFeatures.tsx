import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Polygon, Circle, Rect } from 'react-native-svg';

function pts(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
}

function PhoneMockup() {
  const R = 9;
  const W = R * Math.sqrt(3);
  const VS = R * 1.5;
  const caps = new Set(['2,1', '3,1', '2,2', '3,2', '4,2', '3,3']);
  const tiles: { cx: number; cy: number; cap: boolean }[] = [];

  for (let row = 0; row < 11; row++) {
    for (let col = 0; col < 9; col++) {
      tiles.push({
        cx: col * W + (row % 2 ? W / 2 : 0) + W / 2,
        cy: row * VS + R,
        cap: caps.has(`${col},${row}`),
      });
    }
  }

  const userDot = tiles.find(t => t.cap) ?? { cx: 50, cy: 30 };

  return (
    <View style={s.phoneMockup}>
      <View style={s.dynamicIsland} />
      <Svg viewBox="0 0 140 200" width={136} height={256} style={{ position: 'absolute', top: 28 }}>
        <Rect width="140" height="200" fill="#0F0F12" />
        {tiles.map((t, i) => (
          <Polygon
            key={i}
            points={pts(t.cx, t.cy, R - 0.8)}
            fill={t.cap ? 'rgba(217,53,24,0.22)' : 'rgba(255,255,255,0.03)'}
            stroke={t.cap ? '#D93518' : 'rgba(255,255,255,0.07)'}
            strokeWidth="0.6"
          />
        ))}
        <Circle cx={userDot.cx} cy={userDot.cy} r="5" fill="white" />
        <Circle cx={userDot.cx} cy={userDot.cy} r="3" fill="#D93518" />
      </Svg>
    </View>
  );
}

export default function LandingFeatures() {
  return (
    <View style={s.wrap}>
      <PhoneMockup />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  phoneMockup: {
    width: 136, height: 256, borderRadius: 26,
    backgroundColor: '#0F0F12', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', overflow: 'hidden',
    position: 'relative', alignItems: 'center',
  },
  dynamicIsland: {
    position: 'absolute', top: 10, width: 48, height: 16,
    borderRadius: 8, backgroundColor: '#000', zIndex: 10,
  },
});
