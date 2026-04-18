/**
 * Runivo mobile color tokens — single source of truth.
 *
 * Usage:
 *   import { Colors } from '@mobile/theme/colors';
 *   <View style={{ backgroundColor: Colors.bg }} />
 *
 * Every screen previously defined its own `const C = { ... }` or `const T = { ... }`.
 * Replace those with an import from this file.
 */

export const Colors = {
  // Backgrounds
  bg:      '#F8F6F3',
  surface: '#F0EDE8',
  mid:     '#E8E4DF',
  stone:   '#EDEAE5',

  // Borders & dividers
  border:  '#DDD9D4',

  // Text
  black:   '#0A0A0A',
  t1:      '#0A0A0A',
  t2:      '#6B6B6B',
  t3:      '#ADADAD',

  // Brand / interactive
  red:     '#D93518',
  white:   '#FFFFFF',

  // Semantic
  green:   '#1A6B40',
  greenBg: '#EDF7F2',
  amber:   '#9E6800',
  amberBg: '#FDF6E8',
  orange:  '#C25A00',
  orangeBg:'#FEF0E6',

  // Leaderboard medals
  gold:    '#D4A200',
  silver:  '#9E9E9E',
  bronze:  '#A0522D',

  // Aliases for legacy screen names
  muted:   '#6B6B6B',  // same as t2
  greenLo: '#EDF7F2',  // same as greenBg
  redLo:   '#FEF0EE',
  purple:  '#8B5CF6',
} as const;

export type ColorKey = keyof typeof Colors;
