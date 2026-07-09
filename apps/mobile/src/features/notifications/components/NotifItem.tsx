import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Bell } from 'phosphor-react-native';
import { fmtRelativeTime } from '@mobile/shared/lib/formatters';
import type { AppNotification } from '../types';
import { NOTIF_CONFIG } from '../types';
import { useTheme, Fonts, type AppColors } from '@theme';

interface Props {
  notif: AppNotification;
  onPress: () => void;
}

export function NotifItem({ notif, onPress }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const cfg = NOTIF_CONFIG[notif.type] ?? { emoji: '__bell__', bg: C.surface, fg: C.t2 };
  return (
    <Pressable style={[s.card, !notif.read && s.cardUnread]} onPress={onPress}>
      <View style={[s.iconWrap, { backgroundColor: cfg.bg }]}>
        {cfg.emoji === '__bell__'
          ? <Bell size={20} color={cfg.fg} weight="light" />
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

function mkStyles(C: AppColors) { return StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 12, borderWidth: 0.5, borderColor: C.border, padding: 14, flexDirection: 'row', alignItems: 'center' },
  cardUnread: { borderLeftWidth: 2, borderLeftColor: C.red },
  iconWrap: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  emoji: { fontSize: 20 },
  title: { fontFamily: Fonts.medium, fontSize: 13, color: C.black, marginBottom: 2 },
  body: { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, lineHeight: 17, marginBottom: 4 },
  time: { fontFamily: Fonts.regular, fontSize: 10, color: C.t3 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.red, flexShrink: 0, marginLeft: 8 },
}); }
