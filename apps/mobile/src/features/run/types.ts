export type ActivityType =
  | 'run' | 'jog' | 'sprint' | 'walk' | 'hike' | 'trail_run' | 'trail'
  | 'cycle' | 'interval' | 'tempo' | 'fartlek' | 'race' | 'cross_country'
  | 'stair_climb' | 'hiit' | 'strength' | 'swim' | 'wheelchair' | 'ski' | 'long_run';
export type GoalType = 'open' | 'distance' | 'time' | 'calories';

export interface RunSettings {
  activity: ActivityType;
  goal: GoalType;
  goalValue: number;
  shoeId: string | null;
  audioFeedback: boolean;
}
