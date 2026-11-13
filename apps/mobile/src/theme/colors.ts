export const Colors = {
  // Backgrounds
  bg:      '#F4F3F0',
  surface: '#ECEBE7',
  mid:     '#E4E2DD',
  stone:   '#EFEEEA',

  // Borders & dividers
  border:  '#E7E5E0',

  // Text
  black:   '#0C0C0D',
  t1:      '#0C0C0D',
  t2:      '#64636A',
  t3:      '#A3A1A8',

  // Brand / interactive
  red:     '#FF4518',
  white:   '#FFFFFF',

  // Elevated card surface — white on the warm paper in light mode, a warm raised
  // tone above `bg` in dark mode. Use this (NOT `white`) for any card/row/input
  // surface that holds ink text, so it inverts correctly. `white` stays #FFFFFF in
  // both themes and is only for chips/text/icons that must remain white on dark.
  card:    '#FFFFFF',

  // Semantic
  green:   '#12A150',
  greenBg: '#E3F5EA',
  amber:   '#9E6800',
  amberBg: '#FDF6E8',
  orange:  '#C25A00',
  orangeBg:'#FEF0E6',

  // Leaderboard medals — also doubles as the Plus/premium accent (crown fill,
  // upsell pill) so paid status reads as "gold", distinct from the amber
  // warning tone used for stale-zone alerts.
  gold:    '#D4A200',
  goldBg:  '#FBF3DC',
  silver:  '#9E9E9E',
  bronze:  '#A0522D',

  // Aliases for legacy screen names
  muted:   '#64636A',
  greenLo: '#E3F5EA',
  redLo:   '#FFE4DA',
  purple:  '#8B5CF6',

  // Cool accent — data-viz (protein macro, device links, "nearby route" highlights).
  // Was ~6 different off-palette blues; unified here.
  blue:    '#2F56F5',
  blueBg:  '#E5EAFF',

  // Purple-tinted info panels (e.g. paired-device details, gear recommendations) —
  // pairs with the fixed `purple` accent.
  purpleBg: '#F3EEFF',

  // Semantic aliases for component library
  accent:              '#FF4518',
  accentMuted:         '#FFE4DA',
  alwaysLight:         '#FFFFFF',
  // Bold-contrast cards (e.g. dashboard mission card, profile hero card) that are
  // meant to stay near-black in both themes, with fixed-white text/overlays inside —
  // NOT `black`/`t1`, which is the "ink" token and intentionally inverts to near-white
  // in dark mode (correct for text, wrong for a card meant to stay visually bold-dark).
  alwaysDark:          '#0C0C0D',
  danger:              '#E5341A',
  backgroundSecondary: '#ECEBE7',
  // Fixed-tone, same rationale as alwaysDark/alwaysLight — used only on permanently-
  // dark surfaces (mission cards), so they don't invert with the theme.
  glow:                '#6DE8A8',
  retryAmber:          '#EF9F27',
} as const;

export const DarkColors = {
  // Backgrounds
  bg:      '#0C0C0D',
  surface: '#1C1C20',
  mid:     '#252220',
  stone:   '#1E1C1A',

  // Borders & dividers
  border:  '#2A2A2F',

  // Text
  black:   '#F2EFE9',
  t1:      '#F2EFE9',
  t2:      '#9C9AA2',
  t3:      '#5E5C63',

  // Brand / interactive — the light-mode vermilion (#D93518) reads muddy on near-black;
  // dark mode gets a hotter variant so the accent keeps its energy and passes contrast.
  red:     '#FF5A2E',
  white:   '#FFFFFF',

  // Elevated card surface — warm raised tone above the #0D0D0D bg (see light-mode note).
  card:    '#17171A',

  // Semantic
  green:   '#2BC26B',
  greenBg: '#0C2318',
  amber:   '#C27F00',
  amberBg: '#231A00',
  orange:  '#D97010',
  orangeBg:'#271200',

  // Leaderboard medals — also doubles as the Plus/premium accent, see light-mode note
  gold:    '#D4A200',
  goldBg:  '#2A2107',
  silver:  '#9E9E9E',
  bronze:  '#A0522D',

  // Aliases
  muted:   '#9E9894',
  greenLo: '#0C2318',
  redLo:   '#2A0C06',
  purple:  '#8B5CF6',

  // Cool accent (brighter on dark so it keeps contrast)
  blue:    '#5B7CFF',
  blueBg:  '#0E1A2E',

  purpleBg: '#1D1730',

  // Semantic aliases for component library
  accent:              '#FF5A2E',
  accentMuted:         '#2A0C06',
  alwaysLight:         '#FFFFFF',
  alwaysDark:          '#0C0C0D',
  danger:              '#FF5A2E',
  backgroundSecondary: '#1A1816',
  // Fixed-tone — same value as light mode, see Colors.glow/retryAmber.
  glow:                '#6DE8A8',
  retryAmber:          '#EF9F27',
} as const;

export type AppColors = Record<keyof typeof Colors, string>;
export type ColorKey = keyof typeof Colors;
