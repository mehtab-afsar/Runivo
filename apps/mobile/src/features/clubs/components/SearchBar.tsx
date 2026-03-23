import React from 'react';
import { View, TextInput, Pressable, Text, StyleSheet } from 'react-native';

const C = { white: '#FFFFFF', border: '#DDD9D4', black: '#0A0A0A', t3: '#ADADAD' };

interface Props {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder = 'Search...' }: Props) {
  return (
    <View style={s.wrap}>
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.t3}
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChange('')} style={s.clear}>
          <Text style={s.clearText}>✕</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'relative' },
  input: {
    backgroundColor: C.white, borderRadius: 10, borderWidth: 0.5, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: 10, paddingRight: 36,
    fontFamily: 'Barlow_400Regular', fontSize: 14, color: C.black,
  },
  clear: { position: 'absolute', right: 10, top: 0, bottom: 0, justifyContent: 'center' },
  clearText: { fontFamily: 'Barlow_400Regular', fontSize: 13, color: C.t3 },
});
