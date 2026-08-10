import React from 'react';
import { CaretRight } from 'phosphor-react-native';
import { useTheme } from '@theme';

interface RowChevronProps {
  size?: number;
  color?: string;
}

// Standard "this row navigates somewhere" affordance. Several screens rendered
// this as a bare '→' / '›' Text character instead — inconsistent weight/size
// against every other icon on the same row, and invisible to icon-only
// accessibility tooling. Use this instead of a raw arrow character.
export function RowChevron({ size = 16, color }: RowChevronProps) {
  const C = useTheme();
  return <CaretRight size={size} color={color ?? C.t3} weight="regular" />;
}
