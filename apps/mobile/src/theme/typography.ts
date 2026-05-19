/**
 * Runivo mobile typography tokens — font family constants.
 * All Barlow weights + PlayfairDisplay for display headings.
 */

export const Fonts = {
  light:     'Barlow_300Light',
  regular:   'Barlow_400Regular',
  medium:    'Barlow_500Medium',
  semiBold:  'Barlow_600SemiBold',
  bold:      'Barlow_700Bold',
  display:   'PlayfairDisplay_400Regular_Italic',
} as const;

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
