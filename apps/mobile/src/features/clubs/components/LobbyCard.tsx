import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { TrendingUp } from 'lucide-react-native';
import { getEmojiIcon } from '@mobile/shared/lib/emojiIcon';
import { useTheme, type AppColors } from '@theme';

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
        <RoomIcon size={22} color={roomIconColor} strokeWidth={1.5} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.roomName}>{room.name}</Text>
        <Text style={s.roomDesc}>{room.description}</Text>
        {(room.messagesToday ?? 0) > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <TrendingUp size={10} color={C.red} strokeWidth={1.5} />
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
      backgroundColor: C.white, borderRadius: 16, borderWidth: 0.5,
      borderColor: C.border, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14,
    },
    roomIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    roomName: { fontFamily: 'Barlow_600SemiBold', fontSize: 14, color: C.black, marginBottom: 2 },
    roomDesc: { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t2 },
    activityText: { fontFamily: 'Barlow_400Regular', fontSize: 10, color: C.red, marginTop: 4 },
    chevron: { fontFamily: 'Barlow_300Light', fontSize: 22, color: C.t3, flexShrink: 0 },
  });
}
