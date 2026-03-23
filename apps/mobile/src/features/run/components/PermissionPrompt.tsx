import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

const C = { bg: '#F7F6F4', black: '#0A0A0A', red: '#E8391C', muted: '#6B6B6B', white: '#FFFFFF' };
const FONT = 'Barlow_400Regular';
const FONT_MED = 'Barlow_500Medium';
const FONT_SEMI = 'Barlow_600SemiBold';

interface PermissionPromptProps {
  onRequest: () => void;
}

export default function PermissionPrompt({ onRequest }: PermissionPromptProps) {
  return (
    <View style={ss.container}>
      <Text style={ss.icon}>📍</Text>
      <Text style={ss.title}>Location Required</Text>
      <Text style={ss.body}>
        Runivo needs access to your location to track your run and capture territory.
      </Text>
      <Pressable style={ss.btn} onPress={onRequest}>
        <Text style={ss.btnLabel}>Enable Location</Text>
      </Pressable>
    </View>
  );
}

const ss = StyleSheet.create({
  container: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 32, backgroundColor: C.bg,
  },
  icon:  { fontSize: 48, marginBottom: 16 },
  title: { fontFamily: FONT_SEMI, fontSize: 20, color: C.black, marginBottom: 12, textAlign: 'center' },
  body:  { fontFamily: FONT, fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  btn:   {
    backgroundColor: C.red, borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 28,
  },
  btnLabel: { fontFamily: FONT_MED, fontSize: 14, color: C.white, letterSpacing: 0.3 },
});
