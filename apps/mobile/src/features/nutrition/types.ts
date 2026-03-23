export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export const MEALS: { value: Meal; label: string; emoji: string }[] = [
  { value: 'breakfast', label: 'Breakfast', emoji: '🌅' },
  { value: 'lunch',     label: 'Lunch',     emoji: '☀️' },
  { value: 'dinner',    label: 'Dinner',    emoji: '🌙' },
  { value: 'snacks',    label: 'Snacks',    emoji: '🍎' },
];
