import React, { useEffect, useMemo, useRef } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet,
  ActivityIndicator, Linking,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay,
  interpolateColor, Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import type { SignUpState } from '../hooks/useSignUp';
import { ArrowLeft } from '@mobile/shared/icons/lucideCompat';
import { useTheme, Fonts, Type, type AppColors } from '@theme';

const EASE = Easing.bezier(0.22, 0.68, 0, 1);

// ── Entrance animation ────────────────────────────────────────────────────────
function useEntrance(delay: number) {
  const opacity     = useSharedValue(0);
  const translateY  = useSharedValue(14);

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

// ── Animated field border ─────────────────────────────────────────────────────
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

// ── Google icon ───────────────────────────────────────────────────────────────

// ── Apple icon ────────────────────────────────────────────────────────────────

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props extends Omit<SignUpState, 'emailExists' | 'rateLimitSeconds'> {
  onGoBack: () => void;
  onGoLogin: () => void;
  emailExists?: boolean;
  rateLimitSeconds?: number;
}

export default function SignUpForm({
  username, email, pwd, showPwd, loading, error, valid,
  emailExists = false, rateLimitSeconds = 0, needsEmailConfirmation,
  setUsername, setEmail, setPwd, setShowPwd, handleSignUp,
  onGoBack, onGoLogin,
}: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const emailRef = useRef<TextInput>(null);
  const pwdRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();

  // Staggered entrance — 70ms between groups
  const navAnim     = useEntrance(0);
  const h1Anim      = useEntrance(140);
  const formAnim    = useEntrance(280);
  const ctaAnim     = useEntrance(420);

  // Per-field animated border
  const userBorder  = useFieldBorder(C);
  const emailBorder = useFieldBorder(C);
  const pwBorder    = useFieldBorder(C);

  const countOver = username.length > 16;

  return (
    <View style={s.root}>

      {/* Nav — offset below status bar */}
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
        {/* Hero */}
        <View style={s.hero}>
          <Animated.Text style={[s.h1, h1Anim]} accessibilityRole="header">Create your account</Animated.Text>
        </View>

        {/* Rule + form */}
        <Animated.View style={formAnim}>
          <View style={s.rule} />

          {/* Username */}
          <Animated.View style={[s.field, userBorder.style]}>
            <View style={s.labelRow}>
              <Text style={s.label}>Username</Text>
              <Text style={[s.counter, countOver && s.counterOver]}>
                {username.length} / 20
              </Text>
            </View>
            <TextInput
              style={s.input}
              value={username}
              onChangeText={v => setUsername(v.slice(0, 20))}
              placeholder="e.g. marcus_runs"
              placeholderTextColor={C.t3}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              autoComplete="username-new"
              textContentType="username"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              blurOnSubmit={false}
              accessibilityLabel="Username"
              selectionColor={C.red}
              onFocus={userBorder.onFocus}
              onBlur={userBorder.onBlur}
            />
          </Animated.View>

          {/* Email */}
          <Animated.View style={[s.field, emailBorder.style]}>
            <View style={s.labelRow}>
              <Text style={s.label}>Email</Text>
            </View>
            <TextInput
              ref={emailRef}
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
              onSubmitEditing={() => pwdRef.current?.focus()}
              blurOnSubmit={false}
              accessibilityLabel="Email"
              selectionColor={C.red}
              onFocus={emailBorder.onFocus}
              onBlur={emailBorder.onBlur}
            />
          </Animated.View>

          {/* Password */}
          <Animated.View style={[s.field, pwBorder.style]}>
            <View style={s.labelRow}>
              <Text style={s.label}>Password</Text>
            </View>
            <View style={s.inputRow}>
              <TextInput
                ref={pwdRef}
                style={[s.input, { flex: 1 }]}
                value={pwd}
                onChangeText={setPwd}
                placeholder="Min. 8 characters"
                placeholderTextColor={C.t3}
                secureTextEntry={!showPwd}
                returnKeyType="done"
                onSubmitEditing={handleSignUp}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                textContentType="newPassword"
                autoComplete="new-password"
                accessibilityLabel="Password"
                selectionColor={C.red}
                onFocus={pwBorder.onFocus}
                onBlur={pwBorder.onBlur}
              />
              <Pressable onPress={() => setShowPwd(!showPwd)} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }} style={s.toggleBtn} accessibilityRole="button" accessibilityLabel={showPwd ? 'Hide password' : 'Show password'}>
                <Text style={s.toggleText}>{showPwd ? 'Hide' : 'Show'}</Text>
              </Pressable>
            </View>
          </Animated.View>

          {pwd.length > 0 && (() => {
            const score = [pwd.length >= 12, /[0-9]/.test(pwd), /[A-Z]/.test(pwd) && /[a-z]/.test(pwd), /[^A-Za-z0-9]/.test(pwd)].filter(Boolean).length;
            const hint = score >= 4 ? 'Strong' : score === 3 ? 'Strong · add a symbol to max it out' : score === 2 ? 'Okay · longer is better' : 'Weak · use 12 characters or more';
            return (
              <View style={{ gap: 6, marginTop: 10 }}>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {[0, 1, 2, 3].map(i => <View key={i} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: i < score ? C.brandGreen : '#DDE0D8' }} />)}
                </View>
                <Text style={{ fontFamily: Fonts.regular, fontSize: 13, color: score >= 3 ? C.green : C.t2 }}>{hint}</Text>
              </View>
            );
          })()}

          {/* Inline errors */}
          {needsEmailConfirmation ? (
            <Text style={s.emailExistsBase}>Check your email to confirm your account, then sign in.</Text>
          ) : null}
          {error ? <Text style={s.errText}>{error}</Text> : null}
          {emailExists ? (
            <View style={s.emailExistsRow}>
              <Text style={s.emailExistsBase}>That email is already registered. </Text>
              <Pressable onPress={onGoLogin}>
                <Text style={s.emailExistsLink}>Sign in instead?</Text>
              </Pressable>
            </View>
          ) : null}
          {rateLimitSeconds > 0 ? (
            <Text style={s.rateLimitText}>Too many attempts — try again in {rateLimitSeconds}s</Text>
          ) : null}
        </Animated.View>

        {/* CTA */}
        <Animated.View style={[s.ctaWrap, ctaAnim]}>
          <Pressable
            style={[s.ctaBtn, (!valid || rateLimitSeconds > 0) && s.ctaDisabled]}
            onPress={handleSignUp}
            disabled={!valid || loading || rateLimitSeconds > 0}
          >
            {/* Subtle white gradient overlay */}
            <LinearGradient
              colors={['rgba(255,255,255,0.06)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            {loading ? (
              <ActivityIndicator color={C.alwaysLight} size="small" />
            ) : (
              <Text style={s.ctaLabel}>
                {rateLimitSeconds > 0
                  ? `Wait ${rateLimitSeconds}s`
                  : 'Continue'}
              </Text>
            )}
          </Pressable>

          {/* Creating an account with a password used to show no terms at all, while the
              other sign-in paths did. App Review (1.2) expects agreement to terms that
              ban objectionable content before someone can post. */}
          <Text style={s.legal}>
            By creating an account you agree to our{' '}
            <Text style={s.legalLink} onPress={() => Linking.openURL('https://runivo.app/terms')}>Terms</Text> and{' '}
            <Text style={s.legalLink} onPress={() => Linking.openURL('https://runivo.app/privacy')}>Privacy Policy</Text>.
            There is no tolerance for abusive or objectionable content.
          </Text>

          <Pressable onPress={onGoLogin} style={s.signinRow}>
            <Text style={s.signinText}>
              Have an account? <Text style={s.signinLink}>Sign in</Text>
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

    // Nav
    nav:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8 },
    backBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
    backSpacer: { width: 40 },
    backText:{ fontFamily: Fonts.medium, fontSize: 14, color: C.t1 },
    logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    logoWord:{ fontFamily: Fonts.wordmark, fontSize: 22, letterSpacing: -0.4, color: C.t1 },

    // Scroll / hero
    scroll:  { paddingHorizontal: 22, flexGrow: 1 },
    hero:    { paddingTop: 28 },
    eyebrow: { ...Type.label, color: C.red, marginBottom: 10 },
    h1:      { fontFamily: Fonts.semiBold, fontSize: 34, lineHeight: 39, letterSpacing: -1, color: C.t1, marginBottom: 4 },
    subtext: { ...Type.body, color: C.t2, maxWidth: 300 },

    // Divider
    rule:    { height: 0, marginTop: 14 },

    // Fields
    field:   { borderWidth: 1, borderColor: 'transparent', borderRadius: 18, backgroundColor: C.card, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 12, marginTop: 12 },
    labelRow:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    label:   { fontFamily: Fonts.medium, fontSize: 13, color: C.t2, marginBottom: 6 },
    counter: { fontFamily: Fonts.medium, fontSize: 11, color: C.t3 },
    counterOver: { color: C.danger },
    inputRow:{ flexDirection: 'row', alignItems: 'center' },
    input:   { fontFamily: Fonts.regular, fontSize: 16, color: C.t1, paddingVertical: 0, flex: 1 },
    toggleBtn:{ paddingLeft: 12 },
    toggleText: { fontFamily: Fonts.semiBold, fontSize: 12, color: C.t2 },

    // Errors
    errText:       { ...Type.caption, color: C.danger, marginTop: 10 },
    emailExistsRow:{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
    emailExistsBase: { fontSize: 12, color: C.t2 },
    emailExistsLink: { fontFamily: Fonts.medium, fontSize: 12, color: C.t1, textDecorationLine: 'underline' },
    rateLimitText: { ...Type.caption, color: C.amber, marginTop: 10 },

    // OR divider
    orRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 28, marginBottom: 16 },
    orLine:  { flex: 1, height: 1, backgroundColor: C.border },
    orLabel: { fontFamily: Fonts.medium, fontSize: 12, color: C.t3 },

    // Social
    socialRow: { flexDirection: 'row', gap: 12 },
    socialBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, borderRadius: 999, height: 48 },
    socialText:{ fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
    appleNativeBtnWrap: { flex: 1, height: 48, borderRadius: 999, overflow: 'hidden' },
    appleNativeBtn: { width: '100%', height: 48 },

    // CTA — fixed dark/light pair, same reasoning as LoginForm's ctaBtn.
    ctaWrap:    { marginTop: 'auto', paddingTop: 28 },
    ctaBtn:     { backgroundColor: C.alwaysDark, borderRadius: 28, height: 56, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    ctaDisabled:{ opacity: 0.45 },
    ctaLabel:   { ...Type.button, color: C.alwaysLight },

    // Sign in link
    legal:      { fontFamily: Fonts.regular, fontSize: 12, lineHeight: 17, color: C.t3, textAlign: 'center', marginTop: 14, paddingHorizontal: 8 },
    legalLink:  { color: C.t2, textDecorationLine: 'underline' },
    signinRow:  { marginTop: 20, alignItems: 'center' },
    signinText: { fontFamily: Fonts.regular, fontSize: 15, color: C.t1 },
    signinLink: { fontFamily: Fonts.medium, fontSize: 13, color: C.t1, textDecorationLine: 'underline' },
  });
}
