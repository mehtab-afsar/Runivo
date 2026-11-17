import React, { useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PaceXOrb } from '@mobile/shared/components/PaceXOrb';
import { Fonts, useTheme, type AppColors } from '@theme';
import { CoachMessageCard } from './CoachMessageCard';
import { CoachSessionCard } from './CoachSessionCard';
import { parseCoachReply } from '@shared/engine/coachSession';

interface Props {
  role:    'user' | 'assistant';
  content: string;
  type?:   string;
  /** True only for a reply that just arrived live this session — plays the
   *  reveal animation once. History loaded on chat open renders instantly. */
  animate?: boolean;
}

/** Reveals `text` a few words at a time instead of all at once. Runs exactly
 *  once per message — re-renders after that (or `active: false`) are a no-op,
 *  so scrolling/FlatList re-renders never replay it. */
function useTypewriter(text: string, active: boolean): string {
  const [shown, setShown] = useState(active ? '' : text);
  const playedRef = useRef(!active);

  useEffect(() => {
    if (playedRef.current) return;
    const words = text.split(' ');
    let i = 0;
    const id = setInterval(() => {
      i++;
      setShown(words.slice(0, i).join(' '));
      if (i >= words.length) {
        clearInterval(id);
        playedRef.current = true;
      }
    }, 28);
    return () => clearInterval(id);
    // Deliberately empty: this effect is meant to run once per mounted
    // instance (a new message = a new list item = a fresh instance), not
    // whenever `text`/`active` happen to be referentially different.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return shown;
}

/** Splits on **bold** markdown — the one construct Claude's coaching replies
 *  reliably use — so it renders as actual emphasis instead of literal
 *  asterisks. Not a general markdown parser; extend only if a new construct
 *  shows up in real replies. */
function renderInline(text: string, boldStyle: object) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, i) => {
    const m = part.match(/^\*\*([^*]+)\*\*$/);
    return m
      ? <Text key={i} style={boldStyle}>{m[1]}</Text>
      : <Text key={i}>{part}</Text>;
  });
}

export function MessageBubble({ role, content, type, animate = false }: Props) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const isUser = role === 'user';
  // PaceX may end a reply with a <session> card (ai-coach chat prompt).
  const reply = useMemo(() => (isUser ? { text: content, session: null } : parseCoachReply(content)), [content, isUser]);
  const revealed = useTypewriter(reply.text, animate && !isUser);

  if (!isUser && type && type !== 'text') {
    return (
      <View style={[ss.wrap, ss.wrapAi]}>
        <View style={ss.avatar}>
          <PaceXOrb size={16} />
        </View>
        <CoachMessageCard type={type} content={content} />
      </View>
    );
  }

  return (
    <View style={[ss.wrap, isUser && ss.wrapUser]}>
      {!isUser && (
        <View style={ss.avatar}>
          <PaceXOrb size={16} />
        </View>
      )}
      <View style={ss.col}>
        <View style={[ss.bubble, isUser ? ss.bubbleUser : ss.bubbleAi]}>
          <Text style={[ss.text, isUser && ss.textUser]}>
            {isUser ? content : renderInline(revealed, ss.bold)}
          </Text>
        </View>
        {reply.session && revealed === reply.text && <CoachSessionCard session={reply.session} />}
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
    col:        { maxWidth: '80%', flexShrink: 1 },
    bubble:     { paddingHorizontal: 14, paddingVertical: 10 },
    bubbleUser: { backgroundColor: C.alwaysDark, borderRadius: 14, borderBottomRightRadius: 4 },
    bubbleAi:   { backgroundColor: C.card, borderRadius: 22, borderBottomLeftRadius: 4, borderWidth: 0.5, borderColor: C.border },
    text:       { fontFamily: Fonts.regular, fontSize: 13, color: C.t1, lineHeight: 20 },
    textUser:   { color: C.alwaysLight },
    bold:       { fontFamily: Fonts.semiBold },
  });
}
