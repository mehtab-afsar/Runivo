import React, { useMemo } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useTheme } from '@theme';
import type { ClubMember } from '@features/clubs/types';
import { MemberRow } from './MemberRow';
import { mkCommonStyles } from './clubDetailStyles';

interface Props {
  loading: boolean;
  members: ClubMember[];
  isModerator: boolean;
  isOwner: boolean;
  currentUserId: string | null;
  canRemove: (userId: string, role?: string) => boolean;
  onOpenProfile: (userId: string, username: string) => void;
  onRemove: (userId: string, username: string) => void;
  onLeave: () => void;
}

export function ClubMembersTab({ loading, members, isModerator, isOwner, currentUserId, canRemove, onOpenProfile, onRemove, onLeave }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkCommonStyles(C), [C]);

  if (loading) {
    return <View style={s.loader}><ActivityIndicator color={C.red} /></View>;
  }
  return (
    <FlatList
      data={members}
      keyExtractor={mb => mb.id}
      renderItem={({ item }) => (
        <MemberRow
          member={item}
          onPress={() => onOpenProfile(item.id, item.username)}
          onLongPress={canRemove(item.id, item.role) ? () => onRemove(item.id, item.username) : undefined}
        />
      )}
      contentContainerStyle={s.listContent}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={isModerator ? <Text style={s.sectionLabel}>Long press a member to remove them</Text> : null}
      ListEmptyComponent={
        <View style={s.empty}>
          <Text style={s.emptyTitle}>No members found</Text>
        </View>
      }
      ListFooterComponent={!isOwner && members.some(m => m.id === currentUserId) ? (
        <Pressable style={s.dangerRow} onPress={onLeave} accessibilityRole="button">
          <Text style={s.dangerText}>Leave club</Text>
        </Pressable>
      ) : null}
    />
  );
}
