import React from 'react';
import Svg, { Path } from 'react-native-svg';

/**
 * The Runivo mark: a closed hexagon outline, pointy top, round joins.
 * Same shape as the app icon (assets/icon.png); drawn in a 100-unit box.
 */
export const MARK_RADIUS = 31;
export const MARK_STROKE = 6.5;

function hexPath(r: number): string {
  const pts = [-90, -30, 30, 90, 150, 210].map(a => {
    const rad = (a * Math.PI) / 180;
    return `${(50 + r * Math.cos(rad)).toFixed(2)} ${(50 + r * Math.sin(rad)).toFixed(2)}`;
  });
  return `M${pts.join(' L')} Z`;
}

/** Starts at the top corner and runs clockwise: the order the launch animation draws it. */
export const MARK_PATH = hexPath(MARK_RADIUS);
/** Length of the outline in the 100-unit box (six sides of length r). */
export const MARK_PERIMETER = 6 * MARK_RADIUS;

export function RunivoMark({ size = 32, color = '#FF4518', strokeWidth = MARK_STROKE }: { size?: number; color?: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityElementsHidden importantForAccessibility="no">
      <Path d={MARK_PATH} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    </Svg>
  );
}
