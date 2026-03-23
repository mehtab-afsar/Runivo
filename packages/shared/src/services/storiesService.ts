import { supabase } from '../services/supabase';

export interface Story {
  id: string;
  userId: string;
  runId?: string;
  imageUrl: string;
  createdAt: string;
  expiresAt: string;
}

/**
 * Upload a run story PNG (data URL) to Supabase Storage and insert a stories row.
 * Returns the created Story or null on failure.
 */
export async function uploadStory(dataUrl: string, runId?: string): Promise<Story | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const fileName = `${session.user.id}/${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from('stories')
      .upload(fileName, blob, { contentType: 'image/png', upsert: false });

    if (uploadError) {
      console.warn('[storiesService] upload failed:', uploadError.message);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage.from('stories').getPublicUrl(fileName);

    const { data, error: insertError } = await supabase
      .from('stories')
      .insert({ user_id: session.user.id, run_id: runId ?? null, image_url: publicUrl })
      .select()
      .single();

    if (insertError || !data) {
      console.warn('[storiesService] insert failed:', insertError?.message);
      return null;
    }

    return {
      id: data.id,
      userId: data.user_id,
      runId: data.run_id ?? undefined,
      imageUrl: data.image_url,
      createdAt: data.created_at,
      expiresAt: data.expires_at,
    };
  } catch (err) {
    console.warn('[storiesService] unexpected error:', err);
    return null;
  }
}

/**
 * Fetch active (non-expired) stories for a list of user IDs.
 * Returns a Map: userId → Story[]
 */
export async function fetchActiveStoriesForUsers(userIds: string[]): Promise<Map<string, Story[]>> {
  if (userIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('stories')
    .select('id, user_id, run_id, image_url, created_at, expires_at')
    .in('user_id', userIds)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: true });

  if (error || !data) return new Map();

  const map = new Map<string, Story[]>();
  for (const row of data) {
    const list = map.get(row.user_id) ?? [];
    list.push({
      id: row.id,
      userId: row.user_id,
      runId: row.run_id ?? undefined,
      imageUrl: row.image_url,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    });
    map.set(row.user_id, list);
  }
  return map;
}

/**
 * Fetch my own active stories (not yet expired).
 */
export async function fetchMyActiveStories(): Promise<Story[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];

  const { data, error } = await supabase
    .from('stories')
    .select('id, user_id, run_id, image_url, created_at, expires_at')
    .eq('user_id', session.user.id)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: true });

  if (error || !data) return [];

  return data.map(row => ({
    id: row.id,
    userId: row.user_id,
    runId: row.run_id ?? undefined,
    imageUrl: row.image_url,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }));
}
