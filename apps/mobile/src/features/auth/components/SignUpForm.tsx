import React, { useEffect } from 'react';
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
import Svg, { Path } from 'react-native-svg';
import HexMark from './HexMark';
import type { SignUpState } from '../hooks/useSignUp';

// ── Design tokens ─────────────────────────────────────────────────────────────
const D = {
  bg:    '#F7F5F2',
  t1:    '#111110',
  t2:    '#7A7873',
  t3:    '#B8B5B0',
  div:   '#E2DFDA',
  red:   '#C8391A',
} as const;

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

// ── Google icon ───────────────────────────────────────────────────────────────
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

// ── Apple icon ────────────────────────────────────────────────────────────────
function AppleIcon() {
  return (
    <Svg width={13} height={15} viewBox="0 0 814 1000">
      <Path
        fill={D.t1}
        d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 523 26.3 355.7 26.3 262.7c0-125.1 40.8-191.4 122.8-254 76.2-58.4 177.5-75.8 275.1-75.8 106.3 0 198.5 37.9 267.2 37.9 26.5 0 109.3-37.9 207.9-37.9 74.1 0 157.2 19.8 214.8 74.1zM545.5 80.1c32.7-40.8 57.2-97.8 57.2-154.8 0-8.1-.6-16.3-2-23.3-54.1 2-117.8 35.6-157.1 80.1-30.1 34.2-60.2 91.2-60.2 149.4 0 8.7 1.4 17.4 2 20.7 3.9.6 10.5 1.4 17 1.4 49.2 0 108.2-32.1 143.1-73.5z"
      />
    </Svg>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props extends Omit<SignUpState, 'emailExists' | 'rateLimitSeconds'> {
  onGoBack: () => void;
  onGoLogin: () => void;
  emailExists?: boolean;
  rateLimitSeconds?: number;
}

export default function SignUpForm({
  username, email, pwd, showPwd, loading, error, valid,
  emailExists = false, rateLimitSeconds = 0,
  setUsername, setEmail, setPwd, setShowPwd, handleSignUp,
  onGoBack, onGoLogin,
}: Props) {
  const insets = useSafeAreaInsets();

  // Staggered entrance — 70ms between groups
  const navAnim     = useEntrance(0);
  const eyebrowAnim = useEntrance(70);
  const h1Anim      = useEntrance(140);
  const subAnim     = useEntrance(210);
  const formAnim    = useEntrance(280);
  const socialAnim  = useEntrance(350);
  const ctaAnim     = useEntrance(420);

  // Per-field animated border
  const userBorder  = useFieldBorder();
  const emailBorder = useFieldBorder();
  const pwBorder    = useFieldBorder();

  const countOver = username.length > 16;

  return (
    <View style={s.root}>
      {/* 2px red bar — flush above safe area */}
      <View style={s.topBar} />

      {/* Nav — offset below status bar */}
      <Animated.View style={[s.nav, navAnim, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={onGoBack} hitSlop={8}>
          <Text style={s.backText}>← Back</Text>
        </Pressable>
        <View style={s.logoRow}>
          <HexMark size={20} color={D.red} fadedOpacity={0.3} animate delay={80} />
          <Text style={s.logoWord}>runivo</Text>
        </View>
      </Animated.View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={s.hero}>
          <Animated.Text style={[s.eyebrow, eyebrowAnim]}>CREATE ACCOUNT</Animated.Text>
          <Animated.Text style={[s.h1, h1Anim]}>Join the{'\n'}conquest.</Animated.Text>
          <Animated.Text style={[s.subtext, subAnim]}>
            Claim territory. Defend your city.{'\n'}Every run matters.
          </Animated.Text>
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
              placeholderTextColor={D.t3}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              returnKeyType="next"
              selectionColor={D.red}
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

          {/* Password */}
          <Animated.View style={[s.field, pwBorder.style]}>
            <View style={s.labelRow}>
              <Text style={s.label}>Password</Text>
            </View>
            <View style={s.inputRow}>
              <TextInput
                style={[s.input, { flex: 1 }]}
                value={pwd}
                onChangeText={setPwd}
                placeholder="Min. 8 characters"
                placeholderTextColor={D.t3}
                secureTextEntry={!showPwd}
                returnKeyType="done"
                onSubmitEditing={handleSignUp}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                textContentType="newPassword"
                selectionColor={D.red}
                onFocus={pwBorder.onFocus}
                onBlur={pwBorder.onBlur}
              />
              <Pressable onPress={() => setShowPwd(!showPwd)} hitSlop={8} style={s.toggleBtn}>
                <Text style={s.toggleText}>{showPwd ? 'HIDE' : 'SHOW'}</Text>
              </Pressable>
            </View>
          </Animated.View>

          {/* Inline errors */}
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

        {/* OR divider */}
        <Animated.View style={[s.orRow, socialAnim]}>
          <View style={s.orLine} />
          <Text style={s.orLabel}>or</Text>
          <View style={s.orLine} />
        </Animated.View>

        {/* Social buttons */}
        <Animated.View style={[s.socialRow, socialAnim]}>
          <Pressable style={s.socialBtn}>
            <GoogleIcon />
            <Text style={s.socialText}>Google</Text>
          </Pressable>
          <Pressable style={s.socialBtn}>
            <AppleIcon />
            <Text style={s.socialText}>Apple</Text>
          </Pressable>
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
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={s.ctaLabel}>
                {rateLimitSeconds > 0
                  ? `Wait ${rateLimitSeconds}s`
                  : 'Create Account  →'}
              </Text>
            )}
          </Pressable>

          <Pressable onPress={onGoLogin} style={s.signinRow}>
            <Text style={s.signinText}>
              Already a runner?{'  '}
              <Text style={s.signinLink}>Sign in</Text>
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

  // Nav
  nav:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 4 },
  backText:{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: D.t2 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoWord:{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: D.t1, letterSpacing: -0.2 },

  // Scroll / hero
  scroll:  { paddingHorizontal: 24 },
  hero:    { paddingTop: 52 },
  eyebrow: { fontFamily: 'DMSans_500Medium', fontSize: 10, color: D.red, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 14 },
  h1:      { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 46, color: D.t1, lineHeight: 46, marginBottom: 14 },
  subtext: { fontFamily: 'DMSans_300Light', fontSize: 14, color: D.t2, lineHeight: 21, maxWidth: 240 },

  // Divider
  rule:    { height: 1, backgroundColor: D.div, marginTop: 44, marginBottom: 0 },

  // Fields
  field:   { borderBottomWidth: 1, paddingTop: 24, paddingBottom: 10 },
  labelRow:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  label:   { fontFamily: 'DMSans_500Medium', fontSize: 10, color: D.t3, textTransform: 'uppercase', letterSpacing: 1 },
  counter: { fontFamily: 'DMSans_500Medium', fontSize: 10, color: D.t3 },
  counterOver: { color: D.red },
  inputRow:{ flexDirection: 'row', alignItems: 'center' },
  input:   { fontFamily: 'DMSans_300Light', fontSize: 16, color: D.t1, paddingVertical: 0, flex: 1 },
  toggleBtn:{ paddingLeft: 12 },
  toggleText: { fontFamily: 'DMSans_500Medium', fontSize: 11, color: D.t2, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Errors
  errText:       { fontFamily: 'DMSans_400Regular', fontSize: 11, color: D.red, marginTop: 10 },
  emailExistsRow:{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  emailExistsBase: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: D.t2 },
  emailExistsLink: { fontFamily: 'DMSans_500Medium', fontSize: 12, color: D.t1, textDecorationLine: 'underline' },
  rateLimitText: { fontFamily: 'DMSans_400Regular', fontSize: 11, color: '#C27F00', marginTop: 10 },

  // OR divider
  orRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 28, marginBottom: 16 },
  orLine:  { flex: 1, height: 1, backgroundColor: D.div },
  orLabel: { fontFamily: 'DMSans_400Regular', fontSize: 11, color: D.t3, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Social
  socialRow: { flexDirection: 'row', gap: 12 },
  socialBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: D.div, borderRadius: 8, paddingVertical: 13 },
  socialText:{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: D.t1 },

  // CTA
  ctaWrap:    { marginTop: 20 },
  ctaBtn:     { backgroundColor: D.t1, borderRadius: 10, paddingVertical: 17, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  ctaDisabled:{ backgroundColor: '#555' },
  ctaLabel:   { fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.8 },

  // Sign in link
  signinRow:  { marginTop: 20, alignItems: 'center' },
  signinText: { fontFamily: 'DMSans_300Light', fontSize: 13, color: D.t2 },
  signinLink: { fontFamily: 'DMSans_500Medium', fontSize: 13, color: D.t1, textDecorationLine: 'underline' },
});
