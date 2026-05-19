import type { Reward } from './types';

export const HARDCODED_REWARDS: Reward[] = [
  {
    id: 'brooks-discount-01',
    brand: 'Brooks',
    title: '20% off Brooks Running',
    description: 'Redeem for 20% off your next Brooks Running order. Valid on full-price items.',
    paceCost: 75,
    tier: 'entry',
    status: 'available',
    brandColor: '#0084D6',
    brandInitial: 'B',
    valueLabel: '20% off',
    expiresLabel: 'Limited offer',
    category: 'gear',
  },
];
