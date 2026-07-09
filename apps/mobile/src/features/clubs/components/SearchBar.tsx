import React, { useMemo } from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { X } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';

interface Props {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder = 'Search...' }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
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
          <X size={14} color={C.t3} weight="regular" />
        </Pressable>
      )}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    wrap: { position: 'relative' },
    input: {
      backgroundColor: C.card, borderRadius: 10, borderWidth: 0.5, borderColor: C.border,
      paddingHorizontal: 14, paddingVertical: 10, paddingRight: 36,
      fontFamily: Fonts.regular, fontSize: 14, color: C.black,
    },
    clear: { position: 'absolute', right: 10, top: 0, bottom: 0, justifyContent: 'center' },
    clearText: { fontFamily: Fonts.regular, fontSize: 13, color: C.t3 },
  });
}
