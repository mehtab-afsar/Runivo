/**
 * healthService — writes completed runs to Apple Health (iOS) or
 * Google Health Connect (Android).
 *
 * iOS:  react-native-health   (HealthKit)
 * Android: @kingstinct/react-native-healthkit is iOS-only; for Android we use
 *          react-native-health-connect (Health Connect API, Android 14+)
 *
 * Both SDKs are optional peer dependencies. If they are not installed or the
 * device doesn't support them, all calls are silent no-ops.
 *
 * Usage (call once after a run finishes):
 *   await writeRunToHealth({ startTime, endTime, distanceMeters, calories })
 *
 * Usage (call once after auth to read past workouts):
 *   const workouts = await readRecentWorkouts(30)
 */

import { Platform } from 'react-native';

export interface HealthRun {
  startTime:      number;  // unix ms
  endTime:        number;  // unix ms
  distanceMeters: number;
  calories?:      number;
}

export interface HealthWorkout {
  startTime:      number;
  endTime:        number;
  distanceMeters: number;
  calories?:      number;
  source:         string;
}

// ── iOS — HealthKit ───────────────────────────────────────────────────────────

let _appleHealth: { isAvailable: (cb: (e: object | null, a: boolean) => void) => void; initHealthKit: (perms: object, cb: (e: object | null) => void) => void; saveWorkout: (opts: object, cb: (e: object | null, r: object) => void) => void; getWorkouts: (opts: object, cb: (e: object | null, r: unknown[]) => void) => void } | null = null;
let _appleHealthReady = false;

async function getAppleHealth() {
  if (!_appleHealth) {
    try {
      // Dynamic import so the module is optional
      const mod = await import('react-native-health' as any);
      _appleHealth = mod.default ?? mod;
    } catch {
      return null;
    }
  }
  return _appleHealth;
}

async function initAppleHealth(): Promise<boolean> {
  if (_appleHealthReady) return true;
  const AppleHealth = await getAppleHealth();
  if (!AppleHealth) return false;

  return new Promise(resolve => {
    AppleHealth.isAvailable((err, available) => {
      if (err || !available) { resolve(false); return; }

      const permissions = {
        permissions: {
          read:  ['Running', 'DistanceWalkingRunning', 'ActiveEnergyBurned'],
          write: ['Running', 'DistanceWalkingRunning', 'ActiveEnergyBurned'],
        },
      };

      AppleHealth.initHealthKit(permissions, (initErr) => {
        if (initErr) { resolve(false); return; }
        _appleHealthReady = true;
        resolve(true);
      });
    });
  });
}

async function writeRunToAppleHealth(run: HealthRun): Promise<void> {
  const ok = await initAppleHealth();
  if (!ok) return;

  const AppleHealth = await getAppleHealth();
  if (!AppleHealth) return;

  const opts = {
    type:           'Running',
    startDate:      new Date(run.startTime).toISOString(),
    endDate:        new Date(run.endTime).toISOString(),
    distance:       run.distanceMeters / 1000,  // HealthKit uses km
    distanceUnit:   'km',
    energyBurned:   run.calories ?? 0,
    energyBurnedUnit: 'calorie',
  };

  return new Promise(resolve => {
    AppleHealth.saveWorkout(opts, (err) => {
      if (err) console.warn('[health] saveWorkout error:', err);
      resolve();
    });
  });
}

async function readAppleHealthWorkouts(days: number): Promise<HealthWorkout[]> {
  const ok = await initAppleHealth();
  if (!ok) return [];

  const AppleHealth = await getAppleHealth();
  if (!AppleHealth) return [];

  const startDate = new Date(Date.now() - days * 86_400_000).toISOString();

  return new Promise(resolve => {
    AppleHealth.getWorkouts(
      { type: 'Running', startDate, endDate: new Date().toISOString() },
      (err, results) => {
        if (err || !Array.isArray(results)) { resolve([]); return; }
        resolve(
          results.map((r: any) => ({
            startTime:      new Date(r.start).getTime(),
            endTime:        new Date(r.end).getTime(),
            distanceMeters: (r.distance ?? 0) * 1000,
            calories:       r.calories,
            source:         r.sourceName ?? 'Apple Health',
          }))
        );
      }
    );
  });
}

// ── Android — Health Connect ──────────────────────────────────────────────────

async function writeRunToHealthConnect(run: HealthRun): Promise<void> {
  try {
    const {
      initialize,
      requestPermission,
      insertRecords,
    } = await import('react-native-health-connect' as any);

    const initialized = await initialize();
    if (!initialized) return;

    await requestPermission([
      { accessType: 'write', recordType: 'ExerciseSession' },
      { accessType: 'write', recordType: 'Distance' },
    ]);

    await insertRecords([
      {
        recordType: 'ExerciseSession',
        startTime:  new Date(run.startTime).toISOString(),
        endTime:    new Date(run.endTime).toISOString(),
        exerciseType: 79,  // EXERCISE_TYPE_RUNNING
        title:      'Run',
      },
      {
        recordType: 'Distance',
        startTime:  new Date(run.startTime).toISOString(),
        endTime:    new Date(run.endTime).toISOString(),
        distance: { value: run.distanceMeters, unit: 'meters' },
      },
    ]);
  } catch (err) {
    console.warn('[health] Health Connect write error:', err);
  }
}

async function readHealthConnectWorkouts(days: number): Promise<HealthWorkout[]> {
  try {
    const {
      initialize,
      requestPermission,
      readRecords,
    } = await import('react-native-health-connect' as any);

    const initialized = await initialize();
    if (!initialized) return [];

    await requestPermission([
      { accessType: 'read', recordType: 'ExerciseSession' },
    ]);

    const startTime = new Date(Date.now() - days * 86_400_000).toISOString();
    const endTime   = new Date().toISOString();

    const { records } = await readRecords('ExerciseSession', {
      timeRangeFilter: { operator: 'between', startTime, endTime },
    });

    return (records ?? [])
      .filter((r: any) => r.exerciseType === 79)
      .map((r: any) => ({
        startTime:      new Date(r.startTime).getTime(),
        endTime:        new Date(r.endTime).getTime(),
        distanceMeters: 0,  // Distance is a separate record type
        source:         r.metadata?.dataOrigin ?? 'Health Connect',
      }));
  } catch (err) {
    console.warn('[health] Health Connect read error:', err);
    return [];
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Write a completed run to the platform health store.
 * Silent no-op if the SDK is not installed or permission is denied.
 */
export async function writeRunToHealth(run: HealthRun): Promise<void> {
  if (Platform.OS === 'ios') {
    await writeRunToAppleHealth(run);
  } else if (Platform.OS === 'android') {
    await writeRunToHealthConnect(run);
  }
}

/**
 * Read recent workouts from the platform health store.
 * Returns [] if the SDK is unavailable or permission is denied.
 */
export async function readRecentWorkouts(days = 30): Promise<HealthWorkout[]> {
  if (Platform.OS === 'ios') {
    return readAppleHealthWorkouts(days);
  } else if (Platform.OS === 'android') {
    return readHealthConnectWorkouts(days);
  }
  return [];
}
