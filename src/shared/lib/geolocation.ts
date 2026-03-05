/* eslint-disable @typescript-eslint/no-explicit-any */
interface WatchCallbackData {
  lat: number;
  lng: number;
  speed: number;
  accuracy: number;
  timestamp: number;
}

type WatchCallback = (data: WatchCallbackData) => void;
type ErrorCallback = (error: any) => void;

let CapGeolocation: any = null;

// Lazy-load Capacitor Geolocation only on native
try {
  if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()) {
    const mod = '@capacitor/geolocation';
    (Function('m', 'return import(m)')(mod) as Promise<any>)
      .then((m: any) => { CapGeolocation = m.Geolocation; })
      .catch(() => {});
  }
} catch {
  // Not on native platform
}

export async function requestPermission(): Promise<boolean> {
  if (CapGeolocation) {
    try {
      const status = await CapGeolocation.requestPermissions();
      return status.location === 'granted';
    } catch {
      return false;
    }
  }

  try {
    await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 5000,
      });
    });
    return true;
  } catch {
    return false;
  }
}

export async function getCurrentPosition(): Promise<WatchCallbackData | null> {
  if (CapGeolocation) {
    try {
      const pos = await CapGeolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });
      return {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        speed: pos.coords.speed ?? 0,
        accuracy: pos.coords.accuracy,
        timestamp: pos.timestamp,
      };
    } catch {
      return null;
    }
  }

  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
      });
    });
    return {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      speed: pos.coords.speed ?? 0,
      accuracy: pos.coords.accuracy,
      timestamp: pos.timestamp,
    };
  } catch {
    return null;
  }
}

export function watchPosition(
  callback: WatchCallback,
  errorCallback?: ErrorCallback
): { stop: () => void } {
  if (CapGeolocation) {
    let watchId: string | null = null;

    CapGeolocation.watchPosition(
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      (position: any, err: any) => {
        if (err) {
          errorCallback?.(err);
          return;
        }
        if (position) {
          callback({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            speed: position.coords.speed ?? 0,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          });
        }
      }
    ).then((id: string) => {
      watchId = id;
    });

    return {
      stop: () => {
        if (watchId) CapGeolocation.clearWatch({ id: watchId });
      },
    };
  }

  const id = navigator.geolocation.watchPosition(
    (position) => {
      callback({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        speed: position.coords.speed ?? 0,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      });
    },
    (error) => errorCallback?.(error),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );

  return {
    stop: () => navigator.geolocation.clearWatch(id),
  };
}
