import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

const C = { white: '#FFFFFF', border: '#DDD9D4', black: '#0A0A0A', t2: '#6B6B6B', t3: '#ADADAD', red: '#D93518' };

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
  return (
    <Pressable style={s.card} onPress={onPress}>
      <View style={[s.roomIcon, { backgroundColor: room.color + '18' }]}>
        <Text style={{ fontSize: 22 }}>{room.emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.roomName}>{room.name}</Text>
        <Text style={s.roomDesc}>{room.description}</Text>
        {(room.messagesToday ?? 0) > 0 && (
          <Text style={s.activityText}>📈 {room.messagesToday} messages today</Text>
        )}
      </View>
      <Text style={s.chevron}>›</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
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
