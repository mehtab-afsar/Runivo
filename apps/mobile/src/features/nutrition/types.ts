export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export const MEALS: { value: Meal; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch',     label: 'Lunch' },
  { value: 'dinner',    label: 'Dinner' },
  { value: 'snacks',    label: 'Snacks' },
];
