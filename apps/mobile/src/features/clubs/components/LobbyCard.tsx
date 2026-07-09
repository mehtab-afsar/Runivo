import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { TrendUp } from 'phosphor-react-native';
import { getEmojiIcon } from '@mobile/shared/lib/emojiIcon';
import { useTheme, Fonts, type AppColors } from '@theme';

export interface LobbyRoomDisplay {
  id: string;
  name: string;
  description: string;
  emoji: string;
  color: string;
  messagesToday?: number;
}

interface Props {
  room: LobbyRoomDisplay;
  onPress: () => void;
}

export function LobbyCard({ room, onPress }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const { icon: RoomIcon, color: roomIconColor } = getEmojiIcon(room.emoji);
  return (
    <Pressable style={s.card} onPress={onPress}>
      <View style={[s.roomIcon, { backgroundColor: room.color + '18' }]}>
        <RoomIcon size={22} color={roomIconColor} weight="light" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.roomName}>{room.name}</Text>
        <Text style={s.roomDesc}>{room.description}</Text>
        {(room.messagesToday ?? 0) > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <TrendUp size={10} color={C.red} weight="light" />
            <Text style={s.activityText}>{room.messagesToday} messages today</Text>
          </View>
        )}
      </View>
      <Text style={s.chevron}>›</Text>
    </Pressable>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: C.card, borderRadius: 16, borderWidth: 0.5,
      borderColor: C.border, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14,
    },
    roomIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    roomName: { fontFamily: Fonts.semiBold, fontSize: 14, color: C.black, marginBottom: 2 },
    roomDesc: { fontFamily: Fonts.regular, fontSize: 11, color: C.t2 },
    activityText: { fontFamily: Fonts.regular, fontSize: 10, color: C.red, marginTop: 4 },
    chevron: { fontFamily: Fonts.regular, fontSize: 22, color: C.t3, flexShrink: 0 },
  });
}
