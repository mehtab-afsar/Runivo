import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { LobbyMessage } from '@features/clubs/services/lobbyChatService';
import { Fonts, useTheme, type AppColors } from '@theme';
import { Avatar } from '@mobile/shared/components/Avatar';

interface Props {
  message: LobbyMessage;
  isOwn: boolean;
  /** Long press: report, delete, remove the sender. */
  onLongPress?: () => void;
}

export function ChatBubble({ message, isOwn, onLongPress }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);

  return (
    <View style={[s.wrap, isOwn && s.wrapMe]}>
      {!isOwn && (
        <View style={[s.avatar, { overflow: 'hidden' }]}>
          <Avatar name={message.userName} uri={message.userAvatarUrl ?? null} size={30} />
        </View>
      )}
      <View style={[s.content, isOwn && s.contentMe]}>
        {!isOwn && <Text style={s.senderName}>{message.userName}</Text>}
        <Pressable
          style={[s.bubble, isOwn ? s.bubbleMe : s.bubbleThem]}
          onLongPress={onLongPress}
          disabled={!onLongPress}
          delayLongPress={350}
          accessibilityHint={onLongPress ? 'Long press for options' : undefined}
        >
          <Text style={[s.msgText, isOwn && s.msgTextMe]}>{message.message}</Text>
        </Pressable>
      </View>
      {isOwn && <View style={{ width: 30 }} />}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
  wrap:            { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 16, paddingVertical: 6 },
  wrapMe:          { flexDirection: 'row-reverse' },
  avatar:          { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText:      { fontFamily: Fonts.bold, fontSize: 11, color: C.white },
  content:         { maxWidth: '72%', alignItems: 'flex-start' },
  contentMe:       { alignItems: 'flex-end' },
  nameRow:         { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3, paddingLeft: 2 },
  senderName:      { fontFamily: Fonts.medium, fontSize: 12, color: C.t2, marginBottom: 4, paddingLeft: 2 },
  levelBadge:      { borderRadius: 999, paddingHorizontal: 4, paddingVertical: 1 },
  levelText:       { fontFamily: Fonts.regular, fontSize: 11 },
  bubble:          { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMe:        { backgroundColor: C.alwaysDark, borderBottomRightRadius: 6 },
  bubbleThem:      { backgroundColor: C.card, borderBottomLeftRadius: 6, shadowColor: C.t1, shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  msgText:         { fontFamily: Fonts.regular, fontSize: 15, color: C.t1, lineHeight: 21 },
  msgTextMe:       { color: C.alwaysLight },
  time:            { fontFamily: Fonts.regular, fontSize: 11, color: C.t3, marginTop: 3, paddingLeft: 2 },
  timeMe:          { paddingLeft: 0, paddingRight: 2 },
  });
}
