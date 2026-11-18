import React from 'react';
import Svg, { Defs, RadialGradient, LinearGradient, Stop, Circle, Path } from 'react-native-svg';

/** A four-point spark with curved sides, centred on (cx, cy). */
function spark(cx: number, cy: number, r: number): string {
  const a = r * 0.18;
  return `M${cx} ${cy - r}C${cx + a} ${cy - a} ${cx + a} ${cy - a} ${cx + r} ${cy}`
    + `C${cx + a} ${cy + a} ${cx + a} ${cy + a} ${cx} ${cy + r}`
    + `C${cx - a} ${cy + a} ${cx - a} ${cy + a} ${cx - r} ${cy}`
    + `C${cx - a} ${cy - a} ${cx - a} ${cy - a} ${cx} ${cy - r}Z`;
}
const BIG = spark(11.2, 12.8, 6.6);
const SMALL = spark(17, 7, 2.4);

/**
 * PaceX's mark: an ink disc with a lavender spark and a small lime one.
 * Ink and lime are Runivo's; lavender stays PaceX's colour. Same name and
 * props as the old gradient orb, so every call site picks it up.
 */
export function PaceXOrb({ size = 24 }: { size?: number }) {
  const id = `pxo${size}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <RadialGradient id={`${id}b`} cx="30%" cy="25%" r="85%">
          <Stop offset="0" stopColor="#34363A" />
          <Stop offset="1" stopColor="#17181A" />
        </RadialGradient>
        <LinearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#E4E0FF" />
          <Stop offset="1" stopColor="#A79BFF" />
        </LinearGradient>
      </Defs>
      <Circle cx={12} cy={12} r={12} fill={`url(#${id}b)`} />
      <Path d={BIG} fill={`url(#${id}s)`} />
      <Path d={SMALL} fill="#C9F06B" />
      {/* A hairline so the disc still reads on the dark theme. */}
      <Circle cx={12} cy={12} r={11.8} fill="none" stroke="#FFFFFF" strokeOpacity={0.1} strokeWidth={0.4} />
    </Svg>
  );
}
