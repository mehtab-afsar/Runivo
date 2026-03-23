import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { fmtRelativeTime } from '@mobile/shared/lib/formatters';
import type { AppNotification } from '../types';
import { NOTIF_EMOJI } from '../types';

const C = { white: '#FFF', border: '#DDD9D4', black: '#0A0A0A', t2: '#6B6B6B', t3: '#ADADAD', red: '#D93518' };

interface Props {
  notif: AppNotification;
  onPress: () => void;
}

export function NotifItem({ notif, onPress }: Props) {
  return (
    <Pressable style={[s.card, !notif.read && s.cardUnread]} onPress={onPress}>
      <Text style={s.emoji}>{NOTIF_EMOJI[notif.type] ?? '🔔'}</Text>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={s.title}>{notif.title}</Text>
        <Text style={s.body} numberOfLines={2}>{notif.body}</Text>
        <Text style={s.time}>{fmtRelativeTime(notif.created_at)}</Text>
      </View>
      {!notif.read && <View style={s.dot} />}
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: C.white, borderRadius: 12, borderWidth: 0.5, borderColor: C.border, padding: 14, flexDirection: 'row', alignItems: 'center' },
  cardUnread: { borderLeftWidth: 2, borderLeftColor: C.red },
  emoji: { fontSize: 22, flexShrink: 0 },
  title: { fontFamily: 'Barlow_500Medium', fontSize: 13, color: C.black, marginBottom: 2 },
  body: { fontFamily: 'Barlow_300Light', fontSize: 12, color: C.t2, lineHeight: 17, marginBottom: 4 },
  time: { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.t3 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.red, flexShrink: 0, marginLeft: 8 },
});
