import { RunivoMark } from '@mobile/shared/components/RunivoMark';
import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay,
  interpolateColor, Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import * as AppleAuthentication from 'expo-apple-authentication';
import type { LoginState } from '../hooks/useLogin';
import { signInWithGoogle, signInWithApple } from '../services/socialAuth';
import { ArrowLeft } from 'lucide-react-native';
import { useTheme, useIsDark, Fonts, Type, Spacing, type AppColors } from '@theme';

const EASE = Easing.bezier(0.22, 0.68, 0, 1);

function useEntrance(delay: number) {
  const opacity    = useSharedValue(0);
  const translateY = useSharedValue(14);
  useEffect(() => {
    const cfg = { duration: 550, easing: EASE };
    opacity.value    = withDelay(delay, withTiming(1, cfg));
    translateY.value = withDelay(delay, withTiming(0, cfg));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
}

function useFieldBorder(C: AppColors) {
  const p = useSharedValue(0);
  const style = useAnimatedStyle(() => ({
    borderColor: interpolateColor(p.value, [0, 1], [C.border, C.t1]),
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

interface Props extends LoginState {
  onGoBack: () => void;
  onGoSignUp: () => void;
}

export default function LoginForm({
  email, password, showPwd, loading, error, resetSent, valid,
  lockoutSeconds, resetCooldownSeconds,
  setEmail, setPassword, setShowPwd, handleSignIn, handleForgotPassword,
  onGoBack, onGoSignUp,
}: Props) {
  const C = useTheme();
  const isDark = useIsDark();
  const s = useMemo(() => mkStyles(C), [C]);
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

  const emailBorder = useFieldBorder(C);
  const pwBorder    = useFieldBorder(C);

  return (
    <View style={s.root}>

      <Animated.View style={[s.nav, navAnim, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={onGoBack} hitSlop={10} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Back">
          <ArrowLeft size={16} color={C.t1} strokeWidth={1.8} />
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} accessibilityRole="header" accessibilityLabel="Runivo"><RunivoMark size={22} /><Text style={s.logoWord}>runivo</Text></View>
        <View style={s.backSpacer} />
      </Animated.View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.hero}>
          <Animated.Text style={[s.eyebrow, heroAnim]}>Welcome back</Animated.Text>
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
              placeholderTextColor={C.t3}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              selectionColor={C.red}
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
                placeholderTextColor={C.t3}
                secureTextEntry={!showPwd}
                returnKeyType="done"
                onSubmitEditing={handleSignIn}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                textContentType="password"
                selectionColor={C.red}
                onFocus={pwBorder.onFocus}
                onBlur={pwBorder.onBlur}
              />
              <Pressable onPress={() => setShowPwd(!showPwd)} hitSlop={8} style={s.toggleBtn}>
                <Text style={s.toggleText}>{showPwd ? 'Hide' : 'Show'}</Text>
              </Pressable>
            </View>
          </Animated.View>

          <Pressable
            onPress={handleForgotPassword}
            disabled={loading || resetCooldownSeconds > 0}
            style={s.forgotRow}
          >
            <Text style={s.forgotText}>
              {resetCooldownSeconds > 0
                ? `Resend in ${resetCooldownSeconds}s`
                : 'Forgot password?'}
            </Text>
          </Pressable>

          {lockoutSeconds > 0
            ? <Text style={s.errText}>Too many attempts. Try again in {lockoutSeconds}s.</Text>
            : resetSent
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
              ? <ActivityIndicator size="small" color={C.t1} />
              : <GoogleIcon />}
            <Text style={s.socialText}>Google</Text>
          </Pressable>
          {Platform.OS === 'ios' ? (
            // Apple's App Review Guidelines require the native, Apple-rendered
            // button for Sign in with Apple — not a custom-styled lookalike.
            <View style={[s.socialBtn, s.appleNativeBtnWrap, socialLoading && { opacity: 0.5 }]} pointerEvents={socialLoading ? 'none' : 'auto'}>
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={isDark ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={24}
                style={s.appleNativeBtn}
                onPress={() => handleSocialSignIn('apple')}
              />
            </View>
          ) : (
            <Pressable style={s.socialBtn} onPress={() => handleSocialSignIn('apple')} disabled={!!socialLoading}>
              {socialLoading === 'apple'
                ? <ActivityIndicator size="small" color={C.t1} />
                : <AppleIcon color={C.t1} />}
              <Text style={s.socialText}>Apple</Text>
            </Pressable>
          )}
        </Animated.View>

        <Animated.View style={[s.ctaWrap, ctaAnim]}>
          <Pressable
            style={[s.ctaBtn, (!valid || lockoutSeconds > 0) && s.ctaDisabled]}
            onPress={handleSignIn}
            disabled={!valid || loading || lockoutSeconds > 0}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.06)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            {loading
              ? <ActivityIndicator color={C.alwaysLight} size="small" />
              : <Text style={s.ctaLabel}>Sign in</Text>}
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

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:    { flex: 1, backgroundColor: C.bg },
    topBar:  { height: 0 },

    nav:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 8 },
    backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
    backSpacer: { width: 40 },
    backText:{ fontFamily: Fonts.medium, fontSize: 14, color: C.t1 },
    logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    logoWord:{ fontFamily: Fonts.wordmark, fontSize: 22, letterSpacing: -0.4, color: C.t1 },

    scroll:  { paddingHorizontal: Spacing.gutter + 4 },
    hero:    { paddingTop: 36 },
    eyebrow: { ...Type.label, color: C.red, marginBottom: 10 },
    h1:      { fontFamily: Fonts.hero, fontSize: 54, lineHeight: 50, textTransform: 'uppercase', letterSpacing: -0.3, color: C.t1, marginBottom: 12 },

    rule:    { height: 0, marginTop: 24 },

    field:   { borderWidth: 1, borderColor: C.border, borderRadius: Spacing.radius.md + 2, backgroundColor: C.card, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, marginTop: 12 },
    label:   { fontFamily: Fonts.medium, fontSize: 12, color: C.t2, marginBottom: 6 },
    inputRow:{ flexDirection: 'row', alignItems: 'center' },
    input:   { fontFamily: Fonts.regular, fontSize: 16, color: C.t1, paddingVertical: 0, flex: 1 },
    toggleBtn: { paddingLeft: 12 },
    toggleText:{ fontFamily: Fonts.semiBold, fontSize: 12, color: C.t2 },

    forgotRow: { alignSelf: 'flex-end', paddingTop: 14 },
    forgotText:{ fontFamily: Fonts.medium, fontSize: 13, color: C.t2 },

    errText:   { ...Type.caption, color: C.red, marginTop: 10 },
    resetText: { ...Type.caption, color: C.green, marginTop: 10 },

    orRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 28, marginBottom: 16 },
    orLine:  { flex: 1, height: 1, backgroundColor: C.border },
    orLabel: { fontFamily: Fonts.medium, fontSize: 12, color: C.t3 },

    socialRow: { flexDirection: 'row', gap: 12 },
    socialBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, borderRadius: 999, height: 48 },
    socialText:{ fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
    appleNativeBtnWrap: { flex: 1, height: 48, borderRadius: 999, overflow: 'hidden' },
    appleNativeBtn: { width: '100%', height: 48 },

    // Fixed dark/light pair — the primary CTA is a bold "filled" pill regardless of
    // theme, not the adapting ink token (which would invert to near-white in dark
    // mode and render an invisible white-on-white button).
    ctaWrap:    { marginTop: 24 },
    ctaBtn:     { backgroundColor: C.red, borderRadius: 999, height: Spacing.height.buttonPrimary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    ctaDisabled:{ opacity: 0.45 },
    ctaLabel:   { ...Type.button, color: C.alwaysLight },

    signupRow:  { marginTop: 20, alignItems: 'center' },
    signupText: { fontSize: 13, color: C.t2 },
    signupLink: { fontFamily: Fonts.medium, fontSize: 13, color: C.t1, textDecorationLine: 'underline' },
  });
}
