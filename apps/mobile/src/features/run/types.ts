export type ActivityType = 'run' | 'walk' | 'cycle' | 'hike' | 'trail' | 'interval' | 'long_run';
export type GoalType = 'open' | 'distance' | 'time' | 'calories';

export interface RunSettings {
  activity: ActivityType;
  goal: GoalType;
  goalValue: number;
  shoeId: string | null;
  audioFeedback: boolean;
}
