import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import { Avatar } from '@mobile/shared/components/Avatar';
import type { ActivityItem } from '@features/clubs/types';
import { activityLabel, formatTimeAgo } from '../../utils/clubDetailFormatters';

export function ActivityRow({ item }: { item: ActivityItem }) {
  const C = useTheme();
  const ar = useMemo(() => mkArStyles(C), [C]);
  const label = activityLabel(item.action);
  const timeAgo = formatTimeAgo(item.time);

  return (
    <View style={ar.row}>
      <View style={[ar.avatar, { overflow: 'hidden' }]}>
        <Avatar name={item.username} uri={item.avatarUrl ?? null} size={32} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={ar.text}>
          <Text style={ar.username}>{item.username}</Text>
          {' '}{label}{item.detail ? ` · ${item.detail}` : ''}
        </Text>
        <Text style={ar.time}>{timeAgo}</Text>
      </View>
    </View>
  );
}

function mkArStyles(C: AppColors) {
  return StyleSheet.create({
    row:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
    avatar:    { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
    text:      { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, lineHeight: 19 },
    username:  { fontFamily: Fonts.semiBold, color: C.t1 },
    time:      { fontFamily: Fonts.regular, fontSize: 11, color: C.t3, marginTop: 2 },
  });
}
