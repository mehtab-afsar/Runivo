import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useTheme, Fonts, type AppColors } from '@theme';

interface Props {
  onSignUp: () => void;
  onSignIn: () => void;
}

export default function LandingActions({ onSignUp, onSignIn }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);

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

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    wrap: {
      paddingHorizontal: 28,
      paddingBottom: Platform.OS === 'ios' ? 36 : 28,
      gap: 0,
    },
    btnPrimary: {
      backgroundColor: C.alwaysDark, borderRadius: 4,
      paddingVertical: 15, alignItems: 'center', marginBottom: 14,
    },
    btnPrimaryLabel: {
      fontFamily: Fonts.medium, fontSize: 12,
      color: C.alwaysLight, letterSpacing: 1.2,
    },
    btnSecondary: { alignItems: 'center', paddingVertical: 6, marginBottom: 16 },
    btnSecondaryLabel: {
      fontFamily: Fonts.regular, fontSize: 12,
      color: C.t2, letterSpacing: 0.8,
    },
    footer: {
      fontFamily: Fonts.regular, fontSize: 10,
      color: C.t3, textAlign: 'center',
    },
  });
}
