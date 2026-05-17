import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { getPlayer } from '@shared/services/store';
import { computeTerritoryScore } from '@shared/services/claimEngine';
import { GAME_CONFIG } from '@shared/services/config';
import {
  fetchOwnPolygons,
  fetchRivalPolygons,
  subscribeToOwnPolygons,
  type BBox,
} from '../services/territoryService';
import type { TerritoryPolygon } from '@shared/types/game';
import type { TerritoryFilter, TerritoryDetails } from '../types';
import type { FeatureCollection } from 'geojson';

export function useTerritoryMap(initialFilter?: TerritoryFilter) {
  const [ownPolygons, setOwnPolygons]         = useState<TerritoryPolygon[]>([]);
  const [rivalPolygons, setRivalPolygons]     = useState<TerritoryPolygon[]>([]);
  const [activeFilter, setActiveFilter]       = useState<TerritoryFilter>(initialFilter ?? 'all');
  const [selectedPolygon, setSelectedPolygon] = useState<TerritoryDetails | null>(null);
  const [isLoadingRivals, setIsLoadingRivals] = useState(false);
  const [deviceLocation, setDeviceLocation]   = useState<[number, number] | null>(null);
  const [currentUserId, setCurrentUserId]     = useState('');
  const bboxDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const player = await getPlayer();
      if (player?.id) setCurrentUserId(player.id);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setDeviceLocation([loc.coords.longitude, loc.coords.latitude]);
      }
    })();
  }, []);

  const loadOwnPolygons = useCallback(async () => {
    if (!currentUserId) return;
    const polys = await fetchOwnPolygons(currentUserId);
    setOwnPolygons(polys);
  }, [currentUserId]);

  useFocusEffect(useCallback(() => {
    loadOwnPolygons();
    if (!currentUserId) return;
    const unsub = subscribeToOwnPolygons(currentUserId, loadOwnPolygons);
    return unsub;
  }, [currentUserId, loadOwnPolygons]));

  const handleBboxChange = useCallback((newBbox: BBox) => {
    if (bboxDebounceRef.current) clearTimeout(bboxDebounceRef.current);
    bboxDebounceRef.current = setTimeout(async () => {
      if (!currentUserId) return;
      setIsLoadingRivals(true);
      try {
        const rivals = await fetchRivalPolygons(newBbox, currentUserId);
        setRivalPolygons(rivals);
      } catch { /* silent */ } finally {
        setIsLoadingRivals(false);
      }
    }, 400);
  }, [currentUserId]);

  const visiblePolygons = useMemo(() => {
    switch (activeFilter) {
      case 'mine':   return ownPolygons;
      case 'rivals': return rivalPolygons;
      case 'stale':  return ownPolygons.filter(p => p.freshness < GAME_CONFIG.FRESHNESS_STALE_AT);
      default:       return [...ownPolygons, ...rivalPolygons];
    }
  }, [activeFilter, ownPolygons, rivalPolygons]);

  const geoJSON = useMemo((): FeatureCollection => ({
    type: 'FeatureCollection',
    features: visiblePolygons
      .filter(p => p.polygon.length >= 3)
      .map(p => ({
        type: 'Feature',
        id: p.id,
        geometry: { type: 'Polygon', coordinates: [p.polygon] },
        properties: {
          id:         p.id,
          ownerId:    p.ownerId,
          ownerName:  p.ownerName,
          isOwn:      p.ownerId === currentUserId,
          freshness:  p.freshness,
          tier:       p.tier,
          areaM2:     p.areaM2,
          isLoopFill: p.isLoopFill,
          claimedAt:  p.claimedAt,
        },
      })),
  }), [visiblePolygons, currentUserId]);

  const stats = useMemo(() => {
    const totalArea = ownPolygons.reduce((s, p) => s + p.areaM2, 0);
    return {
      ownCount:       ownPolygons.length,
      totalAreaM2:    totalArea,
      avgFreshness:   totalArea > 0
        ? Math.round(ownPolygons.reduce((s, p) => s + p.freshness * p.areaM2, 0) / totalArea)
        : 100,
      staleCount:     ownPolygons.filter(p => p.freshness < GAME_CONFIG.FRESHNESS_STALE_AT).length,
      rivalCount:     rivalPolygons.length,
      territoryScore: computeTerritoryScore(ownPolygons),
    };
  }, [ownPolygons, rivalPolygons]);

  const defaultCenter = useMemo((): [number, number] => {
    if (ownPolygons.length > 0) {
      const lng = ownPolygons.reduce((s, p) => s + p.polygon[0][0], 0) / ownPolygons.length;
      const lat = ownPolygons.reduce((s, p) => s + p.polygon[0][1], 0) / ownPolygons.length;
      return [lng, lat];
    }
    return deviceLocation ?? [0, 0];
  }, [ownPolygons, deviceLocation]);

  return {
    ownPolygons,
    rivalPolygons,
    visiblePolygons,
    geoJSON,
    activeFilter,
    setActiveFilter,
    selectedPolygon,
    setSelectedPolygon,
    stats,
    isLoadingRivals,
    deviceLocation,
    defaultCenter,
    handleBboxChange,
    currentUserId,
    loadOwnPolygons,
  };
}
