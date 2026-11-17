import { supabase } from './supabase';

export interface LiveFriendPosition {
  userId: string;
  runId: string;
  lat: number;
  lng: number;
  updatedAt: number;
  /** Progress the runner shares with their live position (may be missing on old apps). */
  startedAt?: number;
  distanceM?: number;
  elapsedSec?: number;
}

/** Upserts the caller's current position — one row per user, overwritten every call. */
export async function upsertLivePosition(
  userId: string,
  runId: string,
  lat: number,
  lng: number,
  progress?: { startedAt: number; distanceM: number; elapsedSec: number },
): Promise<void> {
  await supabase
    .from('live_run_positions')
    .upsert(
      {
        user_id: userId, run_id: runId, lat, lng, updated_at: new Date().toISOString(),
        ...(progress ? {
          started_at: new Date(progress.startedAt).toISOString(),
          distance_m: Math.round(progress.distanceM),
          elapsed_sec: Math.round(progress.elapsedSec),
        } : {}),
      },
      { onConflict: 'user_id' },
    );
}

/** Removes the caller's row — call on pause/stop/unmount so friends see you vanish immediately
 *  instead of waiting for the 30s staleness window in the RLS policy to lapse. */
export async function clearLivePosition(userId: string): Promise<void> {
  await supabase.from('live_run_positions').delete().eq('user_id', userId);
}

function toLiveFriendPosition(row: Record<string, unknown>): LiveFriendPosition {
  return {
    userId: row.user_id as string,
    runId: row.run_id as string,
    lat: row.lat as number,
    lng: row.lng as number,
    updatedAt: new Date(row.updated_at as string).getTime(),
    startedAt: row.started_at ? new Date(row.started_at as string).getTime() : undefined,
    distanceM: typeof row.distance_m === 'number' ? row.distance_m : undefined,
    elapsedSec: typeof row.elapsed_sec === 'number' ? row.elapsed_sec : undefined,
  };
}

/** Whoever is currently visible to the caller right now — RLS (mutual connection +
 *  sharing enabled + fresh) already did the filtering, this just reads what's left. */
export async function fetchLiveFriendPositions(): Promise<LiveFriendPosition[]> {
  const { data, error } = await supabase.from('live_run_positions').select('*');
  if (error || !data) return [];
  return data.map(toLiveFriendPosition);
}

/**
 * Subscribes to live position changes. postgres_changes evaluates RLS using the
 * subscribing client's own session — the same guarantee territory_polygons'
 * subscription relies on — so this deliberately has no server-side filter: a
 * "mutual connection" isn't expressible as a simple column filter, RLS is the
 * actual boundary, and a client can only ever receive rows it's already allowed
 * to SELECT (20260811000004_live_run_sharing.sql).
 */
export function subscribeLiveFriendPositions(
  onUpsert: (position: LiveFriendPosition) => void,
  onRemove: (userId: string) => void,
): () => void {
  const channel = supabase
    .channel('live-run-positions')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'live_run_positions' },
      payload => {
        if (payload.eventType === 'DELETE') {
          const oldRow = payload.old as Record<string, unknown>;
          if (oldRow.user_id) onRemove(oldRow.user_id as string);
          return;
        }
        onUpsert(toLiveFriendPosition(payload.new as Record<string, unknown>));
      },
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
