import { useState, useEffect, useCallback, useMemo } from 'react';
import * as Location from 'expo-location';
import { getPlayer } from '@shared/services/store';
import type { StoredTerritory } from '@shared/services/store';
import {
  fetchMyTerritories,
  subscribeToTerritoryChanges,
  fortifyTerritory,
} from '../services/territoryService';
import type { TerritoryFilter, TerritoryDetails } from '../types';

export function useTerritoryMap() {
  const [territories, setTerritories]           = useState<StoredTerritory[]>([]);
  const [playerId, setPlayerId]                  = useState<string>('');
  const [filter, setFilter]                      = useState<TerritoryFilter>('all');
  const [selectedTerritory, setSelectedTerritory] = useState<TerritoryDetails | null>(null);
  const [userLocation, setUserLocation]          = useState<[number, number] | null>(null);
  const [loading, setLoading]                    = useState(true);

  useEffect(() => {
    (async () => {
      const player = await getPlayer();
      if (player) {
        setPlayerId(player.id);
        const { territories: all } = await fetchMyTerritories();
        setTerritories(all);
      }
      setLoading(false);
    })();

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation([loc.coords.longitude, loc.coords.latitude]);
    })();

    const unsubscribe = subscribeToTerritoryChanges(setTerritories);
    return unsubscribe;
  }, []);

  const { filteredGeoJSON, ownedCount, enemyCount, freeCount } = useMemo(() => {
    const owned   = territories.filter(t => t.ownerId === playerId);
    const enemy   = territories.filter(t => t.ownerId && t.ownerId !== playerId);
    const free    = territories.filter(t => !t.ownerId);

    const filtered = territories.filter(t => {
      if (filter === 'mine')  return t.ownerId === playerId;
      if (filter === 'enemy') return t.ownerId && t.ownerId !== playerId;
      if (filter === 'weak')  return t.ownerId && t.ownerId !== playerId && t.defense < 40;
      return true;
    });

    const geoJSON = {
      type: 'FeatureCollection' as const,
      features: filtered.map(t => {
        const isOwned  = t.ownerId === playerId;
        const isEnemy  = !!(t.ownerId && t.ownerId !== playerId);
        const fillColor = isOwned ? '#D93518' : isEnemy ? '#DC2626' : '#9CA3AF';
        return {
          type: 'Feature' as const,
          id: t.id,
          properties: { id: t.id, ownerId: t.ownerId ?? '', defense: t.defense, tier: t.tier ?? 'standard', fillColor, isOwned, isEnemy },
          geometry: { type: 'Polygon' as const, coordinates: [t.polygon ?? []] },
        };
      }),
    };

    return { filteredGeoJSON: geoJSON, ownedCount: owned.length, enemyCount: enemy.length, freeCount: free.length };
  }, [territories, playerId, filter]);

  const selectTerritory = useCallback((detail: TerritoryDetails) => {
    setSelectedTerritory(detail);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedTerritory(null);
  }, []);

  const fortify = useCallback(async (h3Index: string) => {
    if (!playerId) return;
    await fortifyTerritory(h3Index, playerId);
  }, [playerId]);

  return {
    territories,
    filter,
    selectedTerritory,
    userLocation,
    loading,
    filteredGeoJSON,
    ownedCount,
    enemyCount,
    freeCount,
    setFilter,
    selectTerritory,
    clearSelection,
    fortify,
  };
}
