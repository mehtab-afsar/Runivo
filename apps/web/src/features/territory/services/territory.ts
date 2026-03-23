import {
  latLngToCell,
  cellToBoundary,
  cellToLatLng,
  gridDisk,
} from 'h3-js';
import { GAME_CONFIG } from '@shared/services/config';
import { supabase } from '@shared/services/supabase';

export type TerritoryStatus = 'owned' | 'enemy' | 'neutral' | 'contested' | 'claiming';

export interface Territory {
  hexId: string;
  center: [number, number];
  boundary: [number, number][];
  ownerId: string | null;
  ownerName: string | null;
  ownerClub: string | null;
  defense: number;
  claimedAt: number | null;
  lastFortifiedAt: number | null;
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

export function getDecayedDefense(defense: number, lastFortifiedAt: number): number {
  const hoursSince = (Date.now() - lastFortifiedAt) / (1000 * 60 * 60);
  const decayPerHour = GAME_CONFIG.TERRITORY_DECAY_PER_DAY / 24;
  const decayed = defense - (hoursSince * decayPerHour);
  return Math.max(0, Math.round(decayed * 10) / 10);
}

/**
 * Calls the server-side fortify_territory RPC.
 * Costs 30 energy, adds 20 defense (capped at 100), awards 10 XP.
 * Returns {success, reason}.
 */
export async function fortifyTerritory(
  h3Index: string,
  userId: string
): Promise<{ success: boolean; reason: string | null }> {
  const { data, error } = await supabase.rpc('fortify_territory', {
    p_h3_index: h3Index,
    p_user_id:  userId,
  });

  if (error) return { success: false, reason: error.message };
  return data as { success: boolean; reason: string | null };
}
