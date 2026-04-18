import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { avatarColor } from '@shared/lib/avatarUtils';
import type { LobbyMessage } from '@features/clubs/services/lobbyChatService';
import { Colors } from '@theme';

const C = Colors;

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

interface Props {
  message: LobbyMessage;
  isOwn: boolean;
  onLongPress?: () => void;
}

export function ChatBubble({ message, isOwn, onLongPress }: Props) {
  const bg = avatarColor(message.userName);
  const initials = message.userName.slice(0, 2).toUpperCase();
  const hasReactions = (message.reactions?.length ?? 0) > 0;

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
        <Pressable onLongPress={onLongPress} delayLongPress={300}>
          <View style={[s.bubble, isOwn ? s.bubbleMe : s.bubbleThem]}>
            <Text style={[s.msgText, isOwn && s.msgTextMe]}>{message.message}</Text>
          </View>
        </Pressable>
        {hasReactions && (
          <View style={[s.reactionRow, isOwn && s.reactionRowMe]}>
            {message.reactions!.map(r => (
              <View key={r.emoji} style={[s.reactionBadge, r.hasMe && s.reactionBadgeMe]}>
                <Text style={s.reactionEmoji}>{r.emoji}</Text>
                {r.count > 1 && <Text style={s.reactionCount}>{r.count}</Text>}
              </View>
            ))}
          </View>
        )}
        <Text style={[s.time, isOwn && s.timeMe]}>{formatTime(message.timestamp)}</Text>
      </View>
      {isOwn && <View style={{ width: 30 }} />}
    </View>
  );
}

const s = StyleSheet.create({
  wrap:            { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 16, paddingVertical: 3 },
  wrapMe:          { flexDirection: 'row-reverse' },
  avatar:          { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText:      { fontFamily: 'Barlow_700Bold', fontSize: 11, color: '#fff' },
  content:         { maxWidth: '72%', alignItems: 'flex-start' },
  contentMe:       { alignItems: 'flex-end' },
  nameRow:         { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3, paddingLeft: 2 },
  senderName:      { fontFamily: 'Barlow_600SemiBold', fontSize: 11, color: C.t2 },
  levelBadge:      { borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  levelText:       { fontFamily: 'Barlow_400Regular', fontSize: 9 },
  bubble:          { borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleMe:        { backgroundColor: C.red, borderBottomRightRadius: 4 },
  bubbleThem:      { backgroundColor: C.white, borderWidth: 0.5, borderColor: C.border, borderBottomLeftRadius: 4 },
  msgText:         { fontFamily: 'Barlow_400Regular', fontSize: 14, color: C.black, lineHeight: 20 },
  msgTextMe:       { color: '#fff' },
  reactionRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4, paddingLeft: 2 },
  reactionRowMe:   { paddingLeft: 0, paddingRight: 2, justifyContent: 'flex-end' },
  reactionBadge:   { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 12, backgroundColor: '#F0EDE8', borderWidth: 0.5, borderColor: C.border },
  reactionBadgeMe: { backgroundColor: 'rgba(217,53,24,0.12)', borderColor: 'rgba(217,53,24,0.3)' },
  reactionEmoji:   { fontSize: 12 },
  reactionCount:   { fontFamily: 'Barlow_400Regular', fontSize: 10, color: C.t2 },
  time:            { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.t3, marginTop: 3, paddingLeft: 2 },
  timeMe:          { paddingLeft: 0, paddingRight: 2 },
});
