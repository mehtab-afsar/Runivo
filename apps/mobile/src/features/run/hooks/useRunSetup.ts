import { useState, useEffect, useRef, useCallback } from 'react';
import { Animated, PanResponder } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';

import { getAllTerritories, getPlayer, getSavedRoutes } from '@shared/services/store';
import type { StoredSavedRoute } from '@shared/services/store';
import { findRoutesNearby } from '@shared/services/sync';
import type { RootStackParamList } from '@navigation/AppNavigator';
import type { ActivityType } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export interface GpsState {
  status: 'searching' | 'ready' | 'error';
  accuracy: number | null;
  lat: number | null;
  lng: number | null;
}

export interface IntelStats { enemy: number; neutral: number; weak: number }

const SHEET_COLLAPSED = 240;
const SHEET_EXPANDED  = 420;

export function useRunSetup() {
  const navigation = useNavigation<Nav>();

  const [activityType, setActivityType] = useState<ActivityType>('run');
  const [gps, setGps] = useState<GpsState>({ status: 'searching', accuracy: null, lat: null, lng: null });
  const [intel, setIntel] = useState<IntelStats>({ enemy: 0, neutral: 0, weak: 0 });
  const [savedRoutes, setSavedRoutes]   = useState<StoredSavedRoute[]>([]);
  const [nearbyRoutes, setNearbyRoutes] = useState<any[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<{ name: string; gpsPoints: { lat: number; lng: number }[] } | null>(null);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showRouteModal, setShowRouteModal]       = useState(false);

  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const sheetAnim      = useRef(new Animated.Value(SHEET_COLLAPSED)).current;
  const isExpandedRef  = useRef(false);

  // GPS watch
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setGps(g => ({ ...g, status: 'error' })); return; }
      locationSubRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 5 },
        loc => setGps({ status: 'ready', accuracy: loc.coords.accuracy ?? null, lat: loc.coords.latitude, lng: loc.coords.longitude }),
      );
    })();
    return () => { locationSubRef.current?.remove(); };
  }, []);

  // Territory intel
  useEffect(() => {
    (async () => {
      const [p, territories] = await Promise.all([getPlayer(), getAllTerritories()]);
      if (!p) return;
      setIntel({
        enemy:   territories.filter(t => t.ownerId && t.ownerId !== p.id).length,
        neutral: territories.filter(t => !t.ownerId).length,
        weak:    territories.filter(t => t.ownerId && t.ownerId !== p.id && t.defense < 40).length,
      });
    })();
  }, []);

  // Pan responder for draggable sheet
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
      onPanResponderMove: (_, g) => {
        const cur = isExpandedRef.current ? SHEET_EXPANDED : SHEET_COLLAPSED;
        sheetAnim.setValue(Math.max(SHEET_COLLAPSED, Math.min(SHEET_EXPANDED, cur - g.dy)));
      },
      onPanResponderRelease: (_, g) => {
        const cur = (sheetAnim as unknown as { _value: number })._value;
        const mid = (SHEET_COLLAPSED + SHEET_EXPANDED) / 2;
        const target = (g.vy < -0.5 || cur > mid) ? SHEET_EXPANDED : SHEET_COLLAPSED;
        isExpandedRef.current = target === SHEET_EXPANDED;
        Animated.spring(sheetAnim, { toValue: target, useNativeDriver: false, damping: 20, stiffness: 200 }).start();
      },
    })
  ).current;

  const openRouteModal = useCallback(async () => {
    setShowRouteModal(true);
    setSavedRoutes(await getSavedRoutes());
  }, []);

  const findNearby = useCallback(async () => {
    if (!gps.lat || !gps.lng) return;
    setNearbyLoading(true);
    try { setNearbyRoutes(await findRoutesNearby(gps.lng, gps.lat, 5000)); }
    catch { /* offline */ }
    finally { setNearbyLoading(false); }
  }, [gps.lat, gps.lng]);

  const startRun = useCallback(() => {
    if (gps.status !== 'ready') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('ActiveRun');
  }, [gps.status, navigation]);

  return {
    activityType, setActivityType,
    gps, intel,
    savedRoutes, nearbyRoutes, nearbyLoading,
    selectedRoute, setSelectedRoute,
    showActivityModal, setShowActivityModal,
    showRouteModal,
    sheetAnim, panResponder,
    openRouteModal, findNearby, startRun,
    setShowRouteModal,
  };
}
