import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Sparkle } from 'phosphor-react-native';
import { Fonts, useTheme, type AppColors } from '@theme';
import { CoachMessageCard } from './CoachMessageCard';

interface Props {
  role:    'user' | 'assistant';
  content: string;
  type?:   string;
}

export function MessageBubble({ role, content, type }: Props) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const isUser = role === 'user';

  if (!isUser && type && type !== 'text') {
    return (
      <View style={[ss.wrap, ss.wrapAi]}>
        <View style={ss.avatar}>
          <Sparkle size={14} color={C.purple} weight="light" />
        </View>
        <CoachMessageCard type={type} content={content} />
      </View>
    );
  }

  return (
    <View style={[ss.wrap, isUser && ss.wrapUser]}>
      {!isUser && (
        <View style={ss.avatar}>
          <Sparkle size={14} color={C.purple} weight="light" />
        </View>
      )}
      <View style={[ss.bubble, isUser ? ss.bubbleUser : ss.bubbleAi]}>
        <Text style={[ss.text, isUser && ss.textUser]}>{content}</Text>
      </View>
      {isUser && <View style={{ width: 32 }} />}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    wrap:       { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 16, paddingVertical: 3 },
    wrapUser:   { flexDirection: 'row-reverse' },
    wrapAi:     { alignItems: 'flex-start' },
    avatar:     { width: 32, height: 32, borderRadius: 8, backgroundColor: C.blueBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    bubble:     { maxWidth: '75%', paddingHorizontal: 14, paddingVertical: 10 },
    bubbleUser: { backgroundColor: C.alwaysDark, borderRadius: 14, borderBottomRightRadius: 4 },
    bubbleAi:   { backgroundColor: C.card, borderRadius: 14, borderBottomLeftRadius: 4, borderWidth: 0.5, borderColor: C.border },
    text:       { fontFamily: Fonts.regular, fontSize: 13, color: C.t1, lineHeight: 20 },
    textUser:   { color: C.alwaysLight },
  });
}
