/**
 * Welcome → Get started (mock "Sign up sheet"): a bottom sheet over the
 * welcome screen with Apple, Google and email. Email opens the full form.
 */
import React, { useState } from 'react';
import { GoogleIcon, AppleIcon } from '@mobile/shared/components/BrandIcons';
import { View, Text, Pressable, StyleSheet, Platform, ActivityIndicator, Linking } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { X, EnvelopeSimple } from 'phosphor-react-native';
import { Colors, Fonts } from '@theme';
import { signInWithGoogle, signInWithApple } from '../services/socialAuth';
import { ModalSheet } from '@mobile/shared/components/ModalSheet';



export function SignUpSheet({ visible, onClose, onEmail, onSignIn }: {
  visible: boolean; onClose: () => void; onEmail: () => void; onSignIn: () => void;
}) {
  const [busy, setBusy] = useState<'google' | 'apple' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const social = async (p: 'google' | 'apple') => {
    setBusy(p); setError(null);
    try { if (p === 'google') await signInWithGoogle(); else await signInWithApple(); }
    catch { setError("That didn't work. Please try again."); }
    finally { setBusy(null); }
  };

  return (
    <ModalSheet visible={visible} onClose={onClose}>
      <View style={s.head}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={s.title} accessibilityRole="header">Create your account</Text>
          <Text style={s.sub}>Takes a minute. Your first zone is waiting.</Text>
        </View>
        <Pressable style={s.close} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
          <X size={16} color={Colors.t1} weight="bold" />
        </Pressable>
      </View>

      <View style={{ gap: 10, marginTop: 6 }}>
        {Platform.OS === 'ios' ? (
          <View style={[s.btnWrap, busy && { opacity: 0.5 }]} pointerEvents={busy ? 'none' : 'auto'}>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={28}
              style={{ width: '100%', height: 56 }}
              onPress={() => social('apple')}
            />
          </View>
        ) : (
          <Pressable style={[s.btn, s.btnDark]} onPress={() => social('apple')} disabled={!!busy} accessibilityRole="button">
            {busy === 'apple' ? <ActivityIndicator color="#FFFFFF" /> : <AppleIcon color="#FFFFFF" />}
            <Text style={[s.btnTxt, { color: '#FFFFFF' }]}>Continue with Apple</Text>
          </Pressable>
        )}
        <Pressable style={[s.btn, s.btnLine]} onPress={() => social('google')} disabled={!!busy} accessibilityRole="button">
          {busy === 'google' ? <ActivityIndicator color={Colors.t1} /> : <GoogleIcon />}
          <Text style={s.btnTxt}>Continue with Google</Text>
        </Pressable>
        <Pressable style={[s.btn, s.btnLine]} onPress={onEmail} disabled={!!busy} accessibilityRole="button">
          <EnvelopeSimple size={18} color={Colors.t1} weight="bold" />
          <Text style={s.btnTxt}>Continue with email</Text>
        </Pressable>
      </View>
      {!!error && <Text style={s.err} accessibilityRole="alert">{error}</Text>}

      <Text style={s.legal}>
        By continuing you agree to the{' '}
        <Text style={s.link} onPress={() => Linking.openURL('https://runivo.in/terms')}>Terms</Text> and{' '}
        <Text style={s.link} onPress={() => Linking.openURL('https://runivo.in/privacy')}>Privacy Policy</Text>.
      </Text>
      <Pressable onPress={onSignIn} accessibilityRole="button" hitSlop={8}>
        <Text style={s.signIn}>Have an account? <Text style={{ fontFamily: Fonts.semiBold }}>Sign in</Text></Text>
      </Pressable>
    </ModalSheet>
  );
}

const s = StyleSheet.create({
  head:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 6 },
  title:  { fontFamily: Fonts.semiBold, fontSize: 26, letterSpacing: -0.6, color: '#17181A' },
  sub:    { fontFamily: Fonts.regular, fontSize: 15, color: '#6B6F69' },
  close:  { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F4F5F1', alignItems: 'center', justifyContent: 'center' },
  btnWrap:{ height: 56, borderRadius: 28, overflow: 'hidden' },
  btn:    { height: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  btnDark:{ backgroundColor: '#17181A' },
  btnLine:{ backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E2E4DE' },
  btnTxt: { fontFamily: Fonts.semiBold, fontSize: 16, color: '#17181A' },
  err:    { fontFamily: Fonts.medium, fontSize: 13, color: '#C9372C', textAlign: 'center' },
  legal:  { fontFamily: Fonts.regular, fontSize: 12, lineHeight: 18, color: '#6B6F69', textAlign: 'center', paddingHorizontal: 8, paddingTop: 2 },
  link:   { textDecorationLine: 'underline', color: '#17181A' },
  signIn: { fontFamily: Fonts.regular, fontSize: 15, color: '#17181A', textAlign: 'center' },
});
