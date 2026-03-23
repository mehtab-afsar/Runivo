import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';

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
  btn:       { backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 0.5, borderColor: '#DDD9D4', paddingHorizontal: 14, paddingVertical: 12 },
  label:     { fontFamily: 'Barlow_400Regular', fontSize: 13, color: '#0A0A0A' },
});
