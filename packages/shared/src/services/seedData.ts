// Hex-based territory seeding removed. Territories are now polygon corridors
// created from actual run GPS paths (see useGameEngine.ts endRunSession).
export async function seedTerritoryData(_centerLat: number, _centerLng: number): Promise<void> {
  // no-op
}
