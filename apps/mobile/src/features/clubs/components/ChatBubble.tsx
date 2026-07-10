import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { avatarColor } from '@shared/lib/avatarUtils';
import type { LobbyMessage } from '@features/clubs/services/lobbyChatService';
import { Fonts, useTheme, type AppColors } from '@theme';

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

interface Props {
  message: LobbyMessage;
  isOwn: boolean;
}

export function ChatBubble({ message, isOwn }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const bg = avatarColor(message.userName);
  const initials = message.userName.slice(0, 2).toUpperCase();

  return (
    <View style={[s.wrap, isOwn && s.wrapMe]}>
      {!isOwn && (
        <View style={[s.avatar, { backgroundColor: bg }]}>
          <Text style={s.avatarText}>{initials}</Text>
        </View>
      )}
      <View style={[s.content, isOwn && s.contentMe]}>
        {!isOwn && (
          <View style={s.nameRow}>
            <Text style={s.senderName}>{message.userName}</Text>
            <View style={[s.levelBadge, { backgroundColor: bg + '22' }]}>
              <Text style={[s.levelText, { color: bg }]}>Lv.{message.userLevel}</Text>
            </View>
          </View>
        )}
        <View style={[s.bubble, isOwn ? s.bubbleMe : s.bubbleThem]}>
          <Text style={[s.msgText, isOwn && s.msgTextMe]}>{message.message}</Text>
        </View>
        <Text style={[s.time, isOwn && s.timeMe]}>{formatTime(message.timestamp)}</Text>
      </View>
      {isOwn && <View style={{ width: 30 }} />}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
  wrap:            { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 16, paddingVertical: 3 },
  wrapMe:          { flexDirection: 'row-reverse' },
  avatar:          { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText:      { fontFamily: Fonts.bold, fontSize: 11, color: C.white },
  content:         { maxWidth: '72%', alignItems: 'flex-start' },
  contentMe:       { alignItems: 'flex-end' },
  nameRow:         { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3, paddingLeft: 2 },
  senderName:      { fontFamily: Fonts.semiBold, fontSize: 11, color: C.t2 },
  levelBadge:      { borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  levelText:       { fontFamily: Fonts.regular, fontSize: 10 },
  bubble:          { borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleMe:        { backgroundColor: C.red, borderBottomRightRadius: 4 },
  bubbleThem:      { backgroundColor: C.card, borderWidth: 0.5, borderColor: C.border, borderBottomLeftRadius: 4 },
  msgText:         { fontFamily: Fonts.regular, fontSize: 14, color: C.t1, lineHeight: 20 },
  msgTextMe:       { color: C.white },
  time:            { fontFamily: Fonts.regular, fontSize: 10, color: C.t3, marginTop: 3, paddingLeft: 2 },
  timeMe:          { paddingLeft: 0, paddingRight: 2 },
  });
}
