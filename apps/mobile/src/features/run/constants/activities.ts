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
  { id: 'trail_run',     label: 'Trail run',  icon: TreeEvergreen, color: '#15803D', bg: '#DCFCE7' },
  { id: 'trail',         label: 'Trail',      icon: TreeEvergreen, color: '#15803D', bg: '#DCFCE7' },
  { id: 'cycle',         label: 'Ride',       icon: Bicycle,       color: '#0284C7', bg: '#E0F2FE' },
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
 * The sports the record screen offers, Strava-style. On-foot sports play the
 * territory game (claim zones, earn PACE, move the streak); a ride is recorded
 * with speed instead of pace and plays no part in the game — the same rule as
 * ENGINE.TERRITORY_ACTIVITIES on the server.
 */
export interface Sport {
  id: ActivityType;
  label: string;
  icon: Icon;
  /** "Start run" / "Run done." */
  verb: string;
  /** "Distance · Running" */
  gerund: string;
  /** Claims zones and earns PACE. */
  claims: boolean;
  /** Live metric: pace (min/km) on foot, speed (km/h) on a bike. */
  metric: 'pace' | 'speed';
}

export const SPORTS: Sport[] = [
  { id: 'run',       label: 'Run',       icon: Pulse,         verb: 'run',  gerund: 'Running', claims: true,  metric: 'pace' },
  { id: 'trail_run', label: 'Trail run', icon: TreeEvergreen, verb: 'run',  gerund: 'Running', claims: true,  metric: 'pace' },
  { id: 'walk',      label: 'Walk',      icon: Footprints,    verb: 'walk', gerund: 'Walking', claims: true,  metric: 'pace' },
  { id: 'hike',      label: 'Hike',      icon: Mountains,     verb: 'hike', gerund: 'Hiking',  claims: true,  metric: 'pace' },
  { id: 'cycle',     label: 'Ride',      icon: Bicycle,       verb: 'ride', gerund: 'Riding',  claims: false, metric: 'speed' },
];

/**
 * R5: behind "More". Wheelchair and stroller runs claim like a run (same
 * GPS rules, same zones); they're labelled so stats and kudos read right.
 */
export const MORE_SPORTS: Sport[] = [
  { id: 'wheelchair', label: 'Wheelchair', icon: Wheelchair, verb: 'push', gerund: 'Pushing', claims: true, metric: 'pace' },
  { id: 'stroller',   label: 'Stroller run', icon: Pulse,    verb: 'run',  gerund: 'Running', claims: true, metric: 'pace' },
];

export function sportFor(id: string | null | undefined): Sport {
  return SPORTS.find(s => s.id === id) ?? MORE_SPORTS.find(s => s.id === id) ?? (id === 'trail' ? SPORTS[1] : SPORTS[0]);
}

/** @deprecated the old 18-item picker; kept so older imports compile. */
export const SELECTABLE_ACTIVITIES = ACTIVITIES.filter(a => SPORTS.some(s => s.id === a.id));
