import React, { useMemo } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { useTheme } from '@theme';
import type { ClubMember } from '@features/clubs/types';
import { MemberRow } from './MemberRow';
import { mkCommonStyles } from './clubDetailStyles';

interface Props {
  loading: boolean;
  /** Already sorted by total km, highest first. */
  leaderboard: ClubMember[];
  onOpenProfile: (userId: string, username: string) => void;
}

export function ClubLeaderboardTab({ loading, leaderboard, onOpenProfile }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkCommonStyles(C), [C]);

  if (loading) {
    return <View style={s.loader}><ActivityIndicator color={C.red} /></View>;
  }
  return (
    <FlatList
      data={leaderboard}
      keyExtractor={mb => mb.id}
      renderItem={({ item, index }) => (
        <MemberRow
          member={item}
          rank={index}
          onPress={() => onOpenProfile(item.id, item.username)}
        />
      )}
      contentContainerStyle={s.listContent}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <Text style={s.sectionLabel}>Ranked by total km</Text>
      }
      ListEmptyComponent={
        <View style={s.empty}>
          <Text style={s.emptyTitle}>No members yet</Text>
        </View>
      }
    />
  );
}
