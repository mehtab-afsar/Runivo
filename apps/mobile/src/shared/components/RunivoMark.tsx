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

/** The mock's inline logo geometry (next to the wordmark): the hexagon fills its box. */
const INLINE_PATH = 'M32 4 56.2 18v28L32 60 7.8 46V18Z';

/**
 * `inline` draws the hexagon edge to edge, as in the mock's headers next to
 * "runivo". Without it the mark keeps the app icon's padding (the launch
 * animation and icon share that shape), which made header logos ~30% small.
 */
export function RunivoMark({ size = 32, color = '#F2A43A', strokeWidth = MARK_STROKE, inline = false }: { size?: number; color?: string; strokeWidth?: number; inline?: boolean }) {
  if (inline) {
    return (
      <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityElementsHidden importantForAccessibility="no">
        <Path d={INLINE_PATH} fill="none" stroke={color} strokeWidth={7} strokeLinejoin="round" />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityElementsHidden importantForAccessibility="no">
      <Path d={MARK_PATH} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    </Svg>
  );
}
