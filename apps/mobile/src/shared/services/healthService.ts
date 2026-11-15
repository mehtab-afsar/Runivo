/**
 * healthService — writes completed runs to Apple Health (iOS) or
 * Google Health Connect (Android).
 *
 * iOS:     @kingstinct/react-native-healthkit (HealthKit) — a real, installed
 *          hard dependency (see app.config.ts's plugin entry + Info.plist
 *          strings). Its non-iOS build is a safe no-op module, so it's fine
 *          to import statically rather than dynamically.
 * Android: react-native-health-connect (Health Connect API, Android 14+) —
 *          an optional peer dependency, dynamically imported below; a
 *          silent no-op if not installed or the device doesn't support it.
 *
 * Usage (call once after a run finishes):
 *   await writeRunToHealth({ startTime, endTime, distanceMeters, calories })
 *
 * Usage (call once after auth to read past workouts):
 *   const workouts = await readRecentWorkouts(30)
 */

import { Platform } from 'react-native';
import * as HealthKit from '@kingstinct/react-native-healthkit';
import { WorkoutActivityType, WorkoutTypeIdentifier } from '@kingstinct/react-native-healthkit';
import type { ObjectTypeIdentifier, SampleTypeIdentifierWriteable } from '@kingstinct/react-native-healthkit';

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
// Was previously wired against `react-native-health`, a package that was never
// actually installed — every call silently no-op'd behind a try/catch on the
// dynamic import, despite the permission prompt and Connected Devices UI both
// implying this worked. `@kingstinct/react-native-healthkit` is the real,
// installed, already-configured (app.config.ts plugin + Info.plist strings)
// package; this now actually calls it.

// Only what the app uses (App Store 5.1.3 / 5.1.1(iii): don't request data types
// you don't need). Reads: queryWorkoutSamples is the only query. Writes: a run
// is saved as one workout sample that carries its own distance and energy
// totals, so the separate quantity types were never needed.
const HEALTH_READ: ObjectTypeIdentifier[] = [WorkoutTypeIdentifier];
const HEALTH_SHARE: SampleTypeIdentifierWriteable[] = [WorkoutTypeIdentifier];

let _appleHealthReady = false;

async function initAppleHealth(): Promise<boolean> {
  if (_appleHealthReady) return true;
  try {
    if (!HealthKit.isHealthDataAvailable()) return false;
    const granted = await HealthKit.requestAuthorization({
      // HealthKit never reveals per-type read grants once the sheet is
      // dismissed (same opacity the old callback-based API had) — a `true`
      // here means the permission sheet completed, not that every type
      // was individually granted.
      toRead:  HEALTH_READ,
      toShare: HEALTH_SHARE,
    });
    _appleHealthReady = granted;
    return granted;
  } catch {
    return false;
  }
}

async function writeRunToAppleHealth(run: HealthRun): Promise<void> {
  const ok = await initAppleHealth();
  if (!ok) return;

  try {
    // saveWorkoutSample's `totals` are always meters/kilocalories natively
    // (confirmed against the package's iOS Swift source) — no unit field to
    // set, unlike react-native-health's distanceUnit option. The old dead
    // code divided by 1000 assuming km; that conversion no longer applies.
    await HealthKit.saveWorkoutSample(
      WorkoutActivityType.running,
      [],
      new Date(run.startTime),
      new Date(run.endTime),
      // Energy only when it was really estimated from the runner's own weight; a 0 or a
      // default-weight guess in someone's Health data is worse than nothing.
      { distance: run.distanceMeters, ...(run.calories != null && { energyBurned: run.calories }) },
    );
  } catch (err) {
    console.warn('[health] saveWorkoutSample error:', err);
  }
}

async function readAppleHealthWorkouts(days: number): Promise<HealthWorkout[]> {
  const ok = await initAppleHealth();
  if (!ok) return [];

  try {
    const workouts = await HealthKit.queryWorkoutSamples({
      filter: {
        workoutActivityType: WorkoutActivityType.running,
        date: { startDate: new Date(Date.now() - days * 86_400_000), endDate: new Date() },
      },
      limit: 50,
      ascending: false,
    });
    return workouts.map(w => ({
      startTime:      w.startDate.getTime(),
      endTime:        w.endDate.getTime(),
      // Already meters/kcal — same units saveWorkoutSample writes, no conversion.
      distanceMeters: w.totalDistance?.quantity ?? 0,
      calories:       w.totalEnergyBurned?.quantity,
      source:         w.sourceRevision?.source?.name ?? 'Apple Health',
    }));
  } catch (err) {
    console.warn('[health] queryWorkoutSamples error:', err);
    return [];
  }
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
