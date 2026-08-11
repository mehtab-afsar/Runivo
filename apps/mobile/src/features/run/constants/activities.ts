import {
  Pulse, Gauge, Lightning, Footprints, Mountains, TreeEvergreen, Bicycle,
  Timer, TrendUp, Shuffle, Fire, PathIcon as RouteIcon, Barbell,
  Waves, Wheelchair, Snowflake, type Icon,
} from 'phosphor-react-native';
import type { ActivityType } from '../types';

export interface ActivityMeta {
  id: ActivityType;
  label: string;
  icon: Icon;
  color: string;
  bg: string;
}

/**
 * The single source of truth for activity-type metadata (icon/label/color).
 * RunSetupSheet's summary chip and ActivityModal's picker used to each hand-write
 * their own list — 7 entries vs 18, with mismatched ids (`trail` vs `trail_run`,
 * `long_run` present in one and not the other). Picking anything the smaller list
 * didn't recognize made the summary chip silently fall back to "Run" instead of
 * showing what was actually selected. One shared list covering every ActivityType
 * value makes that mismatch impossible to reintroduce.
 */
export const ACTIVITIES: ActivityMeta[] = [
  { id: 'run',           label: 'Run',        icon: Pulse,         color: '#D93518', bg: '#FDE8E4' },
  { id: 'jog',           label: 'Jog',        icon: Gauge,         color: '#D93518', bg: '#FDE8E4' },
  { id: 'sprint',        label: 'Sprint',     icon: Lightning,     color: '#DC2626', bg: '#FEE2E2' },
  { id: 'walk',          label: 'Walk',       icon: Footprints,    color: '#059669', bg: '#D1FAE5' },
  { id: 'hike',          label: 'Hike',       icon: Mountains,     color: '#B45309', bg: '#FEF3C7' },
  { id: 'trail_run',     label: 'Trail',      icon: TreeEvergreen, color: '#15803D', bg: '#DCFCE7' },
  { id: 'trail',         label: 'Trail',      icon: TreeEvergreen, color: '#15803D', bg: '#DCFCE7' },
  { id: 'cycle',         label: 'Cycle',      icon: Bicycle,       color: '#0284C7', bg: '#E0F2FE' },
  { id: 'interval',      label: 'Intervals',  icon: Timer,         color: '#7C3AED', bg: '#EDE9FE' },
  { id: 'tempo',         label: 'Tempo',      icon: TrendUp,       color: '#EA580C', bg: '#FFEDD5' },
  { id: 'long_run',      label: 'Long Run',   icon: TrendUp,       color: '#EA580C', bg: '#FFEDD5' },
  { id: 'fartlek',       label: 'Fartlek',    icon: Shuffle,       color: '#2563EB', bg: '#DBEAFE' },
  { id: 'race',          label: 'Race',       icon: Fire,          color: '#E11D48', bg: '#FFE4E6' },
  { id: 'cross_country', label: 'XC',         icon: RouteIcon,     color: '#4338CA', bg: '#E0E7FF' },
  { id: 'stair_climb',   label: 'Stairs',     icon: TrendUp,       color: '#9333EA', bg: '#F3E8FF' },
  { id: 'hiit',          label: 'HIIT',       icon: Fire,          color: '#DC2626', bg: '#FEE2E2' },
  { id: 'strength',      label: 'Strength',   icon: Barbell,       color: '#4B5563', bg: '#F3F4F6' },
  { id: 'swim',          label: 'Swim',       icon: Waves,         color: '#0369A1', bg: '#E0F2FE' },
  { id: 'wheelchair',    label: 'Wheelchair', icon: Wheelchair,    color: '#6D28D9', bg: '#EDE9FE' },
  { id: 'ski',           label: 'Ski',        icon: Snowflake,     color: '#0EA5E9', bg: '#E0F2FE' },
];

const BY_ID: Partial<Record<ActivityType, ActivityMeta>> = Object.fromEntries(
  ACTIVITIES.map(a => [a.id, a]),
);

/** Resolve activity metadata with a safe fallback — never silently reverts to "Run". */
export function activityMetaFor(id: ActivityType): ActivityMeta {
  return BY_ID[id] ?? ACTIVITIES[0];
}

/**
 * What the picker actually offers. `trail` is kept in ACTIVITIES/BY_ID purely so a
 * run already recorded with that id (RunSetupSheet's old 7-item list used it) still
 * resolves to a real label/icon instead of falling back to "Run" — but it's the same
 * concept as `trail_run`, so it isn't offered twice as a selectable option.
 */
export const SELECTABLE_ACTIVITIES = ACTIVITIES.filter(a => a.id !== 'trail');
