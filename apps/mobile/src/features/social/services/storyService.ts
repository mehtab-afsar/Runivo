import { supabase } from '@shared/services/supabase';

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
    .select('id, user_id, image_url, profiles(username)')
    .in('user_id', followingIds)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const groupMap = new Map<string, StoryGroup>();
  for (const row of data ?? []) {
    const uid: string = row.user_id;
    if (!groupMap.has(uid)) {
      groupMap.set(uid, {
        userId: uid,
        userName: (row.profiles as any)?.username ?? 'Runner',
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
