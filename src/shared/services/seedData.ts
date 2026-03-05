import { latLngToCell, gridDisk } from 'h3-js';
import { GAME_CONFIG } from './config';
import { saveTerritories, getAllTerritories, StoredTerritory } from './store';

const MOCK_ENEMIES = [
  { id: 'enemy-1', name: 'SpeedDemon_42' },
  { id: 'enemy-2', name: 'TerritoryKing' },
  { id: 'enemy-3', name: 'NightRunner_X' },
  { id: 'enemy-4', name: 'MilesAhead' },
];

export async function seedTerritoryData(centerLat: number, centerLng: number): Promise<void> {
  const existing = await getAllTerritories();
  if (existing.length > 0) return;

  const centerHex = latLngToCell(centerLat, centerLng, GAME_CONFIG.HEX_RESOLUTION);
  const allHexes = gridDisk(centerHex, 7);

  const territories: StoredTerritory[] = [];

  for (const hexId of allHexes) {
    const rand = Math.random();

    if (rand < 0.3) {
      const enemy = MOCK_ENEMIES[Math.floor(Math.random() * MOCK_ENEMIES.length)];
      territories.push({
        hexId,
        ownerId: enemy.id,
        ownerName: enemy.name,
        defense: Math.floor(20 + Math.random() * 60),
        tier: randomTier(),
        claimedAt: Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000),
        lastFortifiedAt: Date.now() - Math.floor(Math.random() * 48 * 60 * 60 * 1000),
      });
    } else if (rand < 0.35) {
      territories.push({
        hexId,
        ownerId: null,
        ownerName: null,
        defense: 0,
        tier: randomTier(),
        claimedAt: null,
        lastFortifiedAt: null,
      });
    }
  }

  await saveTerritories(territories);
  console.log(`Seeded ${territories.length} territories around [${centerLat}, ${centerLng}]`);
}

function randomTier(): StoredTerritory['tier'] {
  const r = Math.random();
  if (r < 0.5) return 'common';
  if (r < 0.75) return 'uncommon';
  if (r < 0.9) return 'rare';
  if (r < 0.97) return 'epic';
  return 'legendary';
}
