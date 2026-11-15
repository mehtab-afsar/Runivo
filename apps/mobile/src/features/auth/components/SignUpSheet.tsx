/**
 * Welcome → Get started (mock "Sign up sheet"): a bottom sheet over the
 * welcome screen with Apple, Google and email. Email opens the full form.
 */
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, Platform, ActivityIndicator, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import * as AppleAuthentication from 'expo-apple-authentication';
import { X, EnvelopeSimple } from 'phosphor-react-native';
import { Colors, Fonts } from '@theme';
import { signInWithGoogle, signInWithApple } from '../services/socialAuth';

function GoogleIcon() {
  return (
    <Svg width={15} height={15} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </Svg>
  );
}

function AppleIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.32.07 2.24.74 3.01.75.84-.15 1.64-.84 3.03-.91 1.81.1 3.17.9 3.95 2.35-3.44 2.08-2.64 6.89.88 8.25-.65 1.4-1.5 2.79-2.87 4.44zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
      />
    </Svg>
  );
}

export function SignUpSheet({ visible, onClose, onEmail, onSignIn }: {
  visible: boolean; onClose: () => void; onEmail: () => void; onSignIn: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState<'google' | 'apple' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const social = async (p: 'google' | 'apple') => {
    setBusy(p); setError(null);
    try { if (p === 'google') await signInWithGoogle(); else await signInWithApple(); }
    catch { setError("That didn't work. Please try again."); }
    finally { setBusy(null); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={[s.sheet, { paddingBottom: insets.bottom + 18 }]} accessibilityViewIsModal>
        <View style={s.grab} />
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
          <Text style={s.link} onPress={() => Linking.openURL('https://runivo.app/terms')}>Terms</Text> and{' '}
          <Text style={s.link} onPress={() => Linking.openURL('https://runivo.app/privacy')}>Privacy Policy</Text>.
        </Text>
        <Pressable onPress={onSignIn} accessibilityRole="button" hitSlop={8}>
          <Text style={s.signIn}>Have an account? <Text style={{ fontFamily: Fonts.semiBold }}>Sign in</Text></Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim:  { flex: 1, backgroundColor: 'rgba(23,24,26,0.42)' },
  sheet:  { backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 10, paddingHorizontal: 22, gap: 12 },
  grab:   { width: 40, height: 5, borderRadius: 3, backgroundColor: '#DADDD6', alignSelf: 'center' },
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
