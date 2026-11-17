import React, { useEffect, useState, useMemo, useRef } from 'react';
import { GoogleIcon, AppleIcon } from '@mobile/shared/components/BrandIcons';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet,
  ActivityIndicator, Platform,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay,
  interpolateColor, Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as AppleAuthentication from 'expo-apple-authentication';
import type { LoginState } from '../hooks/useLogin';
import { signInWithGoogle, signInWithApple } from '../services/socialAuth';
import { ArrowLeft } from '@mobile/shared/icons/lucideCompat';
import { Eye, EyeSlash } from 'phosphor-react-native';
import { useTheme, useIsDark, Fonts, Type, type AppColors } from '@theme';

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



interface Props extends LoginState {
  onGoBack: () => void;
  /** Opens the "Reset your password" page (mock AuthReset). */
  onForgot?: () => void;
  onGoSignUp: () => void;
}

export default function LoginForm({
  email, password, showPwd, loading, error, resetSent, valid,
  lockoutSeconds, resetCooldownSeconds,
  setEmail, setPassword, setShowPwd, handleSignIn, handleForgotPassword,
  onGoBack, onGoSignUp, onForgot,
}: Props) {
  const C = useTheme();
  const isDark = useIsDark();
  const s = useMemo(() => mkStyles(C), [C]);
  const pwRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();
  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | null>(null);
  const [socialError, setSocialError] = useState<string | null>(null);

  async function handleSocialSignIn(provider: 'google' | 'apple') {
    setSocialLoading(provider);
    setSocialError(null);
    try {
      if (provider === 'google') await signInWithGoogle();
      else await signInWithApple();
    } catch {
      // Inline, like every other sign-in error here, instead of a blocking dialog.
      setSocialError('Sign in failed. Please try again.');
    } finally {
      setSocialLoading(null);
    }
  }

  const navAnim    = useEntrance(0);
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

      </Animated.View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.hero}>
          <Animated.Text style={[s.h1, h1Anim]} accessibilityRole="header">Welcome <Text style={{ color: C.red }}>back.</Text></Animated.Text>
        </View>

        <Animated.View style={[s.socialRow, socialAnim]}>
          {Platform.OS === 'ios' ? (
            // Apple's App Review Guidelines require the native, Apple-rendered
            // button for Sign in with Apple — not a custom-styled lookalike.
            <View style={[s.socialBtn, s.appleNativeBtnWrap, socialLoading && { opacity: 0.5 }]} pointerEvents={socialLoading ? 'none' : 'auto'}>
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={isDark ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={27}
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
          <Pressable style={s.socialBtn} onPress={() => handleSocialSignIn('google')} disabled={!!socialLoading}>
            {socialLoading === 'google'
              ? <ActivityIndicator size="small" color={C.t1} />
              : <GoogleIcon />}
            <Text style={s.socialText}>Google</Text>
          </Pressable>
        </Animated.View>

        <Animated.View style={[s.orRow, socialAnim]}>
          <View style={s.orLine} />
          <Text style={s.orLabel}>or</Text>
          <View style={s.orLine} />
        </Animated.View>

        <Animated.View style={formAnim}>
          <View style={s.rule} />

          <Text style={s.label}>Email</Text>
          <Animated.View style={[s.field, emailBorder.style]}>
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={C.t3}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => pwRef.current?.focus()}
              blurOnSubmit={false}
              accessibilityLabel="Email"
              selectionColor={C.red}
              onFocus={emailBorder.onFocus}
              onBlur={emailBorder.onBlur}
            />
          </Animated.View>

          <Text style={[s.label, { marginTop: 16 }]}>Password</Text>
          <Animated.View style={[s.field, pwBorder.style]}>
            <View style={s.inputRow}>
              <TextInput
                ref={pwRef}
                style={[s.input, { flex: 1 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="Your password"
                placeholderTextColor={C.t3}
                secureTextEntry={!showPwd}
                returnKeyType="done"
                onSubmitEditing={handleSignIn}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                textContentType="password"
                autoComplete="current-password"
                accessibilityLabel="Password"
                selectionColor={C.red}
                onFocus={pwBorder.onFocus}
                onBlur={pwBorder.onBlur}
              />
              <Pressable onPress={() => setShowPwd(!showPwd)} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }} style={s.toggleBtn} accessibilityRole="button" accessibilityLabel={showPwd ? 'Hide password' : 'Show password'}>
                {showPwd ? <EyeSlash size={20} color={C.t2} /> : <Eye size={20} color={C.t2} />}
              </Pressable>
            </View>
          </Animated.View>

          <Pressable
            onPress={onForgot ?? handleForgotPassword}
            disabled={loading || resetCooldownSeconds > 0}
            style={s.forgotRow}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
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
              : (error || socialError)
                ? <Text style={s.errText} accessibilityRole="alert">{error || socialError}</Text>
                : null}
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
              New to Runivo? <Text style={s.signupLink}>Create an account</Text>
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

    nav:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8 },
    backBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
    backSpacer: { width: 40 },
    backText:{ fontFamily: Fonts.medium, fontSize: 14, color: C.t1 },
    logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    logoWord:{ fontFamily: Fonts.wordmark, fontSize: 22, letterSpacing: -0.4, color: C.t1 },

    scroll:  { paddingHorizontal: 22, flexGrow: 1 },
    hero:    { paddingTop: 28 },
    eyebrow: { ...Type.label, color: C.red, marginBottom: 10 },
    h1:      { fontFamily: Fonts.semiBold, fontSize: 40, lineHeight: 44, letterSpacing: -1.2, color: C.t1, marginBottom: 22 },

    rule:    { height: 0, marginTop: 24 },

    field:   { borderWidth: 1.5, borderColor: C.border, borderRadius: 18, backgroundColor: C.card, paddingHorizontal: 18, height: 54, justifyContent: 'center' },
    label:   { fontFamily: Fonts.medium, fontSize: 14, color: C.t1, marginBottom: 8, marginTop: 4 },
    inputRow:{ flexDirection: 'row', alignItems: 'center' },
    input:   { fontFamily: Fonts.regular, fontSize: 16, color: C.t1, paddingVertical: 0, flex: 1 },
    toggleBtn: { paddingLeft: 12 },
    toggleText:{ fontFamily: Fonts.semiBold, fontSize: 12, color: C.t2 },

    forgotRow: { alignSelf: 'flex-end', paddingTop: 14 },
    forgotText:{ fontFamily: Fonts.medium, fontSize: 14, color: C.t1, textDecorationLine: 'underline' },

    errText:   { ...Type.caption, color: C.danger, marginTop: 10 },
    resetText: { ...Type.caption, color: C.green, marginTop: 10 },

    orRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, marginBottom: 2 },
    orLine:  { flex: 1, height: 1, backgroundColor: C.border },
    orLabel: { fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },

    socialRow: { flexDirection: 'row', gap: 10 },
    socialBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.card, borderRadius: 27, height: 54 },
    socialText:{ fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1 },
    appleNativeBtnWrap: { flex: 1, height: 54, borderRadius: 27, overflow: 'hidden' },
    appleNativeBtn: { width: '100%', height: 54 },

    // Fixed dark/light pair — the primary CTA is a bold "filled" pill regardless of
    // theme, not the adapting ink token (which would invert to near-white in dark
    // mode and render an invisible white-on-white button).
    ctaWrap:    { marginTop: 'auto', paddingTop: 28 },
    ctaBtn:     { backgroundColor: C.alwaysDark, borderRadius: 28, height: 56, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    ctaDisabled:{ opacity: 0.45 },
    ctaLabel:   { ...Type.button, color: C.alwaysLight },

    signupRow:  { marginTop: 20, alignItems: 'center' },
    signupText: { fontFamily: Fonts.regular, fontSize: 15, color: C.t1 },
    signupLink: { fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1 },
  });
}
