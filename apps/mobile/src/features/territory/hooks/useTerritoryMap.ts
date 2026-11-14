import { isNewCapture } from '@theme/territory';
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
  const [homeArea, setHomeArea]               = useState<[number, number] | null>(null);
  const rivalReqRef = useRef(0);
  const bboxDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [locationStatus, setLocationStatus]   = useState<'granted' | 'undetermined' | 'denied'>('undetermined');

  const centreOnDevice = useCallback(async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setDeviceLocation([loc.coords.longitude, loc.coords.latitude]);
    } catch { /* no fix yet; the map keeps its default centre */ }
  }, []);

  useEffect(() => {
    (async () => {
      const player = await getPlayer();
      if (player?.id) setCurrentUserId(player.id);
      if (player?.lastKnownLocation) setHomeArea([player.lastKnownLocation.lng, player.lastKnownLocation.lat]);
      // Never prompt on open: the screen explains why first (see
      // TerritoryMapScreen's location card) and asks only when tapped.
      const perm = await Location.getForegroundPermissionsAsync();
      setLocationStatus(perm.status === 'granted' ? 'granted' : perm.canAskAgain ? 'undetermined' : 'denied');
      if (perm.status === 'granted') await centreOnDevice();
    })();
  }, [centreOnDevice]);

  const requestLocation = useCallback(async () => {
    const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
    setLocationStatus(status === 'granted' ? 'granted' : canAskAgain ? 'undetermined' : 'denied');
    if (status === 'granted') await centreOnDevice();
  }, [centreOnDevice]);

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
      // Panning quickly can leave an older request finishing last; only the
      // newest one may replace what's drawn.
      const req = ++rivalReqRef.current;
      setIsLoadingRivals(true);
      try {
        const rivals = await fetchRivalPolygons(newBbox, currentUserId);
        if (req === rivalReqRef.current) setRivalPolygons(rivals);
      } catch { /* silent */ } finally {
        if (req === rivalReqRef.current) setIsLoadingRivals(false);
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
          isNew:      p.ownerId === currentUserId && isNewCapture(p.claimedAt),
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
      // ownPolygons is already decayed by fetchOwnPolygons (territoryService.ts) —
      // decaying again here from the same lastDefendedAt produced a lower score than
      // the dashboard's computation from raw values, showing two different numbers
      // for the same data.
      territoryScore: computeTerritoryScore(ownPolygons, true),
    };
  }, [ownPolygons, rivalPolygons]);

  // Where the map opens: where the runner is; else their newest zone (an
  // average of every zone landed between cities for anyone with zones in two);
  // else their home area. 0,0 only if there's nothing at all.
  const newestZone = useMemo((): [number, number] | null => {
    if (ownPolygons.length === 0) return null;
    const z = ownPolygons.reduce((a, b) => ((b.claimedAt ?? '') > (a.claimedAt ?? '') ? b : a));
    const ring = z.polygon;
    return [ring.reduce((s, c) => s + c[0], 0) / ring.length, ring.reduce((s, c) => s + c[1], 0) / ring.length];
  }, [ownPolygons]);
  const centre = deviceLocation ?? newestZone ?? homeArea ?? [0, 0];
  // Same array while the values hold, so a reload of the zones doesn't snap
  // the camera back while the runner is panning around.
  const defaultCenter = useMemo((): [number, number] => centre, [centre[0].toFixed(5), centre[1].toFixed(5)]); // eslint-disable-line react-hooks/exhaustive-deps

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
    locationStatus,
    requestLocation,
  };
}
