import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '@theme';

interface Props {
  label:       string;
  description: string;
  icon:        string;
  onPress:     () => void;
}

export function CoachCapabilityCard({ label, description, icon, onPress }: Props) {
  const C = useTheme();
  return (
    <Pressable
      style={({ pressed }) => [ss.card, { borderBottomColor: C.border }, pressed && ss.pressed]}
      onPress={onPress}
    >
      <Text style={ss.icon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[ss.label, { color: C.black }]}>{label}</Text>
        <Text style={[ss.desc, { color: C.t3 }]}>{description}</Text>
      </View>
    </Pressable>
  );
}

const ss = StyleSheet.create({
  card:    { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 13, borderBottomWidth: 0.5 },
  pressed: { backgroundColor: 'rgba(10,10,10,0.03)' },
  icon:    { fontSize: 20, width: 30, textAlign: 'center' },
  label:   { fontFamily: 'DMSans_500Medium', fontSize: 14 },
  desc:    { fontFamily: 'DMSans_300Light', fontSize: 11, marginTop: 2 },
});
