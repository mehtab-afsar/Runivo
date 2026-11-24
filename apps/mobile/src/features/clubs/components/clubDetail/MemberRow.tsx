import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import { Avatar } from '@mobile/shared/components/Avatar';
import type { ClubMember } from '@features/clubs/types';
import { memberMetaLine } from '../../utils/clubDetailFormatters';

interface Props {
  member: ClubMember;
  rank?: number;
  onPress: () => void;
  onLongPress?: () => void;
}

export function MemberRow({ member, rank, onPress, onLongPress }: Props) {
  const C = useTheme();
  const mr = useMemo(() => mkMrStyles(C), [C]);
  return (
    <Pressable style={mr.row} onPress={onPress} onLongPress={onLongPress} delayLongPress={350}>
      {rank !== undefined && (
        <Text style={[mr.rank, rank < 3 && mr.rankTop]}>{rank + 1}</Text>
      )}
      <View style={[mr.avatar, { overflow: 'hidden' }]}>
        <Avatar name={member.username} uri={member.avatarUrl ?? null} size={38} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={mr.nameRow}>
          <Text style={mr.name}>{member.username}</Text>
          {member.role === 'admin' && (
            <View style={mr.adminBadge}><Text style={mr.adminText}>Admin</Text></View>
          )}
        </View>
        <Text style={mr.meta}>{memberMetaLine(member.total_km)}</Text>
      </View>
      <Text style={mr.kmVal}>{member.total_km.toFixed(0)}<Text style={mr.kmUnit}> km</Text></Text>
    </Pressable>
  );
}

function mkMrStyles(C: AppColors) {
  return StyleSheet.create({
    row:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: 22, shadowColor: C.t1, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1, padding: 12, marginBottom: 6 },
    rank:      { width: 30, textAlign: 'center', fontFamily: Fonts.numeric, fontSize: 22, lineHeight: 24, color: C.t2, fontVariant: ['tabular-nums'] },
    rankTop:   { color: C.red },
    avatar:    { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    nameRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
    name:      { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
    adminBadge:{ backgroundColor: C.redLo, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
    adminText: { fontFamily: Fonts.semiBold, fontSize: 11, color: C.red },
    meta:      { fontFamily: Fonts.regular, fontSize: 11, color: C.t3, marginTop: 2 },
    kmVal:     { fontFamily: Fonts.numeric, fontSize: 22, lineHeight: 24, color: C.t1, fontVariant: ['tabular-nums'] },
    kmUnit:    { fontFamily: Fonts.medium, fontSize: 11, color: C.t3 },
  });
}
