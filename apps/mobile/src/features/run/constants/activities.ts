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
 * Colours follow the 2026 palette: green for running, amber on foot,
 * lavender for rides and water, ink for gym work.
 */
export const ACTIVITIES: ActivityMeta[] = [
  { id: 'run',           label: 'Run',        icon: Pulse,         color: '#4E7F1F', bg: '#EEF5E4' },
  { id: 'jog',           label: 'Jog',        icon: Gauge,         color: '#4E7F1F', bg: '#EEF5E4' },
  { id: 'sprint',        label: 'Sprint',     icon: Lightning,     color: '#4E7F1F', bg: '#EEF5E4' },
  { id: 'walk',          label: 'Walk',       icon: Footprints,    color: '#A85E06', bg: '#FDF0DF' },
  { id: 'hike',          label: 'Hike',       icon: Mountains,     color: '#A85E06', bg: '#FDF0DF' },
  { id: 'trail_run',     label: 'Trail run',  icon: TreeEvergreen, color: '#4E7F1F', bg: '#EEF5E4' },
  { id: 'trail',         label: 'Trail',      icon: TreeEvergreen, color: '#4E7F1F', bg: '#EEF5E4' },
  { id: 'cycle',         label: 'Ride',       icon: Bicycle,       color: '#3C3577', bg: '#E4E1F8' },
  { id: 'interval',      label: 'Intervals',  icon: Timer,         color: '#4E7F1F', bg: '#EEF5E4' },
  { id: 'tempo',         label: 'Tempo',      icon: TrendUp,       color: '#4E7F1F', bg: '#EEF5E4' },
  { id: 'long_run',      label: 'Long Run',   icon: TrendUp,       color: '#4E7F1F', bg: '#EEF5E4' },
  { id: 'fartlek',       label: 'Fartlek',    icon: Shuffle,       color: '#4E7F1F', bg: '#EEF5E4' },
  { id: 'race',          label: 'Race',       icon: Fire,          color: '#4E7F1F', bg: '#EEF5E4' },
  { id: 'cross_country', label: 'XC',         icon: RouteIcon,     color: '#4E7F1F', bg: '#EEF5E4' },
  { id: 'stair_climb',   label: 'Stairs',     icon: TrendUp,       color: '#A85E06', bg: '#FDF0DF' },
  { id: 'hiit',          label: 'HIIT',       icon: Fire,          color: '#17181A', bg: '#EEF0EA' },
  { id: 'strength',      label: 'Strength',   icon: Barbell,       color: '#17181A', bg: '#EEF0EA' },
  { id: 'swim',          label: 'Swim',       icon: Waves,         color: '#3C3577', bg: '#E4E1F8' },
  { id: 'wheelchair',    label: 'Wheelchair', icon: Wheelchair,    color: '#3C3577', bg: '#E4E1F8' },
  { id: 'ski',           label: 'Ski',        icon: Snowflake,     color: '#3C3577', bg: '#E4E1F8' },
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
