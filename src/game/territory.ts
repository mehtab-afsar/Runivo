import {
  latLngToCell,
  cellToBoundary,
  cellToLatLng,
  gridDisk,
} from 'h3-js';
import { GAME_CONFIG } from './config';

export type TerritoryStatus = 'owned' | 'enemy' | 'neutral' | 'contested' | 'claiming';

export interface Territory {
  hexId: string;
  center: [number, number];
  boundary: [number, number][];
  ownerId: string | null;
  ownerName: string | null;
  ownerClub: string | null;
  defense: number;
  tier: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  claimedAt: number | null;
  lastFortifiedAt: number | null;
  dailyIncome: number;
}

export function getHexAtPosition(lat: number, lng: number): string {
  return latLngToCell(lat, lng, GAME_CONFIG.HEX_RESOLUTION);
}

export function getHexBoundary(hexId: string): [number, number][] {
  return cellToBoundary(hexId) as [number, number][];
}

export function getHexCenter(hexId: string): [number, number] {
  return cellToLatLng(hexId) as [number, number];
}

export function getAdjacentHexes(hexId: string, rings: number = 1): string[] {
  return gridDisk(hexId, rings).filter(h => h !== hexId);
}

export function getHexesInBounds(
  south: number,
  west: number,
  north: number,
  east: number,
  resolution: number = GAME_CONFIG.HEX_RESOLUTION
): string[] {
  const hexes = new Set<string>();
  const latStep = (north - south) / 30;
  const lngStep = (east - west) / 30;

  for (let lat = south; lat <= north; lat += latStep) {
    for (let lng = west; lng <= east; lng += lngStep) {
      const hex = latLngToCell(lat, lng, resolution);
      hexes.add(hex);
      gridDisk(hex, 1).forEach(h => hexes.add(h));
    }
  }

  return Array.from(hexes);
}

export function hexToGeoJSON(hexId: string): [number, number][] {
  const boundary = cellToBoundary(hexId);
  const coords = boundary.map(([lat, lng]) => [lng, lat] as [number, number]);
  coords.push(coords[0]);
  return coords;
}

const TIER_MULTIPLIERS: Record<Territory['tier'], number> = {
  common: 1,
  uncommon: 1.5,
  rare: 2,
  epic: 3,
  legendary: 5,
};

export function calculateDailyIncome(territory: Territory, adjacentOwnedCount: number): number {
  const tierMult = TIER_MULTIPLIERS[territory.tier];
  const contiguousBonus = 1 + Math.min(adjacentOwnedCount * 0.1, 1.0);
  return Math.floor(GAME_CONFIG.BASE_INCOME_PER_HEX_DAY * tierMult * contiguousBonus);
}

export function getDecayedDefense(defense: number, lastFortifiedAt: number): number {
  const hoursSince = (Date.now() - lastFortifiedAt) / (1000 * 60 * 60);
  const decayed = defense - (hoursSince * GAME_CONFIG.DEFENSE_DECAY_PER_HOUR);
  return Math.max(0, Math.round(decayed * 10) / 10);
}
