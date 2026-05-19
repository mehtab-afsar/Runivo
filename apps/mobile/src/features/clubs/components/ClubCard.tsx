import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Users, Pulse } from 'phosphor-react-native';
import { avatarColor } from '@shared/lib/avatarUtils';
import { getEmojiIcon } from '@mobile/shared/lib/emojiIcon';
import type { Club } from '@features/clubs/types';
import { useTheme, type AppColors } from '@theme';

interface Props {
  club: Club;
  onJoin: () => void;
  onLeave: () => void;
  onPress?: () => void;
}

export function ClubCard({ club, onJoin, onLeave, onPress }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const bg = avatarColor(club.name);
  const { icon: BadgeIcon, color: badgeColor } = getEmojiIcon(club.badge_emoji);
  return (
    <Pressable style={s.card} onPress={onPress}>
      <View style={[s.badge, { backgroundColor: bg + '22' }]}>
        <BadgeIcon size={22} color={badgeColor} weight="light" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.clubName}>{club.name}</Text>
        {club.description ? (
          <Text style={s.clubDesc} numberOfLines={2}>{club.description}</Text>
        ) : null}
        <View style={s.statsRow}>
          <Users size={11} color={C.t3} weight="light" />
          <Text style={s.stat}> {club.member_count}  </Text>
          <Pulse size={11} color={C.t3} weight="light" />
          <Text style={s.stat}> {club.total_km.toFixed(0)} km</Text>
        </View>
      </View>
      <Pressable style={[s.joinBtn, club.joined && s.leaveBtn]} onPress={club.joined ? onLeave : onJoin}>
        <Text style={[s.joinLabel, club.joined && s.leaveLabelStyle]}>
          {club.joined ? 'Leave' : club.join_policy === 'open' ? 'Join' : 'Request'}
        </Text>
      </Pressable>
    </Pressable>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: C.white, borderRadius: 14, borderWidth: 0.5,
      borderColor: C.border, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
    },
    badge: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    clubName: { fontWeight: '600', fontSize: 14, color: C.black, marginBottom: 2 },
    clubDesc: { fontSize: 11, color: C.t2, lineHeight: 15, marginBottom: 4 },
    statsRow: { flexDirection: 'row', alignItems: 'center' },
    stat: { fontSize: 11, color: C.t3 },
    joinBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: C.black, flexShrink: 0 },
    leaveBtn: { backgroundColor: C.stone },
    joinLabel: { fontWeight: '500', fontSize: 11, color: '#fff', letterSpacing: 0.5 },
    leaveLabelStyle: { color: C.t2 },
  });
}
