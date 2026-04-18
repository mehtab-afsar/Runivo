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
} as const;

export type AppColors = Record<keyof typeof Colors, string>;
export type ColorKey = keyof typeof Colors;
