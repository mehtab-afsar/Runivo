import React from 'react';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';

/** PaceX's orb: white → lavender → violet, lit from the top left (2026 design). */
export function PaceXOrb({ size = 24 }: { size?: number }) {
  const id = `pxo${size}`;
  // The big start-screen orb has a deeper rim, as in the mock.
  const hero = size >= 96;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <RadialGradient id={id} cx="35%" cy="30%" r="75%">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset={hero ? '0.35' : '0.4'} stopColor="#C9C2F6" />
          <Stop offset={hero ? '0.8' : '1'} stopColor="#7C72D8" />
          <Stop offset="1" stopColor={hero ? '#6A5FCF' : '#7C72D8'} />
        </RadialGradient>
      </Defs>
      <Circle cx={12} cy={12} r={12} fill={`url(#${id})`} />
    </Svg>
  );
}
