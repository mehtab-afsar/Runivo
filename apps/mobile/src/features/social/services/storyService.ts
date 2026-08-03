import { supabase } from '@shared/services/supabase';
import { fetchPublicProfiles } from '@mobile/shared/services/publicProfiles';

export interface Story {
  id: string;
  imageUrl: string;
}

export interface StoryGroup {
  userId: string;
  userName: string;
  stories: Story[];
}

export async function fetchStories(userId: string): Promise<StoryGroup[]> {
  const followingIds = await import('@features/social/services/feedService').then((m) =>
    m.fetchFollowingIds(userId),
  );

  if (followingIds.length === 0) return [];

  const { data, error } = await supabase
    .from('stories')
    .select('id, user_id, image_url')
    .in('user_id', followingIds)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const rows = data ?? [];
  const profiles = await fetchPublicProfiles(rows.map(r => r.user_id as string));

  const groupMap = new Map<string, StoryGroup>();
  for (const row of rows) {
    const uid: string = row.user_id;
    if (!groupMap.has(uid)) {
      groupMap.set(uid, {
        userId: uid,
        userName: profiles.get(uid)?.username ?? 'Runner',
        stories: [],
      });
    }
    groupMap.get(uid)!.stories.push({ id: row.id, imageUrl: row.image_url });
  }

  return Array.from(groupMap.values());
}

export async function fetchUserStory(storyId: string): Promise<Story | null> {
  const { data, error } = await supabase
    .from('stories')
    .select('id, image_url')
    .eq('id', storyId)
    .single();
  if (error || !data) return null;
  return { id: data.id, imageUrl: data.image_url };
}
