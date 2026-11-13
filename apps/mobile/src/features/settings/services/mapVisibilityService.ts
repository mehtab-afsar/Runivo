import { supabase } from '@shared/services/supabase';
import { getSettings } from '@shared/services/store';
import { effectiveRadius, type MapHideRadius } from '@shared/services/mapVisibility';

/**
 * Map visibility settings live on the profile and are enforced by the server
 * (20261112000001_map_visibility.sql). The screen keeps a copy in local
 * settings (through the settings context) so the share card can follow the
 * same rule offline.
 */
export interface MapVisibilitySettings { radiusM: MapHideRadius; hideAll: boolean }

export async function fetchMapVisibility(): Promise<MapVisibilitySettings> {
  const local = await getSettings();
  const fallback = { radiusM: effectiveRadius(local.mapHideRadiusM), hideAll: !!local.mapHideAll };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fallback;
  const { data, error } = await supabase
    .from('profiles')
    .select('map_hide_radius_m, map_hide_all')
    .eq('id', user.id)
    .maybeSingle();
  if (error || !data) return fallback;
  return { radiusM: effectiveRadius(data.map_hide_radius_m as number), hideAll: !!data.map_hide_all };
}

/** Saves both choices and applies them to every past post. Returns how many posts changed. */
export async function saveMapVisibility(v: MapVisibilitySettings): Promise<number> {
  const { data, error } = await supabase.rpc('set_map_visibility', { p_radius_m: v.radiusM, p_hide_all: v.hideAll });
  if (error) throw new Error(error.message);
  return Number((data as { posts_updated?: number } | null)?.posts_updated ?? 0);
}

/**
 * Hide or show the map on one activity. The feed post is written right after
 * the run, so it may not exist yet when the summary opens: retry briefly.
 */
export async function setActivityMapHidden(runId: string, hidden: boolean): Promise<boolean> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, error } = await supabase.rpc('set_activity_map_hidden', { p_run_id: runId, p_hidden: hidden });
    if (error) throw new Error(error.message);
    if (Number(data) > 0) return true;
    await new Promise(r => setTimeout(r, 1500));
  }
  return false;
}

/** Is this activity's map hidden on its post? null when there is no post yet. */
export async function fetchActivityMapHidden(runId: string): Promise<boolean | null> {
  const { data } = await supabase.from('feed_posts').select('map_hidden').eq('run_id', runId).limit(1).maybeSingle();
  return data ? !!data.map_hidden : null;
}
