import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';

interface Props {
  onSignUp: () => void;
  onSignIn: () => void;
}

export default function LandingActions({ onSignUp, onSignIn }: Props) {
  return (
    <View style={s.ctas}>
      <Pressable style={[s.btn, s.btnBlack]} onPress={onSignUp}>
        <Text style={s.btnLabelWhite}>Create account</Text>
      </Pressable>
      <Pressable style={[s.btn, s.btnOutline]} onPress={onSignIn}>
        <Text style={s.btnLabelBlack}>I already have an account</Text>
      </Pressable>
      <Text style={s.legal}>
        By continuing you agree to our Terms of Service and Privacy Policy.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  ctas: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 20 : 28,
    gap: 8, zIndex: 2,
  },
  btn: { paddingVertical: 13, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  btnBlack: { backgroundColor: '#0A0A0A' },
  btnOutline: { borderWidth: 0.5, borderColor: '#DDD9D4' },
  btnLabelWhite: {
    fontFamily: 'Barlow_500Medium', fontSize: 12, color: '#FFFFFF',
    textTransform: 'uppercase', letterSpacing: 1,
  },
  btnLabelBlack: {
    fontFamily: 'Barlow_500Medium', fontSize: 12, color: '#0A0A0A',
    textTransform: 'uppercase', letterSpacing: 1,
  },
  legal: {
    fontFamily: 'Barlow_300Light', fontSize: 8, color: '#ADADAD',
    textAlign: 'center', marginTop: 4, lineHeight: 13,
  },
});
