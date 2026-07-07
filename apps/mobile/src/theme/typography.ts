/**
 * Runivo mobile typography tokens.
 *
 * Two voices, on purpose:
 *  - Barlow (grotesque)         → everything functional: metrics, body, labels, buttons.
 *  - Playfair Display (italic)  → editorial accents only: greetings, hero moments,
 *                                 celebration headlines. Never for data or UI chrome.
 *
 * RULES
 *  - Every <Text> should compose one `Type.*` style; never write a raw
 *    'Barlow_600SemiBold' string literal or a bare fontWeight (a bare fontWeight
 *    silently falls back to the SYSTEM font — SF next to Barlow is the #1 reason
 *    a screen reads as unpolished).
 *  - 10px is the absolute floor, and only for tracked-uppercase overlines.
 *  - Numbers that update live (timers, distance, PACE counts) must use a
 *    `metric*` style — they carry `tabular-nums` so digits don't jitter.
 */
import type { TextStyle } from 'react-native';

export const Fonts = {
  light:     'Barlow_300Light',
  regular:   'Barlow_400Regular',
  medium:    'Barlow_500Medium',
  semiBold:  'Barlow_600SemiBold',
  bold:      'Barlow_700Bold',
  display:   'PlayfairDisplay_400Regular_Italic',
} as const;

const tabular: TextStyle['fontVariant'] = ['tabular-nums'];

/** Semantic type scale — compose with a color, e.g. `[Type.title, { color: C.t1 }]`. */
export const Type = {
  // Editorial voice (Playfair italic) — hero/emotional copy only
  display:    { fontFamily: Fonts.display, fontSize: 32, lineHeight: 38 },
  displaySm:  { fontFamily: Fonts.display, fontSize: 22, lineHeight: 28 },

  // Big data — the numbers ARE the design in a running app
  metricXL:   { fontFamily: Fonts.light, fontSize: 72, letterSpacing: -2.5, fontVariant: tabular },
  metricLg:   { fontFamily: Fonts.light, fontSize: 44, letterSpacing: -1.5, fontVariant: tabular },
  metricMd:   { fontFamily: Fonts.light, fontSize: 28, letterSpacing: -0.5, fontVariant: tabular },
  metricSm:   { fontFamily: Fonts.semiBold, fontSize: 16, letterSpacing: -0.2, fontVariant: tabular },

  // UI text
  title:      { fontFamily: Fonts.semiBold, fontSize: 20, letterSpacing: -0.4, lineHeight: 26 },
  headline:   { fontFamily: Fonts.semiBold, fontSize: 16, lineHeight: 21 },
  body:       { fontFamily: Fonts.regular,  fontSize: 15, lineHeight: 22 },
  bodySm:     { fontFamily: Fonts.regular,  fontSize: 13, lineHeight: 19 },
  label:      { fontFamily: Fonts.medium,   fontSize: 13, lineHeight: 17 },
  labelSm:    { fontFamily: Fonts.medium,   fontSize: 11, lineHeight: 14 },
  button:     { fontFamily: Fonts.semiBold, fontSize: 15, letterSpacing: 0.2 },

  // Tracked-uppercase eyebrow/section label — the ONLY place 10px is allowed
  overline:   { fontFamily: Fonts.medium, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' as const },
  caption:    { fontFamily: Fonts.regular, fontSize: 11, lineHeight: 15 },
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
