import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { Colors } from '@theme';

const C = Colors;
const FONT = 'Barlow_400Regular';
const FONT_MED = 'Barlow_500Medium';
const FONT_SEMI = 'Barlow_600SemiBold';

interface PermissionPromptProps {
  onRequest: () => void;
}

export default function PermissionPrompt({ onRequest }: PermissionPromptProps) {
  return (
    <View style={ss.container}>
      <View style={ss.iconWrap}>
        <MapPin size={32} color={C.red} strokeWidth={1.5} />
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

const ss = StyleSheet.create({
  container: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 32, backgroundColor: C.bg,
  },
  iconWrap:  { width: 72, height: 72, borderRadius: 36, backgroundColor: '#FDE8E4', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title:     { fontFamily: FONT_SEMI, fontSize: 20, color: C.black, marginBottom: 12, textAlign: 'center' },
  body:      { fontFamily: FONT, fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  btn:       { backgroundColor: C.red, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 28 },
  btnLabel:  { fontFamily: FONT_MED, fontSize: 14, color: C.white, letterSpacing: 0.3 },
});
