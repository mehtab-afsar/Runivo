import { supabase } from '@shared/services/supabase';
import type { StoredRun } from '@shared/services/store';

interface Row { id: string; activity_type: string; title: string | null; started_at: string; distance_m: number | string; duration_sec: number; avg_pace: string | null }

/**
 * Another runner's activities that you may see (20261113000004), shaped as
 * StoredRun so the profile sections render them unchanged. No GPS or notes.
 */
export async function fetchRunnerActivities(userId: string): Promise<StoredRun[]> {
  const { data, error } = await supabase.rpc('get_runner_activities', { p_user_id: userId, p_limit: 200 });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(r => ({
    id: r.id,
    activityType: r.activity_type,
    title: r.title,
    startTime: new Date(r.started_at).getTime(),
    endTime: new Date(r.started_at).getTime() + r.duration_sec * 1000,
    distanceMeters: Number(r.distance_m),
    durationSec: r.duration_sec,
    avgPace: r.avg_pace ?? '',
    gpsPoints: [],
    territoriesClaimed: [],
    synced: true,
  }) as unknown as StoredRun);
}
