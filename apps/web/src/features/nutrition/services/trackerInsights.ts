export interface DailyContext {
  ranToday: boolean;
  ranYesterday: boolean;
  upcomingEvent: boolean;
  lateNight: boolean;
  caloriesBurnedToday: number;
  consumed: number;
  goal: number;
  remaining: number;
  proteinConsumed: number;
  proteinGoal: number;
  carbsConsumed: number;
  carbsGoal: number;
  fatConsumed: number;
  fatGoal: number;
}

export function getHeaderMessage(_ctx: DailyContext): string {
  if (_ctx.ranToday) return 'Great run today! Refuel well.';
  if (_ctx.upcomingEvent) return 'Race day soon — eat smart.';
  return 'Hit your macros today.';
}

export function getProteinNote(_ctx: DailyContext): string {
  if (_ctx.ranToday) return 'Prioritise protein for muscle repair.';
  return 'Aim for 1.6–2g per kg bodyweight.';
}

export function getCarbsNote(_ctx: DailyContext): string {
  if (_ctx.upcomingEvent) return 'Carb-load: 6–10g per kg today.';
  if (_ctx.ranToday) return 'Replenish glycogen with quality carbs.';
  return 'Fuel activity with complex carbs.';
}

export function getFatNote(_ctx: DailyContext): string {
  return 'Healthy fats support hormone balance.';
}
