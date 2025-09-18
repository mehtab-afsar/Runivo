import { useState, useEffect, useCallback } from 'react';
import type { Location } from '@/types';

interface GeolocationState {
  location: Location | null;
  accuracy: number | null;
  isLoading: boolean;
  error: string | null;
  isSupported: boolean;
}

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  watch?: boolean;
}

export const useGeolocation = (options: UseGeolocationOptions = {}) => {
  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 60000,
    watch = false,
  } = options;

  const [state, setState] = useState<GeolocationState>({
    location: null,
    accuracy: null,
    isLoading: false,
    error: null,
    isSupported: 'geolocation' in navigator,
  });

  const [watchId, setWatchId] = useState<number | null>(null);

  const updateLocation = useCallback((position: GeolocationPosition) => {
    setState(prev => ({
      ...prev,
      location: {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      },
      accuracy: position.coords.accuracy,
      isLoading: false,
      error: null,
    }));
  }, []);

  const handleError = useCallback((error: GeolocationPositionError) => {
    let errorMessage = 'An unknown error occurred';

    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Location access denied by user';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Location information is unavailable';
        break;
      case error.TIMEOUT:
        errorMessage = 'Location request timed out';
        break;
    }

    setState(prev => ({
      ...prev,
      isLoading: false,
      error: errorMessage,
    }));
  }, []);

  const requestLocation = useCallback(() => {
    if (!state.isSupported) {
      setState(prev => ({
        ...prev,
        error: 'Geolocation is not supported by this browser',
      }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      updateLocation,
      handleError,
      {
        enableHighAccuracy,
        timeout,
        maximumAge,
      }
    );
  }, [state.isSupported, enableHighAccuracy, timeout, maximumAge, updateLocation, handleError]);

  const startWatching = useCallback(() => {
    if (!state.isSupported || watchId !== null) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    const id = navigator.geolocation.watchPosition(
      updateLocation,
      handleError,
      {
        enableHighAccuracy,
        timeout,
        maximumAge,
      }
    );

    setWatchId(id);
  }, [state.isSupported, watchId, enableHighAccuracy, timeout, maximumAge, updateLocation, handleError]);

  const stopWatching = useCallback(() => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [watchId]);

  useEffect(() => {
    if (watch) {
      startWatching();
    } else {
      stopWatching();
    }

    return () => {
      stopWatching();
    };
  }, [watch, startWatching, stopWatching]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) return false;

    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' });

      if (permission.state === 'granted') {
        return true;
      } else if (permission.state === 'prompt') {
        requestLocation();
        return true;
      }

      return false;
    } catch {
      requestLocation();
      return true;
    }
  }, [state.isSupported, requestLocation]);

  return {
    ...state,
    requestLocation,
    requestPermission,
    startWatching,
    stopWatching,
  };
};