/**
 * appleHealthService.native.ts — Expo / React Native implementation.
 * Uses @kingstinct/react-native-healthkit (Expo SDK 55 compatible).
 * Metro selects this file on iOS; appleHealthService.ts is the web fallback.
 *
 * Required iOS setup:
 *   1. Add to app.json plugins: ["@kingstinct/react-native-healthkit"]
 *   2. Run: npx expo prebuild && (cd ios && pod install)
 */

import { matchOrCreateRun } from './store';
import { supabase } from './supabase';
import { Platform } from 'react-native';
import type { WorkoutActivityType } from '@kingstinct/react-native-healthkit';

// ── Capability check ──────────────────────────────────────────────────────────
export function isAppleHealthAvailable(): boolean {
  return Platform.OS === 'ios';
}

// ── Lazy import wrapper ───────────────────────────────────────────────────────
type HKModule = typeof import('@kingstinct/react-native-healthkit');
let _hk: HKModule | null = null;

async function getHK(): Promise<HKModule | null> {
  if (!isAppleHealthAvailable()) return null;
  if (_hk) return _hk;
  try {
    _hk = await import('@kingstinct/react-native-healthkit');
    return _hk;
  } catch {
    return null;
  }
}

// ── Permissions ───────────────────────────────────────────────────────────────
const READ_TYPES = [
  'HKWorkoutTypeIdentifier',
  'HKQuantityTypeIdentifierDistanceWalkingRunning',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierHeartRate',
] as const;

export async function requestAppleHealthPermissions(): Promise<boolean> {
  const hk = await getHK();
  if (!hk) return false;
  try {
    await hk.requestAuthorization({
      toRead: READ_TYPES as unknown as Parameters<typeof hk.requestAuthorization>[0]['toRead'],
    });
    return true;
  } catch {
    return false;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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

// ── Sync ─────────────────────────────────────────────────────────────────────
export async function syncAppleHealth(days = 30): Promise<AppleHealthSyncResult> {
  const hk = await getHK();
  if (!hk) return { matched: 0, created: 0, skipped: 0 };

  const endDate   = new Date();
  const startDate = new Date(endDate.getTime() - days * 86_400_000);

  let workouts: Awaited<ReturnType<typeof hk.queryWorkoutSamples>> = [];
  try {
    workouts = await hk.queryWorkoutSamples({
      limit: 200,
      filter: {
        date: { startDate, endDate },
        workoutActivityType: 37 as unknown as WorkoutActivityType, // running
      },
    });
  } catch {
    return { matched: 0, created: 0, skipped: 0 };
  }

  let matched = 0, created = 0, skipped = 0;

  for (const w of workouts) {
    const startMs = new Date(w.startDate).getTime();
    const endMs   = new Date(w.endDate).getTime();
    // totalDistance is in km for HealthKit distance workouts
    const distM   = w.totalDistance ? w.totalDistance.quantity * 1000 : 0;
    const kcal    = w.totalEnergyBurned?.quantity;
    const durationSec = (endMs - startMs) / 1000;

    try {
      const { action } = await matchOrCreateRun({
        startTime:      startMs,
        endTime:        endMs,
        distanceMeters: distM,
        durationSec,
        avgPace:        paceFromDistanceAndDuration(distM, durationSec),
        source:         'apple_health',
        externalId:     w.uuid,
        caloriesBurned: kcal,
      });
      if (action === 'matched') matched++; else created++;
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
        metadata:    { matched, created, workouts: workouts.length },
      }, { onConflict: 'user_id,device_type' });
    }
  } catch { /* non-critical */ }

  return { matched, created, skipped };
}

// ── Connect / Disconnect ──────────────────────────────────────────────────────
export async function connectAppleHealth(): Promise<{ ok: boolean; error?: string }> {
  const granted = await requestAppleHealthPermissions();
  if (!granted) return { ok: false, error: 'Permission denied or not available on this device.' };

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

  await syncAppleHealth(90);
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
