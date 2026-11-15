import { supabase } from '@shared/services/supabase';

/**
 * Cross-user profile lookups.
 *
 * `profiles` is owner-only since 20260723000001_profiles_pii_lockdown.sql — it holds
 * phone, biometrics and last_known_location, and its old `using (true)` policy let the
 * anon key baked into the app bundle dump the whole table. Anything that needs to show
 * *another* user (clubs, stories, followers, feed, leaderboard) reads the
 * `profiles_public` view instead, which cannot project those columns.
 *
 * PostgREST embedding (`.select('..., profiles(username)')`) no longer works for those
 * screens: embedded resources are RLS-filtered too, so the join silently returned null
 * profiles. Fetch ids in one round trip and join client-side with this helper.
 */
export interface PublicProfile {
  id:                 string;
  username:           string | null;
  display_name:       string | null;
  avatar_url:         string | null;
  avatar_color:       string | null;
  level:              number | null;
  runner_rank:        string | null;
  total_distance_km:  number | null;
}

const PUBLIC_COLUMNS =
  'id, username, display_name, avatar_url, avatar_color, level, runner_rank, total_distance_km';

/** Look up public profile rows by id. Returns a Map keyed by user id; missing ids are absent. */
export async function fetchPublicProfiles(ids: string[]): Promise<Map<string, PublicProfile>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return new Map();

  const { data, error } = await supabase
    .from('profiles_public')
    .select(PUBLIC_COLUMNS)
    .in('id', unique);

  if (error) {
    console.error('[publicProfiles] fetch:', error.message);
    return new Map();
  }
  return new Map((data ?? []).map(p => [p.id as string, p as PublicProfile]));
}
