import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay,
  interpolateColor, Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import type { LoginState } from '../hooks/useLogin';
import { signInWithGoogle, signInWithApple } from '../services/socialAuth';

const D = {
  bg:  '#F7F5F2',
  t1:  '#111110',
  t2:  '#7A7873',
  t3:  '#B8B5B0',
  div: '#E2DFDA',
  red: '#C8391A',
} as const;

const EASE = Easing.bezier(0.22, 0.68, 0, 1);

function useEntrance(delay: number) {
  const opacity    = useSharedValue(0);
  const translateY = useSharedValue(14);
  useEffect(() => {
    const cfg = { duration: 550, easing: EASE };
    opacity.value    = withDelay(delay, withTiming(1, cfg));
    translateY.value = withDelay(delay, withTiming(0, cfg));
  }, []);
  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
}

function useFieldBorder() {
  const p = useSharedValue(0);
  const style = useAnimatedStyle(() => ({
    borderBottomColor: interpolateColor(p.value, [0, 1], [D.div, D.t1]),
  }));
  return {
    style,
    onFocus: () => { p.value = withTiming(1, { duration: 200 }); },
    onBlur:  () => { p.value = withTiming(0, { duration: 200 }); },
  };
}

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

function AppleIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24">
      <Path
        fill={D.t1}
        d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.32.07 2.24.74 3.01.75.84-.15 1.64-.84 3.03-.91 1.81.1 3.17.9 3.95 2.35-3.44 2.08-2.64 6.89.88 8.25-.65 1.4-1.5 2.79-2.87 4.44zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
      />
    </Svg>
  );
}

interface Props extends LoginState {
  onGoBack: () => void;
  onGoSignUp: () => void;
}

