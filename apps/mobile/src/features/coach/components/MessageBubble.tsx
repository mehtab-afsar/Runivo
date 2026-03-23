import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  role:    'user' | 'assistant';
  content: string;
}

export function MessageBubble({ role, content }: Props) {
  const isUser = role === 'user';
  return (
    <View style={[ss.wrap, isUser && ss.wrapUser]}>
      {!isUser && (
        <View style={ss.avatar}>
          <Text style={{ fontSize: 14 }}>✨</Text>
        </View>
      )}
      <View style={[ss.bubble, isUser ? ss.bubbleUser : ss.bubbleAi]}>
        <Text style={[ss.text, isUser && ss.textUser]}>{content}</Text>
      </View>
      {isUser && <View style={{ width: 30 }} />}
    </View>
  );
}

const ss = StyleSheet.create({
  wrap:       { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 16, paddingVertical: 3 },
  wrapUser:   { flexDirection: 'row-reverse' },
  avatar:     { width: 30, height: 30, borderRadius: 8, backgroundColor: '#F2EEF9', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bubble:     { maxWidth: '75%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { backgroundColor: '#D93518', borderBottomRightRadius: 4 },
  bubbleAi:   { backgroundColor: '#F2EEF9', borderBottomLeftRadius: 4 },
  text:       { fontFamily: 'Barlow_400Regular', fontSize: 14, color: '#0A0A0A', lineHeight: 20 },
  textUser:   { color: '#fff' },
});
