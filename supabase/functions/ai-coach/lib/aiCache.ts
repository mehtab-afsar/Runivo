// ai_cache: one row per (user, feature). A row is reusable while its
// context_hash matches the hash of the inputs the reply was generated from.
import type { Db, Feature } from './types.ts';

export interface CacheRow {
  payload: unknown;
  context_hash: string;
}

export async function readCache(supabase: Db, userId: string, feature: Feature): Promise<CacheRow | null> {
  const { data } = await supabase
    .from('ai_cache')
    .select('payload, context_hash')
    .eq('user_id', userId)
    .eq('feature', feature)
    .single();
  return data as CacheRow | null;
}

export async function writeCache(
  supabase: Db,
  userId: string,
  feature: Feature,
  payload: unknown,
  hash: string,
): Promise<void> {
  await supabase.from('ai_cache').upsert({
    user_id:      userId,
    feature,
    payload,
    context_hash: hash,
    generated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,feature' });
}