export default function LoginForm({
  email, password, showPwd, loading, error, resetSent, valid,
  setEmail, setPassword, setShowPwd, handleSignIn, handleForgotPassword,
  onGoBack, onGoSignUp,
}: Props) {
  const insets = useSafeAreaInsets();
  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | null>(null);

  async function handleSocialSignIn(provider: 'google' | 'apple') {
    setSocialLoading(provider);
    try {
      if (provider === 'google') await signInWithGoogle();
      else await signInWithApple();
    } catch {
      Alert.alert('Sign in failed', 'Please try again.');
    } finally {
      setSocialLoading(null);
    }
  }

  const navAnim    = useEntrance(0);
  const heroAnim   = useEntrance(70);
  const h1Anim     = useEntrance(140);
  const formAnim   = useEntrance(210);
  const socialAnim = useEntrance(300);
  const ctaAnim    = useEntrance(370);

  const emailBorder = useFieldBorder();
  const pwBorder    = useFieldBorder();

  return (
    <View style={s.root}>
      <View style={s.topBar} />

      <Animated.View style={[s.nav, navAnim, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={onGoBack} hitSlop={8}>
          <Text style={s.backText}>← Back</Text>
        </Pressable>
        <Text style={s.logoWord}>run<Text style={s.logoRed}>ivo</Text></Text>
      </Animated.View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.hero}>
          <Animated.Text style={[s.eyebrow, heroAnim]}>WELCOME BACK</Animated.Text>
          <Animated.Text style={[s.h1, h1Anim]}>Sign back{'\n'}in.</Animated.Text>
        </View>

        <Animated.View style={formAnim}>
          <View style={s.rule} />

          <Animated.View style={[s.field, emailBorder.style]}>
            <Text style={s.label}>Email</Text>
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={D.t3}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              selectionColor={D.red}
              onFocus={emailBorder.onFocus}
              onBlur={emailBorder.onBlur}
            />
          </Animated.View>

          <Animated.View style={[s.field, pwBorder.style]}>
            <Text style={s.label}>Password</Text>
            <View style={s.inputRow}>
              <TextInput
                style={[s.input, { flex: 1 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={D.t3}
                secureTextEntry={!showPwd}
                returnKeyType="done"
                onSubmitEditing={handleSignIn}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                textContentType="password"
                selectionColor={D.red}
                onFocus={pwBorder.onFocus}
                onBlur={pwBorder.onBlur}
              />
              <Pressable onPress={() => setShowPwd(!showPwd)} hitSlop={8} style={s.toggleBtn}>
                <Text style={s.toggleText}>{showPwd ? 'HIDE' : 'SHOW'}</Text>
              </Pressable>
            </View>
          </Animated.View>

          <Pressable onPress={handleForgotPassword} disabled={loading} style={s.forgotRow}>
            <Text style={s.forgotText}>Forgot password?</Text>
          </Pressable>

          {resetSent
            ? <Text style={s.resetText}>Check your inbox — reset link sent.</Text>
            : error
              ? <Text style={s.errText}>{error}</Text>
              : null}
        </Animated.View>

        <Animated.View style={[s.orRow, socialAnim]}>
          <View style={s.orLine} />
          <Text style={s.orLabel}>or</Text>
          <View style={s.orLine} />
        </Animated.View>

        <Animated.View style={[s.socialRow, socialAnim]}>
          <Pressable style={s.socialBtn} onPress={() => handleSocialSignIn('google')} disabled={!!socialLoading}>
            {socialLoading === 'google'
              ? <ActivityIndicator size="small" color={D.t1} />
              : <GoogleIcon />}
            <Text style={s.socialText}>Google</Text>
          </Pressable>
          <Pressable style={s.socialBtn} onPress={() => handleSocialSignIn('apple')} disabled={!!socialLoading}>
            {socialLoading === 'apple'
              ? <ActivityIndicator size="small" color={D.t1} />
              : <AppleIcon />}
            <Text style={s.socialText}>Apple</Text>
          </Pressable>
        </Animated.View>

        <Animated.View style={[s.ctaWrap, ctaAnim]}>
          <Pressable
            style={[s.ctaBtn, !valid && s.ctaDisabled]}
            onPress={handleSignIn}
            disabled={!valid || loading}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.06)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.ctaLabel}>Sign in  →</Text>}
          </Pressable>

          <Pressable onPress={onGoSignUp} style={s.signupRow}>
            <Text style={s.signupText}>
              No account?{'  '}<Text style={s.signupLink}>Create one</Text>
            </Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: D.bg },
  topBar:  { height: 2, backgroundColor: D.red },

  nav:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 4 },
  backText:{ fontSize: 13, color: D.t2 },
  logoWord:{ fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 15, color: D.t1 },
  logoRed: { color: D.red },

  scroll:  { paddingHorizontal: 24 },
  hero:    { paddingTop: 52 },
  eyebrow: { fontWeight: '500', fontSize: 10, color: D.red, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 14 },
  h1:      { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 46, color: D.t1, lineHeight: 46, marginBottom: 14 },

  rule:    { height: 1, backgroundColor: D.div, marginTop: 44, marginBottom: 0 },

  field:   { borderBottomWidth: 0.5, paddingTop: 24, paddingBottom: 10 },
  label:   { fontWeight: '500', fontSize: 10, color: D.t3, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  inputRow:{ flexDirection: 'row', alignItems: 'center' },
  input:   { fontSize: 16, color: D.t1, paddingVertical: 0, flex: 1 },
  toggleBtn: { paddingLeft: 12 },
  toggleText:{ fontWeight: '500', fontSize: 11, color: D.t2, letterSpacing: 0.5 },

  forgotRow: { alignSelf: 'flex-end', paddingTop: 14 },
  forgotText:{ fontSize: 12, color: D.t2, textDecorationLine: 'underline' },

  errText:   { fontSize: 11, color: D.red, marginTop: 10 },
  resetText: { fontSize: 11, color: '#2D7D46', marginTop: 10 },

  orRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 28, marginBottom: 16 },
  orLine:  { flex: 1, height: 1, backgroundColor: D.div },
  orLabel: { fontSize: 11, color: D.t3, letterSpacing: 0.5 },

  socialRow: { flexDirection: 'row', gap: 12 },
  socialBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 0.5, borderColor: D.div, borderRadius: 8, paddingVertical: 13 },
  socialText:{ fontSize: 13, color: D.t1 },

  ctaWrap:    { marginTop: 20 },
  ctaBtn:     { backgroundColor: D.t1, borderRadius: 10, paddingVertical: 17, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  ctaDisabled:{ backgroundColor: '#555' },
  ctaLabel:   { fontWeight: '500', fontSize: 13, color: '#fff', letterSpacing: 0.8 },

  signupRow:  { marginTop: 20, alignItems: 'center' },
  signupText: { fontSize: 13, color: D.t2 },
  signupLink: { fontWeight: '500', fontSize: 13, color: D.t1, textDecorationLine: 'underline' },
});
