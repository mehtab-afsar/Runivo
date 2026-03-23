import type { StoredShoe } from '@shared/services/store';

export type ShoeCategory = StoredShoe['category'];
export type ShoeStatus = 'active' | 'retired';

export interface Shoe {
  id: string;
  brand: string;
  model: string;
  nickname: string | null;
  category: ShoeCategory;
  maxKm: number;
  isDefault: boolean;
  isRetired: boolean;
  color: string | null;
  photoUrl?: string;
  purchaseDate: string | null;
  notes?: string | null;
  createdAt?: number;
  synced?: boolean;
}

export const CATEGORIES: { value: ShoeCategory; label: string; emoji: string }[] = [
  { value: 'road',   label: 'Road',   emoji: '🛣️' },
  { value: 'trail',  label: 'Trail',  emoji: '🌲' },
  { value: 'track',  label: 'Track',  emoji: '🏟️' },
  { value: 'casual', label: 'Casual', emoji: '👟' },
];
