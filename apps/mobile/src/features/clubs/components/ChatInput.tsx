import React from 'react';
import { View, TextInput, Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';

const C = { white: '#FFFFFF', border: '#DDD9D4', black: '#0A0A0A', t3: '#ADADAD', red: '#D93518', mid: '#E8E4DF', bg: '#F8F6F3' };

interface Props {
  value: string;
  onChange: (text: string) => void;
  onSend: () => void;
  sending: boolean;
  disabled?: boolean;
}

export function ChatInput({ value, onChange, onSend, sending, disabled }: Props) {
  const canSend = value.trim().length > 0 && !sending;
  return (
    <View style={s.bar}>
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChange}
        placeholder="Message..."
        placeholderTextColor={C.t3}
        maxLength={500}
        returnKeyType="send"
        onSubmitEditing={onSend}
        editable={!disabled}
      />
      <Pressable style={[s.sendBtn, canSend && s.sendBtnActive]} onPress={onSend} disabled={!canSend}>
        {sending
          ? <ActivityIndicator size="small" color={C.t3} />
          : <Text style={[s.sendIcon, canSend && s.sendIconActive]}>↑</Text>}
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 0.5, borderTopColor: C.border, backgroundColor: C.bg,
  },
  input: {
    flex: 1, backgroundColor: C.white, borderRadius: 24, borderWidth: 0.5,
    borderColor: C.border, paddingHorizontal: 16, paddingVertical: 8,
    fontFamily: 'Barlow_400Regular', fontSize: 14, color: C.black,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: C.mid,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  sendBtnActive: { backgroundColor: C.red },
  sendIcon: { fontFamily: 'Barlow_600SemiBold', fontSize: 16, color: C.t3 },
  sendIconActive: { color: '#fff' },
});
