import { useState, useEffect, useRef, useCallback } from 'react';
import { getCachedPlan, localToday } from '@features/training/services/planService';
import { sessionOn } from '@shared/engine/training';
import { Animated, PanResponder, AppState } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import * as Haptics from '@theme/hapticsGated';

import { getSavedRoutes } from '@shared/services/store';
import type { StoredSavedRoute } from '@shared/services/store';
import { findRoutesNearby, type NearbyRoute } from '@shared/services/sync';
import type { RootStackParamList } from '@navigation/AppNavigator';
import type { ActivityType } from '../types';
import { getLastSport, setLastSport } from '../constants/lastSport';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export interface GpsState {
  status: 'searching' | 'ready' | 'error';
  /** Why there's no GPS: permission refused, or location switched off on the phone. */
  problem?: 'denied' | 'off';
  accuracy: number | null;
  lat: number | null;
  lng: number | null;
}


// v1: the sheet holds the sport chips, the rule line and Start.
const SHEET_COLLAPSED = 392; // follow card, rule chips, prefs (R6), sport · START · route (mock)
const SHEET_EXPANDED  = 392;

export function useRunSetup() {
  const navigation = useNavigation<Nav>();

  const [activityType, setActivityTypeState] = useState<ActivityType>('run');
  useEffect(() => { getLastSport().then(setActivityTypeState); }, []);
  const setActivityType = useCallback((t: ActivityType) => { setActivityTypeState(t); setLastSport(t); }, []);
  const [gps, setGps] = useState<GpsState>({ status: 'searching', accuracy: null, lat: null, lng: null });
  const [savedRoutes, setSavedRoutes]   = useState<StoredSavedRoute[]>([]);
  const [nearbyRoutes, setNearbyRoutes] = useState<NearbyRoute[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  // What the run follows (R1): a route (saved or nearby), or today's planned session.
  const [selectedRoute, setSelectedRoute] = useState<{ name: string; gpsPoints?: { lat: number; lng: number }[]; sessionId?: string } | null>(null);
  const [todaySession, setTodaySession] = useState<{ id: string; title: string; summary: string } | null>(null);
  useEffect(() => {
    getCachedPlan().then(ap => {
      const s = ap ? sessionOn(ap.plan, localToday()) : null;
      setTodaySession(s && s.status === 'planned' ? { id: s.id, title: s.title, summary: s.summary } : null);
    }).catch(() => {});
  }, []);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showRouteModal, setShowRouteModal]       = useState(false);

  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const sheetAnim      = useRef(new Animated.Value(SHEET_COLLAPSED)).current;
  const isExpandedRef  = useRef(false);

  // Coming back from Settings (where the runner turned location on) retries.
  const [gpsAttempt, setGpsAttempt] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => {
      if (st === 'active') setGps(g => { if (g.status === 'error') setGpsAttempt(a => a + 1); return g; });
    });
    return () => sub.remove();
  }, []);

  // GPS watch
  useEffect(() => {
    // The cleanup below runs synchronously at unmount, but the subscription is only
    // assigned to the ref after the permission-request await resolves — if the
    // screen unmounts during that window, cleanup fires first (ref still null) and
    // the subscription that arrives afterward is never removed, leaking the GPS
    // watcher (battery drain) until app restart. `cancelled` catches that race.
    let cancelled = false;
    (async () => {
      setGps(g => (g.status === 'error' ? { ...g, status: 'searching', problem: undefined } : g));
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== 'granted') { setGps(g => ({ ...g, status: 'error', problem: 'denied' })); return; }
      // With location switched off on the phone, watchPositionAsync throws (or
      // never reports) and the sheet used to sit on "Waiting for GPS" forever.
      if (!(await Location.hasServicesEnabledAsync().catch(() => true))) {
        if (!cancelled) setGps(g => ({ ...g, status: 'error', problem: 'off' }));
        return;
      }
      try {
        const sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 5 },
          loc => setGps({ status: 'ready', accuracy: loc.coords.accuracy ?? null, lat: loc.coords.latitude, lng: loc.coords.longitude }),
        );
        if (cancelled) { sub.remove(); return; }
        locationSubRef.current = sub;
      } catch {
        if (!cancelled) setGps(g => ({ ...g, status: 'error', problem: 'off' }));
      }
    })();
    return () => { cancelled = true; locationSubRef.current?.remove(); locationSubRef.current = null; };
  }, [gpsAttempt]);

  // Pan responder for draggable sheet
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8,
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

  const startRun = useCallback((mapStyle?: string, pacer?: { enabled: boolean; pace: string }) => {
    if (gps.status !== 'ready') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('ActiveRun', {
      // The setup screen's Start is the start: no second tap on the live screen.
      autoStart: true,
      activityType: activityType,
      ...(mapStyle ? { mapStyle } : {}),
      ...(selectedRoute?.gpsPoints ? { ghostRoutePoints: selectedRoute.gpsPoints } : {}),
      ...(selectedRoute?.sessionId ? { sessionId: selectedRoute.sessionId } : {}),
      // Hands off the setup screen's already-resolved pacer state so the live
      // run's separate useBeatPacer() instance can start on its first render
      // instead of waiting on an async settings read — see useBeatPacer.ts.
      ...(pacer ? { pacerEnabled: pacer.enabled, pacerPace: pacer.pace } : {}),
    });
  }, [gps.status, navigation, selectedRoute, activityType]);

  return {
    activityType, setActivityType,
    gps,
    savedRoutes, nearbyRoutes, nearbyLoading,
    selectedRoute, setSelectedRoute, todaySession,
    showActivityModal, setShowActivityModal,
    showRouteModal,
    sheetAnim, panResponder,
    openRouteModal, findNearby, startRun,
    setShowRouteModal,
  };
}
