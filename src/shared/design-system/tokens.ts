/**
 * Runivo Design Tokens — SpeedSprint-inspired palette
 * Primary: Crimson #E8435A  ·  Secondary: Lavender #C4B0D8
 * "Soft Athletic" — clean, airy, sporty
 */

// ─── Colors ──────────────────────────────────────────────────────────────────

export const color = {
  // Brand — Primary (Crimson)
  primary:      '#E8435A',
  primaryLight: '#FF7088',
  primaryDark:  '#D03A4F',
  primaryDim:   'rgba(232,67,90,0.12)',
  primaryGlow:  'rgba(232,67,90,0.22)',

  // Brand — Secondary (Lavender)
  secondary:     '#C4B0D8',
  secondaryLight:'#DDD4EC',
  secondaryDim:  'rgba(196,176,216,0.18)',

  // Semantic
  enemy:       '#EF4444',
  enemyDim:    'rgba(239,68,68,0.12)',
  gold:        '#F59E0B',
  goldDim:     'rgba(245,158,11,0.12)',
  success:     '#10B981',
  successDim:  'rgba(16,185,129,0.12)',
  warning:     '#F97316',

  // Dark surfaces
  dark: {
    bg:        '#0F0D12',
    surface:   '#18151E',
    card:      '#221E2A',
    border:    'rgba(255,255,255,0.08)',
    borderMid: 'rgba(255,255,255,0.12)',
    divider:   'rgba(255,255,255,0.06)',
  },

  // Light surfaces
  light: {
    bg:        '#FAF9FC',
    surface:   '#FFFFFF',
    card:      '#FFFFFF',
    border:    'rgba(0,0,0,0.06)',
    borderMid: 'rgba(0,0,0,0.10)',
    divider:   'rgba(0,0,0,0.05)',
  },

  // Text — dark mode
  textDark: {
    primary:   '#FFFFFF',
    secondary: 'rgba(255,255,255,0.65)',
    muted:     'rgba(255,255,255,0.35)',
    disabled:  'rgba(255,255,255,0.20)',
  },

  // Text — light mode
  textLight: {
    primary:   '#1A1A1A',
    secondary: '#6B6B6B',
    muted:     '#A0A0A0',
    disabled:  '#C9C3D2',
  },

  // Neutral surfaces (doc spec)
  surface: '#F7F6F4',
} as const;

// ─── Spacing ─────────────────────────────────────────────────────────────────

export const space = {
  1:  4,
  2:  8,
  3:  12,
  4:  16,
  5:  20,
  6:  24,
  8:  32,
  10: 40,
  12: 48,
  16: 64,
} as const;

// ─── Border Radius ───────────────────────────────────────────────────────────

export const radius = {
  sm:   4,
  md:   8,
  lg:   12,
  xl:   16,
  pill: 999,
  card: 16,
} as const;

// ─── Typography ──────────────────────────────────────────────────────────────

export const type = {
  sans:  "'DM Sans', system-ui, sans-serif",
  serif: "'Cormorant Garamond', Georgia, serif",

  size: {
    label:   10,
    caption: 12,
    body:    14,
    bodyLg:  16,
    subhead: 18,
    title:   22,
    h2:      28,
    h1:      36,
  },

  weight: {
    regular:  400,
    medium:   500,
    semibold: 600,
    bold:     700,
    black:    900,
  },

  tracking: {
    tight:  '-0.02em',
    normal: '0em',
    wide:   '0.05em',
    wider:  '0.12em',
    widest: '0.25em',
  },
} as const;

// ─── Shadows ─────────────────────────────────────────────────────────────────

export const shadow = {
  primary:   '0 4px 24px rgba(232,67,90,0.22)',
  primarySm: '0 2px 12px rgba(232,67,90,0.16)',
  lavender:  '0 4px 20px rgba(196,176,216,0.20)',
  card:      '0 4px 24px rgba(0,0,0,0.10)',
  cardSm:    '0 2px 10px rgba(0,0,0,0.07)',
  enemy:     '0 0 20px rgba(239,68,68,0.25)',
} as const;

// ─── Animation ───────────────────────────────────────────────────────────────

export const motion = {
  duration: {
    fast:   150,
    normal: 250,
    slow:   400,
  },
  ease: {
    out:    [0.22, 1, 0.36, 1] as const,
    in:     [0.55, 0, 1, 0.45] as const,
    spring: { type: 'spring', damping: 20, stiffness: 300 } as const,
  },
} as const;

// ─── Territory Colors ─────────────────────────────────────────────────────────

export const territory = {
  owned:     '#E8435A',
  ownedFill: 'rgba(232,67,90,0.28)',
  enemy:     '#EF4444',
  enemyFill: 'rgba(239,68,68,0.25)',
  neutral:   '#9C93A8',
  contested: '#F59E0B',
} as const;

// ─── Tier Colors ──────────────────────────────────────────────────────────────

export const tier = {
  common:    { label: 'Common',    color: '#9C93A8', bg: 'rgba(156,147,168,0.12)', mult: '1.0×' },
  uncommon:  { label: 'Uncommon',  color: '#10B981', bg: 'rgba(16,185,129,0.12)',  mult: '1.5×' },
  rare:      { label: 'Rare',      color: '#C4B0D8', bg: 'rgba(196,176,216,0.15)', mult: '2.0×' },
  epic:      { label: 'Epic',      color: '#E8435A', bg: 'rgba(232,67,90,0.12)',   mult: '3.0×' },
  legendary: { label: 'Legendary', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', mult: '5.0×' },
} as const;

// ─── Leaderboard Rank Colors ──────────────────────────────────────────────────

export const rank = {
  gold:   { bg: 'rgba(245,158,11,0.12)',  border: '#F59E0B', text: '#F59E0B' },
  silver: { bg: 'rgba(196,176,216,0.15)', border: '#C4B0D8', text: '#C4B0D8' },
  bronze: { bg: 'rgba(232,67,90,0.10)',   border: '#E8435A', text: '#E8435A' },
} as const;
