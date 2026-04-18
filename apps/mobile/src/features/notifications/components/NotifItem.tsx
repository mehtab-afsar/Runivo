import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Bell } from 'lucide-react-native';
import { fmtRelativeTime } from '@mobile/shared/lib/formatters';
import type { AppNotification } from '../types';
import { NOTIF_CONFIG } from '../types';
import { Colors } from '@theme';

const C = Colors;
const DEFAULT_CONFIG = { emoji: '__bell__', bg: '#F0EDE8', fg: '#6B6B6B' };

interface Props {
  notif: AppNotification;
  onPress: () => void;
}

export function NotifItem({ notif, onPress }: Props) {
  const cfg = NOTIF_CONFIG[notif.type] ?? DEFAULT_CONFIG;
  return (
    <Pressable style={[s.card, !notif.read && s.cardUnread]} onPress={onPress}>
      <View style={[s.iconWrap, { backgroundColor: cfg.bg }]}>
        {cfg.emoji === '__bell__'
          ? <Bell size={20} color={cfg.fg} strokeWidth={1.5} />
          : <Text style={s.emoji}>{cfg.emoji}</Text>
        }
      </View>
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
  iconWrap: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  emoji: { fontSize: 20 },
  title: { fontFamily: 'Barlow_500Medium', fontSize: 13, color: C.black, marginBottom: 2 },
  body: { fontFamily: 'Barlow_300Light', fontSize: 12, color: C.t2, lineHeight: 17, marginBottom: 4 },
  time: { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.t3 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.red, flexShrink: 0, marginLeft: 8 },
});
