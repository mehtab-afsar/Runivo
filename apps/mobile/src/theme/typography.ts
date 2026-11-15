/**
 * Runivo mobile typography tokens (2026 design system).
 *
 * One voice: Outfit (2026 redesign) for titles, body, labels, buttons, big
 * numbers and the runivo wordmark. Numbers use tabular figures.
 *
 * RULES
 *  - Everything is sentence case, including Type.hero.
 *  - Small labels are sentence case Outfit medium in t2, not tracked caps.
 *  - Live numbers use a metric* style (tabular figures, no digit jitter).
 *  - Never write a raw font-family string; compose Fonts.* or Type.*.
 */
import type { TextStyle } from 'react-native';

export const Fonts = {
  /** Kept for older call sites: maps to Outfit regular. Prefer `regular`. */
  light:     'Outfit_400Regular',
  regular:   'Outfit_400Regular',
  medium:    'Outfit_500Medium',
  semiBold:  'Outfit_600SemiBold',
  bold:      'Outfit_700Bold',
  /** Titles and greetings: Outfit semibold, sentence case. */
  display:   'Outfit_600SemiBold',
  /** Big numbers: distance, pace, time, score, PACE balances. */
  numeric:   'Outfit_600SemiBold',
  /** Hero moments (Run complete, reward value, Plus): Outfit semibold, sentence case. */
  hero:      'Outfit_600SemiBold',
  /** The runivo logotype. */
  wordmark:  'Outfit_700Bold',
} as const;

const tabular: TextStyle['fontVariant'] = ['tabular-nums'];

/** Semantic type scale — compose with a color, e.g. `[Type.title, { color: C.t1 }]`. */
export const Type = {
  // Titles (Outfit semibold, sentence case)
  display:    { fontFamily: Fonts.display, fontSize: 30, lineHeight: 34, letterSpacing: -0.8 },
  displaySm:  { fontFamily: Fonts.display, fontSize: 22, lineHeight: 27, letterSpacing: -0.5 },
  // Hero moments only
  hero:       { fontFamily: Fonts.hero, fontSize: 44, lineHeight: 48, letterSpacing: -1.4 },

  // Big data: the numbers are the design in a running app
  metricXL:   { fontFamily: Fonts.numeric, fontSize: 76, lineHeight: 80, letterSpacing: -2.5, fontVariant: tabular },
  metricLg:   { fontFamily: Fonts.numeric, fontSize: 46, lineHeight: 50, letterSpacing: -1.5, fontVariant: tabular },
  metricMd:   { fontFamily: Fonts.numeric, fontSize: 28, lineHeight: 32, letterSpacing: -0.6, fontVariant: tabular },
  metricSm:   { fontFamily: Fonts.numeric, fontSize: 19, lineHeight: 23, letterSpacing: -0.3, fontVariant: tabular },

  // UI text
  title:      { fontFamily: Fonts.semiBold,     fontSize: 20, letterSpacing: -0.4, lineHeight: 25 },
  headline:   { fontFamily: Fonts.semiBold, fontSize: 15, lineHeight: 20 },
  body:       { fontFamily: Fonts.regular,  fontSize: 15, lineHeight: 22 },
  bodySm:     { fontFamily: Fonts.regular,  fontSize: 13, lineHeight: 18 },
  label:      { fontFamily: Fonts.medium,   fontSize: 13, lineHeight: 17 },
  labelSm:    { fontFamily: Fonts.medium,   fontSize: 12, lineHeight: 15 },
  button:     { fontFamily: Fonts.semiBold, fontSize: 15 },

  // Section label: sentence case, quiet. (Name kept for existing call sites.)
  overline:   { fontFamily: Fonts.medium, fontSize: 12, letterSpacing: 0 },
  caption:    { fontFamily: Fonts.regular, fontSize: 12, lineHeight: 16 },
} as const satisfies Record<string, TextStyle>;

export const FontSize = {
  largeTitle: 34,
  title1:     28,
  title2:     22,
  title3:     20,
  headline:   17,
  body:       17,
  callout:    16,
  subhead:    15,
  footnote:   13,
  caption1:   12,
  caption2:   11,
} as const;

export const FontWeight = {
  regular:  '400' as const,
  medium:   '500' as const,
  semibold: '600' as const,
  bold:     '700' as const,
} as const;
