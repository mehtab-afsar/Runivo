import React, { useMemo } from 'react';
import { View, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Send } from 'lucide-react-native';
import { Fonts, useTheme, type AppColors } from '@theme';

interface Props {
  value: string;
  onChange: (text: string) => void;
  onSend: () => void;
  sending: boolean;
  disabled?: boolean;
  /** "Message Hyde Park Hustlers" */
  placeholder?: string;
}

export function ChatInput({ value, onChange, onSend, sending, disabled, placeholder = 'Message' }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const canSend = value.trim().length > 0 && !sending;
  return (
    <View style={s.bar}>
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.t3}
        maxLength={500}
        returnKeyType="send"
        onSubmitEditing={onSend}
        editable={!disabled}
      />
      <Pressable style={[s.sendBtn, !canSend && { opacity: 0.55 }]} onPress={onSend} disabled={!canSend} accessibilityLabel="Send">
        {sending
          ? <ActivityIndicator size="small" color="#fff" />
          : <Send size={18} color="#fff" strokeWidth={2} />}
      </Pressable>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: C.bg,
  },
  input: {
    flex: 1, backgroundColor: C.border, borderRadius: 999,
    paddingHorizontal: 18, height: 46,
    fontFamily: Fonts.regular, fontSize: 14, color: C.t1,
  },
  sendBtn: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: C.red,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  });
}
