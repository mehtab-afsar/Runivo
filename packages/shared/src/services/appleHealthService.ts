/**
 * Apple Health bridge via Capacitor HealthKit plugin.
 *
 * At runtime this module checks whether `window.CapacitorHealthKit` is
 * available (injected by the native layer). When running as a PWA in a
 * browser the capability is absent and every function returns a safe
 * no-op result so the rest of the app never needs to branch.
 *
 * Required native setup (iOS only):
 *   npm install capacitor-healthkit
 *   npx cap sync ios
 *   Add NSHealthShareUsageDescription to Info.plist
 */

import { matchOrCreateRun } from './store';
import { supabase } from './supabase';

// ── Capability detection ───────────────────────────────────────────────────────

// The Capacitor plugin injects itself under this key.
type HealthKitPlugin = {
  requestAuthorization(opts: { all: string[]; read: string[]; write: string[] }): Promise<void>;
  queryWorkouts(opts: { startDate: string; endDate: string }): Promise<{ workouts: HealthKitWorkout[] }>;
};

interface HealthKitWorkout {
  uuid: string;
  workoutActivityType: number; // 37 = running, 13 = cycling, etc.
  startDate: string;           // ISO 8601
  endDate: string;             // ISO 8601
  duration: number;            // seconds
  totalDistance?: { value: number; unit: string };
  totalEnergyBurned?: { value: number; unit: string };
  metadata?: Record<string, unknown>;
}

function getPlugin(): HealthKitPlugin | null {
  return (window as unknown as Record<string, unknown>).CapacitorHealthKit as HealthKitPlugin ?? null;
}

export function isAppleHealthAvailable(): boolean {
  return getPlugin() !== null;
}

// ── Permissions ───────────────────────────────────────────────────────────────

const READ_TYPES = [
  'HKWorkoutTypeIdentifier',
  'HKQuantityTypeIdentifierDistanceWalkingRunning',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierHeartRate',
];

export async function requestAppleHealthPermissions(): Promise<boolean> {
  const plugin = getPlugin();
  if (!plugin) return false;
  try {
    await plugin.requestAuthorization({ all: [], read: READ_TYPES, write: [] });
    return true;
  } catch {
    return false;
  }
}

// ── Workout pull ───────────────────────────────────────────────────────────────

const RUNNING_ACTIVITY_TYPE = 37; // HKWorkoutActivityTypeRunning

function paceFromDistanceAndDuration(meters: number, seconds: number): string {
  if (meters <= 0 || seconds <= 0) return '--:--';
  const secPerKm = seconds / (meters / 1000);
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${String(sec).padStart(2, '0')}`;
}

export interface AppleHealthSyncResult {
  matched: number;
  created: number;
  skipped: number;
}

/**
 * Pulls running workouts from Apple Health for the past `days` days,
 * deduplicates against existing local runs, and upserts any new ones.
 * Also records the sync in Supabase `device_connections`.
 */
export async function syncAppleHealth(days = 30): Promise<AppleHealthSyncResult> {
  const plugin = getPlugin();
  if (!plugin) return { matched: 0, created: 0, skipped: 0 };

  const endDate   = new Date();
  const startDate = new Date(endDate.getTime() - days * 86400000);

  let workouts: HealthKitWorkout[] = [];
  try {
    const result = await plugin.queryWorkouts({
      startDate: startDate.toISOString(),
      endDate:   endDate.toISOString(),
    });
    workouts = result.workouts;
  } catch {
    return { matched: 0, created: 0, skipped: 0 };
  }

  const runningWorkouts = workouts.filter(w => w.workoutActivityType === RUNNING_ACTIVITY_TYPE);

  let matched = 0, created = 0, skipped = 0;

  for (const w of runningWorkouts) {
    const startMs = new Date(w.startDate).getTime();
    const endMs   = new Date(w.endDate).getTime();
    const distM   = w.totalDistance
      ? (w.totalDistance.unit === 'km' ? w.totalDistance.value * 1000 : w.totalDistance.value)
      : 0;
    const kcal = w.totalEnergyBurned?.value ?? undefined;

    try {
      const { action } = await matchOrCreateRun({
        startTime:      startMs,
        endTime:        endMs,
        distanceMeters: distM,
        durationSec:    w.duration,
        avgPace:        paceFromDistanceAndDuration(distM, w.duration),
        source:         'apple_health',
        externalId:     w.uuid,
        caloriesBurned: kcal,
      });
      if (action === 'matched') matched++;
      else created++;
    } catch {
      skipped++;
    }
  }

  // Record sync timestamp in Supabase
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('device_connections').upsert({
        user_id:     user.id,
        device_type: 'apple_health',
        status:      'connected',
        last_sync_at: new Date().toISOString(),
        metadata:    { matched, created, workouts: runningWorkouts.length },
      }, { onConflict: 'user_id,device_type' });
    }
  } catch { /* non-critical */ }

  return { matched, created, skipped };
}

// ── Connect / Disconnect ───────────────────────────────────────────────────────

export async function connectAppleHealth(): Promise<{ ok: boolean; error?: string }> {
  const granted = await requestAppleHealthPermissions();
  if (!granted) {
    return { ok: false, error: 'Permission denied or not available on this device.' };
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('device_connections').upsert({
        user_id:     user.id,
        device_type: 'apple_health',
        status:      'connected',
        metadata:    {},
      }, { onConflict: 'user_id,device_type' });
    }
  } catch { /* non-critical */ }

  await syncAppleHealth(90); // initial backfill: 90 days
  return { ok: true };
}

export async function disconnectAppleHealth(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('device_connections').upsert({
        user_id:     user.id,
        device_type: 'apple_health',
        status:      'disconnected',
        last_sync_at: null,
      }, { onConflict: 'user_id,device_type' });
    }
  } catch { /* non-critical */ }
}

export async function getAppleHealthConnection(): Promise<{
  status: 'connected' | 'disconnected' | 'unavailable';
  lastSyncAt: string | null;
  lastSyncStats?: { matched: number; created: number; workouts: number };
}> {
  if (!isAppleHealthAvailable()) return { status: 'unavailable', lastSyncAt: null };

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { status: 'disconnected', lastSyncAt: null };

    const { data } = await supabase
      .from('device_connections')
      .select('status, last_sync_at, metadata')
      .eq('user_id', user.id)
      .eq('device_type', 'apple_health')
      .single();

    if (!data) return { status: 'disconnected', lastSyncAt: null };

    return {
      status:        data.status as 'connected' | 'disconnected',
      lastSyncAt:    data.last_sync_at ?? null,
      lastSyncStats: data.metadata as { matched: number; created: number; workouts: number } | undefined,
    };
  } catch {
    return { status: 'disconnected', lastSyncAt: null };
  }
}
