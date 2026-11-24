/**
 * Pulling server state into the local cache: the runner's runs and territories, plus the
 * map viewport query for everyone's territories. Reads flow Supabase → local store, and
 * never overwrite a record that still has unsynced local changes.
 */
import { supabase } from '../supabase';
import {
  getRunById, saveRun, getTerritoryPolygons, saveTerritory, deleteTerritory, type StoredRun,
} from '../store';
import type { TerritoryPolygon, TerritoryTier } from '../../types/game';
import { getAuthenticatedUser } from './syncAuth';

/** A `runs` table row, the columns pullRuns reads. */
interface RunRow {
  id: string;
  activity_type: StoredRun['activityType'];
  started_at: string;
  finished_at: string;
  distance_m: number | string;
  duration_sec: number;
  avg_pace: string;
  gps_points: StoredRun['gpsPoints'] | null;
  territories_claimed: StoredRun['territoriesClaimed'];
  territories_fortified: StoredRun['territoriesFortified'];
  xp_earned: number;      // NOT NULL default 0 in the schema
  coins_earned: number;
  enemy_captured: number | null;
  pre_run_level: number | null;
  title: StoredRun['title'] | null;
  description: StoredRun['description'] | null;
  private_notes: StoredRun['privateNotes'] | null;
  perceived_effort: StoredRun['perceivedEffort'] | null;
  excluded: boolean | null;
  photo_paths: StoredRun['photoPaths'] | null;
  integrity_status: StoredRun['integrityStatus'] | null;
  integrity_reason: StoredRun['integrityReason'] | null;
  avg_hr: number | null;
  max_hr: number | null;
}

/**
 * Pull every run of the current user and cache it locally (history, totals).
 * Pages through all of them, newest first: stopping at the first 50 left a
 * reinstalled phone with only part of the runner's history (B10).
 */
export async function pullRuns(pageSize = 200): Promise<void> {
  const user = await getAuthenticatedUser();
  if (!user) return;

  const rows: RunRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('runs')
      .select('*')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error || !data) break;
    rows.push(...data);
    if (data.length < pageSize) break;
  }

  for (const row of rows) {
    // Guard: never overwrite a locally-stored GPS trace with empty remote GPS.
    // This prevents a race condition where the Supabase row exists (default gps_points=[])
    // but the background push hasn't completed yet, causing the local trace to be lost.
    const local = await getRunById(row.id);
    // Not scored yet: the local record (full GPS trace, mock flag, shoe,
    // elevation) is what the scoring retry sends. Replacing it with the server
    // row sent the simplified upload trace instead, which claims less ground,
    // pays less distance and dropped the mock-location flag.
    if (local && (local.synced === false || local.serverProcessed === false)) continue;
    const remoteGps = row.gps_points ?? [];
    const localGps = local?.gpsPoints ?? [];
    const gpsPoints = remoteGps.length >= 2 ? remoteGps : (localGps.length >= 2 ? localGps : remoteGps);

    await saveRun({
      id: row.id,
      activityType: row.activity_type,
      startTime: new Date(row.started_at).getTime(),
      endTime: new Date(row.finished_at).getTime(),
      distanceMeters: Number(row.distance_m),
      durationSec: row.duration_sec,
      avgPace: row.avg_pace,
      gpsPoints,
      territoriesClaimed: row.territories_claimed,
      territoriesFortified: row.territories_fortified,
      // Once the server has scored a run, its PACE and measured ground live on
      // the local record; the runs row still holds the app's first guess.
      xpEarned: local?.serverProcessed === true ? local.xpEarned : row.xp_earned,
      coinsEarned: row.coins_earned,
      enemyCaptured: row.enemy_captured ?? 0,
      preRunLevel: row.pre_run_level ?? 1,
      synced: true,
      serverProcessed: local?.serverProcessed,
      verifiedDistanceKm: local?.verifiedDistanceKm,
      territoryAreaM2: local?.territoryAreaM2,
      claimedAreaM2: local?.claimedAreaM2,
      serverResult: local?.serverResult,
      title: row.title ?? null,
      description: row.description ?? null,
      privateNotes: row.private_notes ?? null,
      perceivedEffort: row.perceived_effort ?? null,
      visibility: local?.visibility,
      excluded: row.excluded ?? false,
      photoPaths: row.photo_paths ?? [],
      integrityStatus: row.integrity_status ?? 'ok',
      heartRateAvg: row.avg_hr ?? local?.heartRateAvg,
      heartRateMax: row.max_hr ?? local?.heartRateMax,
      integrityReason: row.integrity_reason ?? null,
    });
  }
}

