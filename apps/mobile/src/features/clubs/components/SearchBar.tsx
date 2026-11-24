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
        <Pressable onPress={() => onChange('')} style={s.clear} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
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
      backgroundColor: C.card, borderRadius: 999, borderWidth: 1, borderColor: C.border,
      height: 44, paddingHorizontal: 18, paddingRight: 40,
      fontFamily: Fonts.regular, fontSize: 14, color: C.t1,
    },
    clear: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },
    clearText: { fontFamily: Fonts.regular, fontSize: 13, color: C.t3 },
  });
}
