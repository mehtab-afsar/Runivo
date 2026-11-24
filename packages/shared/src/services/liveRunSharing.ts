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

/** Ends the caller's live share — call on pause/stop/unmount.
 *  The row is expired (dated to 1970), not deleted: realtime sends DELETE events
 *  to every subscriber without checking RLS, so a delete told every signed-in
 *  runner who had just stopped running. An expired row fails the RLS freshness
 *  rule, so nobody else can read it or receives the change; friends' screens drop
 *  it within useLiveFriendRuns' staleness window. */
export async function clearLivePosition(userId: string): Promise<void> {
  await supabase.from('live_run_positions').update({ updated_at: new Date(0).toISOString() }).eq('user_id', userId);
}

async function myId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
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
  const me = await myId();
  // The owner policy also returns your own row: you are not your own friend.
  let q = supabase.from('live_run_positions').select('*');
  if (me) q = q.neq('user_id', me);
  const { data, error } = await q;
  if (error || !data) return [];
  return data.map(toLiveFriendPosition).filter(p => p.updatedAt > Date.now() - 60_000);
}

/**
 * Subscribes to live position changes. postgres_changes evaluates RLS using the
 * subscribing client's own session — the same guarantee territory_polygons'
 * subscription relies on — so this deliberately has no server-side filter: a
 * "mutual connection" isn't expressible as a simple column filter, RLS is the
 * actual boundary, and a client can only ever receive rows it's already allowed
 * to SELECT (20260811000004_live_run_sharing.sql).
 */
let liveChannelSeq = 0;

export function subscribeLiveFriendPositions(
  onUpsert: (position: LiveFriendPosition) => void,
  onRemove: (userId: string) => void,
): () => void {
  // One channel per subscriber (B06). realtime-js hands back the EXISTING channel
  // for a topic it already has, so Home, Map, Record and the active run shared one,
  // and the first screen to unmount (removeChannel) cut live updates for the rest.
  const channel = supabase
    .channel(`live-run-positions:${++liveChannelSeq}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'live_run_positions' },
      async payload => {
        const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as Record<string, unknown>;
        if (row.user_id && row.user_id === await myId()) return;
        if (payload.eventType === 'DELETE') {
          const oldRow = payload.old as Record<string, unknown>;
          if (oldRow.user_id) onRemove(oldRow.user_id as string);
          return;
        }
        const pos = toLiveFriendPosition(payload.new as Record<string, unknown>);
        // An expired row (a friend stopped) never reaches others; if it does, treat it as gone.
        if (pos.updatedAt < Date.now() - 60_000) { onRemove(pos.userId); return; }
        onUpsert(pos);
      },
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
