import React, { useRef, useEffect } from 'react';
import { View, TextInput, Pressable, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SquaresFour as LayoutGrid, ArrowUp } from 'phosphor-react-native';

interface Props {
  value:              string;
  onChangeText:       (text: string) => void;
  onSend:             () => void;
  sending:            boolean;
  onOpenCapabilities: () => void;
}

export function CoachFloatingInput({ value, onChangeText, onSend, sending, onOpenCapabilities }: Props) {
  const insets   = useSafeAreaInsets();
  const slideY   = useRef(new Animated.Value(60)).current;
  const opacity  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
      Animated.timing(opacity, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]).start();
  // Only runs on first mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canSend = value.trim().length > 0 && !sending;

  return (
    <Animated.View style={[ss.outer, { paddingBottom: Math.max(insets.bottom, 8) + 4, transform: [{ translateY: slideY }], opacity }]}>
      <View style={ss.pill}>
        <Pressable style={ss.zapBtn} onPress={onOpenCapabilities} hitSlop={8}>
          <LayoutGrid size={16} color="#7C3AED" weight="light" />
        </Pressable>
        <TextInput
          style={ss.input}
          value={value}
          onChangeText={onChangeText}
          placeholder="Ask your coach..."
          placeholderTextColor="rgba(10,10,10,0.32)"
          multiline
          blurOnSubmit
          onSubmitEditing={onSend}
          editable={!sending}
        />
        <Pressable
          style={[ss.sendBtn, canSend && ss.sendBtnActive]}
          onPress={onSend}
          disabled={!canSend}
          hitSlop={8}
        >
          <ArrowUp size={16} color={canSend ? '#fff' : 'rgba(10,10,10,0.22)'} weight="bold" />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const ss = StyleSheet.create({
  outer:        { paddingHorizontal: 16, paddingTop: 10, backgroundColor: 'transparent' },
  pill:         { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#FFFFFF', borderRadius: 28, paddingHorizontal: 8, paddingVertical: 8, gap: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: -2 }, elevation: 8 },
  zapBtn:       { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(124,58,237,0.08)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  input:        { flex: 1, fontSize: 14, color: '#0A0A0A', maxHeight: 120, paddingVertical: 8, paddingHorizontal: 4 },
  sendBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(10,10,10,0.08)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sendBtnActive:{ backgroundColor: '#0A0A0A' },
});
