/**
 * Runivo mobile typography tokens (2026 design system).
 *
 * Two voices:
 *  - Geist                    -> everything you read: titles, body, labels, buttons.
 *  - Archivo Display          -> big numbers (distance, pace, score, PACE) and
 *                                uppercase hero headlines. Archivo cut at 68% width,
 *                                850 weight (assets/fonts/ArchivoDisplay.ttf).
 *  - Archivo Wordmark         -> the runivo logotype only.
 *
 * RULES
 *  - Titles are sentence case Geist bold. Only Type.hero is uppercase.
 *  - Small labels are sentence case Geist medium in t2, not tracked caps.
 *  - Live numbers use a metric* style (tabular figures, no digit jitter).
 *  - Never write a raw font-family string; compose Fonts.* or Type.*.
 */
import type { TextStyle } from 'react-native';

export const Fonts = {
  /** Kept for older call sites: maps to Geist regular. Prefer `regular`. */
  light:     'Geist_400Regular',
  regular:   'Geist_400Regular',
  medium:    'Geist_500Medium',
  semiBold:  'Geist_600SemiBold',
  bold:      'Geist_700Bold',
  /** Former editorial italic. Now Geist bold: titles and greetings, sentence case. */
  display:   'Geist_700Bold',
  /** Big numbers: distance, pace, time, score, PACE balances. */
  numeric:   'ArchivoDisplay',
  /** Hero headlines, uppercase, used sparingly (Run complete, reward value, Plus). */
  hero:      'ArchivoDisplay',
  /** The runivo logotype. */
  wordmark:  'ArchivoWordmark',
} as const;

const tabular: TextStyle['fontVariant'] = ['tabular-nums'];

/** Semantic type scale — compose with a color, e.g. `[Type.title, { color: C.t1 }]`. */
export const Type = {
  // Titles (Geist bold, sentence case)
  display:    { fontFamily: Fonts.bold, fontSize: 30, lineHeight: 34, letterSpacing: -0.8 },
  displaySm:  { fontFamily: Fonts.bold, fontSize: 22, lineHeight: 27, letterSpacing: -0.5 },
  // Hero moments only (condensed caps)
  hero:       { fontFamily: Fonts.hero, fontSize: 54, lineHeight: 49, textTransform: 'uppercase' as const },

  // Big data: the numbers are the design in a running app
  metricXL:   { fontFamily: Fonts.numeric, fontSize: 88, lineHeight: 84, letterSpacing: -1, fontVariant: tabular },
  metricLg:   { fontFamily: Fonts.numeric, fontSize: 52, lineHeight: 50, letterSpacing: -0.5, fontVariant: tabular },
  metricMd:   { fontFamily: Fonts.numeric, fontSize: 30, lineHeight: 30, fontVariant: tabular },
  metricSm:   { fontFamily: Fonts.numeric, fontSize: 20, lineHeight: 20, fontVariant: tabular },

  // UI text
  title:      { fontFamily: Fonts.bold,     fontSize: 20, letterSpacing: -0.4, lineHeight: 25 },
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
