import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MapPin } from 'phosphor-react-native';
import { useTheme, Type, Fonts, type AppColors } from '@theme';

interface PermissionPromptProps {
  onRequest: () => void;
}

export default function PermissionPrompt({ onRequest }: PermissionPromptProps) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  return (
    <View style={ss.container}>
      <View style={ss.iconWrap}>
        <MapPin size={32} color={C.red} weight="light" />
      </View>
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

function mkStyles(C: AppColors) { return StyleSheet.create({
  container: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 32, backgroundColor: C.bg,
  },
  iconWrap:  { width: 72, height: 72, borderRadius: 36, backgroundColor: C.accentMuted, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title:     { ...Type.title, color: C.black, marginBottom: 12, textAlign: 'center' },
  body:      { fontFamily: Fonts.regular, fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  btn:       { backgroundColor: C.red, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 28 },
  btnLabel:  { fontFamily: Fonts.medium, fontSize: 14, color: C.white, letterSpacing: 0.3 },
}); }
