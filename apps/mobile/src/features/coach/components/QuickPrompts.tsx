import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Colors, Fonts } from '@theme';

interface Props {
  prompts:  string[];
  onSelect: (prompt: string) => void;
}

export function QuickPrompts({ prompts, onSelect }: Props) {
  return (
    <View style={ss.container}>
      {prompts.map(p => (
        <Pressable key={p} style={ss.btn} onPress={() => onSelect(p)}>
          <Text style={ss.label}>{p}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const ss = StyleSheet.create({
  container: { paddingHorizontal: 16, gap: 8 },
  btn:       { backgroundColor: Colors.white, borderRadius: 10, borderWidth: 0.5, borderColor: '#DDD9D4', paddingHorizontal: 14, paddingVertical: 12 },
  label:     { fontFamily: Fonts.regular, fontSize: 13, color: Colors.alwaysDark },
});