/**
 * Territory claims are now server-authoritative: process-run-territory (invoked from
 * pushUnsyncedRuns below) is the ONLY thing that inserts territory_polygons rows.
 * The client used to also push its own locally-built polygon for the same run under a
 * different id, which double-claimed area (and double-counted steals against rivals)
 * on every single run. RLS on territory_polygons no longer grants clients INSERT/UPDATE
 * for the same reason — see supabase/migrations for the corresponding policy change.
 *
 * The local polygon built by buildTerritoryPolygon() is still saved immediately
 * (useGameEngine.endRunSession) purely for optimistic on-device display; it is
 * superseded by pullTerritories() once the server's row comes back.
 */

/**
 * Pull the current user's own territory polygons from Supabase and reconcile the local
 * store: upserts server rows, and removes any locally-cached "synced" territory whose id
 * is no longer present server-side (e.g. fully captured by a rival) so a defeated player
 * doesn't keep seeing a zone they no longer own. Locally-unsynced records (optimistic,
 * not yet confirmed by the server) are never overwritten or deleted by this pass.
 */
export async function pullTerritories(): Promise<void> {
  const user = await getAuthenticatedUser();
  if (!user) return;

  const { data, error } = await supabase
    .from('territory_polygons')
    .select('id, run_id, owner_id, owner_name, polygon_coords, area_m2, freshness, last_defended_at, claimed_at, is_loop_fill, tier')
    .eq('owner_id', user.id)
    .limit(2000);

  if (error) return;

  const existing = await getTerritoryPolygons();
  const ownExisting = existing.filter(t => t.ownerId === user.id);
  const serverIds = new Set((data ?? []).map(row => row.id));

  for (const row of data ?? []) {
    const local = ownExisting.find(t => t.id === row.id);
    if (local && !local.synced) continue;

    const coords = (row.polygon_coords as [number, number][]) ?? [];
    if (coords.length < 4) continue;

    await saveTerritory({
      id:             row.id,
      runId:          row.run_id ?? '',
      ownerId:        row.owner_id,
      ownerName:      row.owner_name ?? '',
      polygon:        coords,
      areaM2:         Number(row.area_m2),
      freshness:      row.freshness ?? 100,
      lastDefendedAt: row.last_defended_at,
      claimedAt:      row.claimed_at,
      isLoopFill:     row.is_loop_fill ?? false,
      tier:           row.tier as TerritoryTier,
      synced:         true,
    });
  }

  const serverRunIds = new Set((data ?? []).map(row => row.run_id).filter(Boolean));
  const stale = ownExisting.filter(t =>
    (t.synced && !serverIds.has(t.id)) ||
    (!t.synced && t.runId && serverRunIds.has(t.runId)));
  for (const t of stale) {
    await deleteTerritory(t.id);
  }
}

/**
 * Fetches territory polygons visible within a map viewport bounding box.
 * Returns ALL owners' territories (for rival rendering).
 * Results are NOT persisted to local store — held in component state only.
 * Uses the get_map_polygons PostGIS RPC which filters by spatial intersection.
 */
export async function pullMapPolygons(bbox: {
  minLat: number; minLng: number; maxLat: number; maxLng: number;
}): Promise<TerritoryPolygon[]> {
  const { data, error } = await supabase.rpc('get_map_polygons', {
    min_lat: bbox.minLat,
    min_lng: bbox.minLng,
    max_lat: bbox.maxLat,
    max_lng: bbox.maxLng,
  });

  if (error || !data) return [];

  const rows = data as {
    id: string; owner_id: string; owner_name: string | null;
    area_m2: number; freshness: number; last_defended_at: string;
    is_loop_fill: boolean; tier: string; polygon_coords: [number, number][];
  }[];

  return rows
    .filter(r => r.polygon_coords && r.polygon_coords.length >= 4)
    .map(r => ({
      id:             r.id,
      runId:          '',
      ownerId:        r.owner_id,
      ownerName:      r.owner_name ?? '',
      polygon:        r.polygon_coords,
      areaM2:         Number(r.area_m2),
      freshness:      r.freshness ?? 100,
      lastDefendedAt: r.last_defended_at,
      claimedAt:      r.last_defended_at,
      isLoopFill:     r.is_loop_fill ?? false,
      tier:           r.tier as TerritoryTier,
      synced:         true,
    }));
}
