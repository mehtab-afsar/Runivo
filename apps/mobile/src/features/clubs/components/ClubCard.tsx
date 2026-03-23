import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { avatarColor } from '@shared/lib/avatarUtils';
import type { Club } from '@features/clubs/types';

const C = {
  white: '#FFFFFF', stone: '#F0EDE8', border: '#DDD9D4',
  black: '#0A0A0A', t2: '#6B6B6B', t3: '#ADADAD',
};

interface Props {
  club: Club;
  onJoin: () => void;
  onLeave: () => void;
}

export function ClubCard({ club, onJoin, onLeave }: Props) {
  const bg = avatarColor(club.name);
  return (
    <View style={s.card}>
      <View style={[s.badge, { backgroundColor: bg + '22' }]}>
        <Text style={{ fontSize: 22 }}>{club.badge_emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.clubName}>{club.name}</Text>
        {club.description ? (
          <Text style={s.clubDesc} numberOfLines={2}>{club.description}</Text>
        ) : null}
        <View style={s.statsRow}>
          <Text style={s.stat}>👥 {club.member_count}</Text>
          <Text style={s.stat}>  🏃 {club.total_km.toFixed(0)} km</Text>
        </View>
      </View>
      <Pressable style={[s.joinBtn, club.joined && s.leaveBtn]} onPress={club.joined ? onLeave : onJoin}>
        <Text style={[s.joinLabel, club.joined && s.leaveLabelStyle]}>
          {club.joined ? 'Leave' : club.join_policy === 'open' ? 'Join' : 'Request'}
        </Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: C.white, borderRadius: 14, borderWidth: 0.5,
    borderColor: C.border, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  badge: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  clubName: { fontFamily: 'Barlow_600SemiBold', fontSize: 14, color: C.black, marginBottom: 2 },
  clubDesc: { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t2, lineHeight: 15, marginBottom: 4 },
  statsRow: { flexDirection: 'row' },
  stat: { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t3 },
  joinBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: C.black, flexShrink: 0 },
  leaveBtn: { backgroundColor: C.stone },
  joinLabel: { fontFamily: 'Barlow_500Medium', fontSize: 11, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 },
  leaveLabelStyle: { color: C.t2 },
});
