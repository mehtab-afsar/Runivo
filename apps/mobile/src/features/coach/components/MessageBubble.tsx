import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Sparkles } from 'lucide-react-native';

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
          <Sparkles size={14} color="#7C3AED" strokeWidth={1.5} />
        </View>
      )}
      <View style={[ss.bubble, isUser ? ss.bubbleUser : ss.bubbleAi]}>
        <Text style={[ss.text, isUser && ss.textUser]}>{content}</Text>
      </View>
      {isUser && <View style={{ width: 32 }} />}
    </View>
  );
}

const ss = StyleSheet.create({
  wrap:       { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 16, paddingVertical: 3 },
  wrapUser:   { flexDirection: 'row-reverse' },
  avatar:     { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F2EEF9', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bubble:     { maxWidth: '75%', paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { backgroundColor: '#0A0A0A', borderRadius: 14, borderBottomRightRadius: 4 },
  bubbleAi:   { backgroundColor: '#FFFFFF', borderRadius: 14, borderBottomLeftRadius: 4, borderWidth: 0.5, borderColor: '#DDD9D4' },
  text:       { fontFamily: 'Barlow_400Regular', fontSize: 13, color: '#0A0A0A', lineHeight: 20 },
  textUser:   { color: '#FFFFFF' },
});
