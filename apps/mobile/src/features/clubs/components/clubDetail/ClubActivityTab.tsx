import React, { useMemo } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { ClipboardText } from 'phosphor-react-native';
import { useTheme } from '@theme';
import { FeedPostCard } from '@features/social/components/FeedPostCard';
import type { FeedPost } from '@features/social/types';
import type { ActivityItem } from '@features/clubs/types';
import { ActivityRow } from './ActivityRow';
import { mkCommonStyles } from './clubDetailStyles';

interface Props {
  loading: boolean;
  activity: ActivityItem[];
  /** Members' activities (C3). */
  clubPosts: FeedPost[];
  currentUserId: string | null;
  onKudos: (postId: string) => void;
  onComment: (postId: string) => void;
  onOpenProfile: (userId: string, username: string) => void;
  onDeletePost: (postId: string) => void;
}

export function ClubActivityTab({ loading, activity, clubPosts, currentUserId, onKudos, onComment, onOpenProfile, onDeletePost }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkCommonStyles(C), [C]);

  if (loading) {
    return <View style={s.loader}><ActivityIndicator color={C.red} /></View>;
  }
  return (
    <FlatList
      data={activity}
      keyExtractor={a => a.id}
      renderItem={({ item }) => <ActivityRow item={item} />}
      contentContainerStyle={s.listContent}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <>
          {clubPosts.length > 0 && (
            <View style={{ gap: 12, marginBottom: 16 }}>
              <Text style={s.sectionLabel}>Members' activities</Text>
              {clubPosts.map(p => (
                <FeedPostCard
                  key={p.id}
                  post={p}
                  currentUserId={currentUserId}
                  onKudos={() => onKudos(p.id)}
                  onComment={() => onComment(p.id)}
                  onUserPress={() => onOpenProfile(p.userId, p.username)}
                  onDelete={() => onDeletePost(p.id)}
                />
              ))}
            </View>
          )}
          {activity.length > 0 && <Text style={s.sectionLabel}>Club news</Text>}
        </>
      }
      ListEmptyComponent={clubPosts.length > 0 ? null : (
        <View style={s.empty}>
          <ClipboardText size={36} color={C.t3} weight="light" />
          <Text style={s.emptyTitle}>No activity yet</Text>
          <Text style={s.emptyText}>Club runs and events will appear here.</Text>
        </View>
      )}
    />
  );
}
