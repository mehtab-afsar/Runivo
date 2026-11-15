export const Colors = {
  // Backgrounds
  bg:      '#F4F5F1',
  surface: '#ECEEE8',
  mid:     '#E3E6DF',
  stone:   '#EEF0EA',

  // Borders & dividers
  border:  '#E2E4DE',

  // Text
  black:   '#17181A',
  t1:      '#17181A',
  // t2/t3 are TEXT colours: both pass WCAG AA (4.5:1) on bg and card.
  // Use `border`/`mid` for decoration, not t3.
  t2:      '#5F635D',
  t3:      '#666A64',

  // Brand / interactive
  red:     '#4E7F1F',
  white:   '#FFFFFF',

  // Elevated card surface — white on the warm paper in light mode, a warm raised
  // tone above `bg` in dark mode. Use this (NOT `white`) for any card/row/input
  // surface that holds ink text, so it inverts correctly. `white` stays #FFFFFF in
  // both themes and is only for chips/text/icons that must remain white on dark.
  card:    '#FFFFFF',

  // Semantic
  green:   '#4E7F1F',
  greenBg: '#EEF5E4',
  amber:   '#A85E06',
  amberBg: '#FDF0DF',
  orange:  '#C2700A',
  orangeBg:'#FDF0DF',

  // Leaderboard medals — also doubles as the Plus/premium accent (crown fill,
  // upsell pill) so paid status reads as "gold", distinct from the amber
  // warning tone used for stale-zone alerts.
  gold:    '#B88A0C',
  goldBg:  '#FBF3DC',
  silver:  '#9E9E9E',
  bronze:  '#A0522D',

  // Aliases for legacy screen names
  muted:   '#5F635D',
  greenLo: '#EEF5E4',
  redLo:   '#EEF5E4',
  purple:  '#7C72D8',

  // Cool accent — data-viz (protein macro, device links, "nearby route" highlights).
  // Was ~6 different off-palette blues; unified here.
  blue:    '#3C3577',
  blueBg:  '#E4E1F8',

  // Purple-tinted info panels (e.g. paired-device details, gear recommendations) —
  // pairs with the fixed `purple` accent.
  purpleBg: '#E4E1F8',

  // 2026 redesign tokens: ink buttons, mint selection, green = your zones,
  // amber = rivals and highlights, lime = live, lavender = PaceX.
  ink:      '#17181A',
  mint:     '#EEF5E4',
  mint2:    '#DCEBC8',
  brandGreen: '#7DBA3C',
  lime:     '#C9F06B',
  rivalAmber: '#F2A43A',
  lavender: '#E4E1F8',
  lavenderInk: '#3C3577',

  // Semantic aliases for component library
  accent:              '#4E7F1F',
  accentMuted:         '#EEF5E4',
  alwaysLight:         '#FFFFFF',
  // Bold-contrast cards (e.g. dashboard mission card, profile hero card) that are
  // meant to stay near-black in both themes, with fixed-white text/overlays inside —
  // NOT `black`/`t1`, which is the "ink" token and intentionally inverts to near-white
  // in dark mode (correct for text, wrong for a card meant to stay visually bold-dark).
  alwaysDark:          '#17181A',
  danger:              '#C9372C',
  backgroundSecondary: '#ECEEE8',
  // Fixed-tone, same rationale as alwaysDark/alwaysLight — used only on permanently-
  // dark surfaces (mission cards), so they don't invert with the theme.
  glow:                '#C9F06B',
  retryAmber:          '#EF9F27',
} as const;

export const DarkColors = {
  // Backgrounds
  bg:      '#101112',
  surface: '#1B1D1E',
  mid:     '#24272A',
  stone:   '#1E2022',

  // Borders & dividers
  border:  '#2B2E30',

  // Text
  black:   '#F1F2EE',
  t1:      '#F1F2EE',
  t2:      '#A0A49D',
  t3:      '#868A83',

  // Brand / interactive — the light-mode vermilion (#D93518) reads muddy on near-black;
  // dark mode gets a hotter variant so the accent keeps its energy and passes contrast.
  red:     '#9BD25A',
  white:   '#FFFFFF',

  // Elevated card surface — warm raised tone above the #0D0D0D bg (see light-mode note).
  card:    '#191B1C',

  // Semantic
  green:   '#9BD25A',
  greenBg: '#1C2814',
  amber:   '#F2A43A',
  amberBg: '#2A1E0C',
  orange:  '#F2A43A',
  orangeBg:'#2A1E0C',

  // Leaderboard medals — also doubles as the Plus/premium accent, see light-mode note
  gold:    '#D4A200',
  goldBg:  '#2A2107',
  silver:  '#9E9E9E',
  bronze:  '#A0522D',

  // Aliases
  muted:   '#A0A49D',
  greenLo: '#1C2814',
  redLo:   '#1C2814',
  purple:  '#A79FF0',

  // Cool accent (brighter on dark so it keeps contrast)
  blue:    '#C9C2F6',
  blueBg:  '#221F38',

  purpleBg: '#221F38',

  // 2026 redesign tokens: ink buttons, mint selection, green = your zones,
  // amber = rivals and highlights, lime = live, lavender = PaceX.
  ink:      '#F1F2EE',
  mint:     '#1C2814',
  mint2:    '#2A3C1C',
  brandGreen: '#7DBA3C',
  lime:     '#C9F06B',
  rivalAmber: '#F2A43A',
  lavender: '#221F38',
  lavenderInk: '#C9C2F6',

  // Semantic aliases for component library
  accent:              '#9BD25A',
  accentMuted:         '#1C2814',
  alwaysLight:         '#FFFFFF',
  alwaysDark:          '#17181A',
  danger:              '#FF6B5E',
  backgroundSecondary: '#1B1D1E',
  // Fixed-tone — same value as light mode, see Colors.glow/retryAmber.
  glow:                '#C9F06B',
  retryAmber:          '#EF9F27',
} as const;

export type AppColors = Record<keyof typeof Colors, string>;
export type ColorKey = keyof typeof Colors;
