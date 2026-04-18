import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';

interface Props {
  onSignUp: () => void;
  onSignIn: () => void;
}

export default function LandingActions({ onSignUp, onSignIn }: Props) {
  return (
    <View style={s.wrap}>
      <Pressable style={s.btnPrimary} onPress={onSignUp}>
        <Text style={s.btnPrimaryLabel}>CREATE ACCOUNT</Text>
      </Pressable>
      <Pressable style={s.btnSecondary} onPress={onSignIn}>
        <Text style={s.btnSecondaryLabel}>SIGN IN</Text>
      </Pressable>
      <Text style={s.footer}>Free to start · No credit card required</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === 'ios' ? 36 : 28,
    gap: 0,
  },
  btnPrimary: {
    backgroundColor: '#0A0A0A', borderRadius: 4,
    paddingVertical: 15, alignItems: 'center', marginBottom: 14,
  },
  btnPrimaryLabel: {
    fontFamily: 'Barlow_500Medium', fontSize: 12,
    color: '#FFFFFF', letterSpacing: 1.2,
  },
  btnSecondary: { alignItems: 'center', paddingVertical: 6, marginBottom: 16 },
  btnSecondaryLabel: {
    fontFamily: 'Barlow_400Regular', fontSize: 12,
    color: '#6B6B6B', letterSpacing: 0.8,
  },
  footer: {
    fontFamily: 'Barlow_300Light', fontSize: 10,
    color: '#ADADAD', textAlign: 'center',
  },
});
