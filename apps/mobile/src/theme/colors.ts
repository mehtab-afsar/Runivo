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
  muted:   '#6B6B6B',
  greenLo: '#EDF7F2',
  redLo:   '#FEF0EE',
  purple:  '#8B5CF6',

  // Semantic aliases for component library
  accent:              '#D93518',
  accentMuted:         '#FEF0EE',
  alwaysLight:         '#FFFFFF',
  // Bold-contrast cards (e.g. dashboard mission card, profile hero card) that are
  // meant to stay near-black in both themes, with fixed-white text/overlays inside —
  // NOT `black`/`t1`, which is the "ink" token and intentionally inverts to near-white
  // in dark mode (correct for text, wrong for a card meant to stay visually bold-dark).
  alwaysDark:          '#0A0A0A',
  danger:              '#D93518',
  backgroundSecondary: '#F0EDE8',
} as const;

export const DarkColors = {
  // Backgrounds
  bg:      '#0D0D0D',
  surface: '#1A1816',
  mid:     '#252220',
  stone:   '#1E1C1A',

  // Borders & dividers
  border:  '#333030',

  // Text
  black:   '#F2EFE9',
  t1:      '#F2EFE9',
  t2:      '#9E9894',
  t3:      '#5A5550',

  // Brand / interactive
  red:     '#D93518',
  white:   '#FFFFFF',

  // Semantic
  green:   '#22A85A',
  greenBg: '#0C2318',
  amber:   '#C27F00',
  amberBg: '#231A00',
  orange:  '#D97010',
  orangeBg:'#271200',

  // Leaderboard medals
  gold:    '#D4A200',
  silver:  '#9E9E9E',
  bronze:  '#A0522D',

  // Aliases
  muted:   '#9E9894',
  greenLo: '#0C2318',
  redLo:   '#2A0C06',
  purple:  '#8B5CF6',

  // Semantic aliases for component library
  accent:              '#D93518',
  accentMuted:         '#2A0C06',
  alwaysLight:         '#FFFFFF',
  alwaysDark:          '#0A0A0A',
  danger:              '#D93518',
  backgroundSecondary: '#1A1816',
} as const;

export type AppColors = Record<keyof typeof Colors, string>;
export type ColorKey = keyof typeof Colors;
