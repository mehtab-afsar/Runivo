import { useState, useEffect, useCallback, useRef } from 'react';
import type { Location, LiveRunData, Territory } from '@/types';
import { useGeolocation } from './useGeolocation';

interface RunTrackerState {
  runData: LiveRunData | null;
  isRunning: boolean;
  isPaused: boolean;
  startTime: Date | null;
  route: Location[];
  territoriesClaimed: string[];
}

export const useRunTracker = () => {
  const [state, setState] = useState<RunTrackerState>({
    runData: null,
    isRunning: false,
    isPaused: false,
    startTime: null,
    route: [],
    territoriesClaimed: [],
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastLocationRef = useRef<Location | null>(null);
  const totalDistanceRef = useRef(0);

  const { location, startWatching, stopWatching, requestPermission } = useGeolocation({
    watch: true,
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 5000,
  });

  // Calculate distance between two points using Haversine formula
  const calculateDistance = useCallback((point1: Location, point2: Location): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (point1.lat * Math.PI) / 180;
    const φ2 = (point2.lat * Math.PI) / 180;
    const Δφ = ((point2.lat - point1.lat) * Math.PI) / 180;
    const Δλ = ((point2.lng - point1.lng) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }, []);

  // Check if current location is within a territory
  const checkTerritoryIntersection = useCallback((currentLocation: Location, territories: Territory[]): string[] => {
    const claimedTerritories: string[] = [];

    territories.forEach(territory => {
      // Simple point-in-polygon check for rectangular territories
      const { polygon } = territory;
      if (polygon.length >= 4) {
        const minLat = Math.min(...polygon.map(p => p.lat));
        const maxLat = Math.max(...polygon.map(p => p.lat));
        const minLng = Math.min(...polygon.map(p => p.lng));
        const maxLng = Math.max(...polygon.map(p => p.lng));

        if (
          currentLocation.lat >= minLat &&
          currentLocation.lat <= maxLat &&
          currentLocation.lng >= minLng &&
          currentLocation.lng <= maxLng
        ) {
          claimedTerritories.push(territory.id);
        }
      }
    });

    return claimedTerritories;
  }, []);

  // Update run data
  const updateRunData = useCallback(() => {
    if (!state.isRunning || state.isPaused || !state.startTime || !location) {
      return;
    }

    const currentTime = new Date();
    const duration = Math.floor((currentTime.getTime() - state.startTime.getTime()) / 1000);

    // Update distance if location changed significantly
    if (lastLocationRef.current) {
      const distanceIncrement = calculateDistance(lastLocationRef.current, location);
      if (distanceIncrement > 2) { // Only update if moved more than 2 meters
        totalDistanceRef.current += distanceIncrement;
        setState(prev => ({
          ...prev,
          route: [...prev.route, location],
        }));
      }
    }

    const distanceKm = totalDistanceRef.current / 1000;
    const pace = duration > 0 && distanceKm > 0 ? (duration / 60) / distanceKm : 0;

    setState(prev => ({
      ...prev,
      runData: {
        distance: distanceKm,
        duration,
        pace,
        territoriesClaimed: prev.territoriesClaimed.length,
        currentLocation: location,
        isActive: true,
        isPaused: false,
      },
    }));

    lastLocationRef.current = location;
  }, [state.isRunning, state.isPaused, state.startTime, location, calculateDistance]);

  // Start run
  const startRun = useCallback(async () => {
    const hasPermission = await requestPermission();
    if (!hasPermission) {
      throw new Error('Location permission required to start run');
    }

    const startTime = new Date();
    totalDistanceRef.current = 0;
    lastLocationRef.current = null;

    setState(prev => ({
      ...prev,
      isRunning: true,
      isPaused: false,
      startTime,
      route: location ? [location] : [],
      territoriesClaimed: [],
      runData: {
        distance: 0,
        duration: 0,
        pace: 0,
        territoriesClaimed: 0,
        currentLocation: location || { lat: 0, lng: 0 },
        isActive: true,
        isPaused: false,
      },
    }));

    startWatching();

    // Start interval to update run data every second
    intervalRef.current = setInterval(updateRunData, 1000);
  }, [requestPermission, location, startWatching, updateRunData]);

  // Pause run
  const pauseRun = useCallback(() => {
    setState(prev => ({
      ...prev,
      isPaused: true,
      runData: prev.runData ? { ...prev.runData, isPaused: true } : null,
    }));

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Resume run
  const resumeRun = useCallback(() => {
    setState(prev => ({
      ...prev,
      isPaused: false,
      runData: prev.runData ? { ...prev.runData, isPaused: false } : null,
    }));

    intervalRef.current = setInterval(updateRunData, 1000);
  }, [updateRunData]);

  // Stop run
  const stopRun = useCallback(() => {
    setState(prev => ({
      ...prev,
      isRunning: false,
      isPaused: false,
      runData: prev.runData ? { ...prev.runData, isActive: false } : null,
    }));

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    stopWatching();
  }, [stopWatching]);

  // Claim territory
  const claimTerritory = useCallback((territories: Territory[]) => {
    if (!location || !state.isRunning) return;

    const newTerritories = checkTerritoryIntersection(location, territories);
    const unclaimedTerritories = newTerritories.filter(
      territoryId => !state.territoriesClaimed.includes(territoryId)
    );

    if (unclaimedTerritories.length > 0) {
      setState(prev => ({
        ...prev,
        territoriesClaimed: [...prev.territoriesClaimed, ...unclaimedTerritories],
      }));
    }
  }, [location, state.isRunning, state.territoriesClaimed, checkTerritoryIntersection]);

  // Update run data when location changes
  useEffect(() => {
    if (state.isRunning && !state.isPaused && location) {
      updateRunData();
    }
  }, [location, state.isRunning, state.isPaused, updateRunData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      stopWatching();
    };
  }, [stopWatching]);

  return {
    ...state,
    startRun,
    pauseRun,
    resumeRun,
    stopRun,
    claimTerritory,
    currentLocation: location,
  };
};