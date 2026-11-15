/**
 * AuthScreen — one way in for new and returning runners (PRD: no passwords).
 * Apple, Google, a phone number with an SMS code, or an email magic link. The
 * first sign-in creates the account; App.tsx then routes to onboarding or home.
 * The older email + password forms stay reachable for existing accounts.
 */
import { RunivoMark } from '@mobile/shared/components/RunivoMark';
import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, Linking, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Haptics from '@theme/hapticsGated';
import Svg, { Path } from 'react-native-svg';
import { ArrowLeft, Phone, Mail } from 'lucide-react-native';
import { useTheme, useIsDark, Fonts, Type, type AppColors } from '@theme';
import { usePasswordlessAuth } from '../hooks/usePasswordlessAuth';
import { useLogin } from '../hooks/useLogin';
import { useSignUp } from '../hooks/useSignUp';
import { signInWithGoogle, signInWithApple } from '../services/socialAuth';
import LoginForm from '../components/LoginForm';
import SignUpForm from '../components/SignUpForm';
import CodeInput from '../components/CodeInput';

interface Props {
  /** Only changes the opening headline. */
  mode: 'signup' | 'login';
}

export default function AuthScreen({ mode }: Props) {
  const C = useTheme();
  const isDark = useIsDark();
  const s = useMemo(() => mkStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const a = usePasswordlessAuth();
  const login = useLogin();
  const signUp = useSignUp();
  const [social, setSocial] = useState<'google' | 'apple' | null>(null);

  async function socialSignIn(provider: 'google' | 'apple') {
    setSocial(provider);
    try {
      if (provider === 'google') await signInWithGoogle(); else await signInWithApple();
    } catch {
      Alert.alert('Sign in failed', 'Please try again, or use your phone or email.');
    } finally {
      setSocial(null);
    }
  }

  // The older password forms keep their own layout and back button.
  if (a.stage === 'password') {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <LoginForm {...login} onGoBack={() => a.setStage('choose')} onGoSignUp={() => a.setStage('passwordSignup')} />
      </KeyboardAvoidingView>
    );
  }
  if (a.stage === 'passwordSignup') {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SignUpForm
          {...signUp}
          emailExists={signUp.emailExists}
          rateLimitSeconds={signUp.rateLimitSeconds}
          onGoBack={() => a.setStage('password')}
          onGoLogin={() => a.setStage('password')}
        />
      </KeyboardAvoidingView>
    );
  }

  const onBack = () => {
    if (a.stage === 'choose') navigation.goBack();
    else a.back();
  };

  const resendLabel = a.resendIn > 0
    ? (a.resendsLeft === 0 ? `New codes in ${Math.ceil(a.resendIn / 60)} min` : `Resend in 0:${String(a.resendIn).padStart(2, '0')}`)
    : (a.channel === 'sms' ? 'Send a new code' : 'Send a new link');

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[s.nav, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={onBack} hitSlop={10} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Back">
          <ArrowLeft size={16} color={C.t1} strokeWidth={1.8} />
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} accessibilityRole="header" accessibilityLabel="Runivo"><RunivoMark size={22} /><Text style={s.logo}>runivo</Text></View>
        <View style={s.backSpacer} />
      </View>

      <ScrollView contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        {a.stage === 'choose' && (
          <>
            <Text style={s.eyebrow}>Run · Claim · Keep</Text>
            <Text style={s.hero}>{mode === 'login' ? 'Welcome\nback.' : 'Let’s get\nyou running.'}</Text>
            <Text style={s.sub}>One tap to start. No passwords to remember.</Text>

            <View style={s.stack}>
              {Platform.OS === 'ios' && (
                <View style={[s.appleWrap, social && s.dim]} pointerEvents={social ? 'none' : 'auto'}>
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                    buttonStyle={isDark ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                    cornerRadius={27}
                    style={s.appleBtn}
                    onPress={() => socialSignIn('apple')}
                  />
                </View>
              )}
              <Pressable style={({ pressed }) => [s.pill, s.pillLight, pressed && s.pressed]} onPress={() => socialSignIn('google')} disabled={!!social}>
                {social === 'google' ? <ActivityIndicator color={C.t1} /> : <GoogleIcon />}
                <Text style={s.pillLightText}>Continue with Google</Text>
              </Pressable>
              {Platform.OS !== 'ios' && (
                <Pressable style={({ pressed }) => [s.pill, s.pillLight, pressed && s.pressed]} onPress={() => socialSignIn('apple')} disabled={!!social}>
                  {social === 'apple' ? <ActivityIndicator color={C.t1} /> : <AppleIcon color={C.t1} />}
                  <Text style={s.pillLightText}>Continue with Apple</Text>
                </Pressable>
              )}
              <Pressable style={({ pressed }) => [s.pill, s.pillDark, pressed && s.pressed]} onPress={() => a.setStage('phone')}>
                <Phone size={18} color={C.alwaysLight} strokeWidth={2.2} />
                <Text style={s.pillDarkText}>Continue with phone</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [s.pill, s.pillLight, pressed && s.pressed]} onPress={() => a.setStage('email')}>
                <Mail size={18} color={C.t1} strokeWidth={2.2} />
                <Text style={s.pillLightText}>Continue with email</Text>
              </Pressable>
            </View>

            <Pressable onPress={() => a.setStage('password')} hitSlop={8} style={s.linkWrap}>
              <Text style={s.link}>Use a password instead</Text>
            </Pressable>
            <Text style={s.legal}>
              By continuing you agree to our{' '}
              <Text style={s.legalLink} onPress={() => Linking.openURL('https://runivo.app/terms')}>Terms</Text> and{' '}
              <Text style={s.legalLink} onPress={() => Linking.openURL('https://runivo.app/privacy')}>Privacy Policy</Text>.
            </Text>
          </>
        )}

        {a.stage === 'phone' && (
          <>
            <Text style={s.hero}>Your number</Text>
            <Text style={s.sub}>We’ll text you a 6-digit code. Standard SMS rates may apply.</Text>
            <TextInput
              value={a.phone}
              onChangeText={a.setPhone}
              placeholder="98765 43210"
              placeholderTextColor={C.t3}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
              autoFocus
              style={s.input}
              onSubmitEditing={a.submitPhone}
              accessibilityLabel="Mobile number"
            />
            <Text style={s.hint}>Outside India? Start with your country code, like +44 or +1.</Text>
            <Cta label="Send code" busy={a.busy} disabled={!a.phoneValid} onPress={a.submitPhone} s={s} C={C} />
          </>
        )}

        {a.stage === 'email' && (
          <>
            <Text style={s.hero}>Your email</Text>
            <Text style={s.sub}>We’ll email you a link that signs you in. No password needed.</Text>
            <TextInput
              value={a.email}
              onChangeText={a.setEmail}
              placeholder="you@example.com"
              placeholderTextColor={C.t3}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              style={s.input}
              onSubmitEditing={a.submitEmail}
              accessibilityLabel="Email address"
            />
            <Cta label="Send link" busy={a.busy} disabled={!a.emailValid} onPress={a.submitEmail} s={s} C={C} />
          </>
        )}

        {a.stage === 'emailSent' && (
          <>
            <Text style={s.hero}>Check your inbox</Text>
            <Text style={s.sub}>
              Open the email we sent to <Text style={s.strong}>{a.destination}</Text> on this phone and tap the link.
            </Text>
            {Platform.OS === 'ios' && (
              <Cta label="Open Mail" onPress={() => Linking.openURL('message://').catch(() => {})} s={s} C={C} />
            )}
            <Pressable style={({ pressed }) => [s.pill, s.pillLight, s.mt, pressed && s.pressed]} onPress={() => a.setStage('code')}>
              <Text style={s.pillLightText}>Enter the 6-digit code instead</Text>
            </Pressable>
            <Pressable onPress={a.resend} disabled={a.resendIn > 0 || a.busy} hitSlop={8} style={s.linkWrap}>
              <Text style={[s.link, a.resendIn > 0 && s.linkOff]}>{resendLabel}</Text>
            </Pressable>
          </>
        )}

        {a.stage === 'code' && (
          <>
            <Text style={s.hero}>Enter the code</Text>
            <Text style={s.sub}>Sent to <Text style={s.strong}>{a.destination}</Text></Text>
            <CodeInput value={a.code} onChange={a.setCode} onComplete={c => a.submitCode(c)} error={!!a.error} />
            {a.busy && <ActivityIndicator color={C.red} style={s.mt} />}
            <Pressable onPress={a.resend} disabled={a.resendIn > 0 || a.busy} hitSlop={8} style={s.linkWrap}>
              <Text style={[s.link, a.resendIn > 0 && s.linkOff]}>{resendLabel}</Text>
            </Pressable>
            <Pressable onPress={a.back} hitSlop={8} style={s.linkWrapTight}>
              <Text style={s.linkQuiet}>{a.channel === 'sms' ? 'Wrong number? Change it' : 'Wrong email? Change it'}</Text>
            </Pressable>
          </>
        )}

        {!!a.error && <Text style={s.error} accessibilityLiveRegion="polite">{a.error}</Text>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Cta({ label, onPress, busy, disabled, s, C }: {
  label: string; onPress: () => void; busy?: boolean; disabled?: boolean;
  s: ReturnType<typeof mkStyles>; C: AppColors;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [s.cta, (disabled || busy) && s.ctaOff, pressed && s.pressed]}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onPress(); }}
      disabled={disabled || busy}
    >
      {busy ? <ActivityIndicator color={C.alwaysLight} /> : <Text style={s.ctaText}>{label}</Text>}
    </Pressable>
  );
}

function GoogleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

function AppleIcon({ color }: { color: string }) {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24">
      <Path fill={color} d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.32.07 2.24.74 3.01.75.84-.15 1.64-.84 3.03-.91 1.81.1 3.17.9 3.95 2.35-3.44 2.08-2.64 6.89.88 8.25-.65 1.4-1.5 2.79-2.87 4.44zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </Svg>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:          { flex: 1, backgroundColor: C.bg },
    nav:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 8 },
    backBtn:       { width: 36, height: 36, borderRadius: 18, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
    backSpacer:    { width: 40 },
    logo:          { fontFamily: Fonts.wordmark, fontSize: 22, letterSpacing: -0.4, color: C.t1 },
    body:          { paddingHorizontal: 22, paddingTop: 24 },
    eyebrow:       { fontFamily: Fonts.semiBold, fontSize: 13, color: C.red, marginBottom: 10 },
    hero:          { ...Type.hero, fontSize: 52, lineHeight: 48, color: C.t1 },
    sub:           { fontFamily: Fonts.regular, fontSize: 15.5, lineHeight: 22, color: C.t2, marginTop: 12, marginBottom: 26 },
    strong:        { fontFamily: Fonts.semiBold, color: C.t1 },
    stack:         { gap: 10 },
    appleWrap:     { height: 54 },
    appleBtn:      { width: '100%', height: 54 },
    dim:           { opacity: 0.5 },
    pill:          { height: 54, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    pillLight:     { backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
    pillLightText: { fontFamily: Fonts.semiBold, fontSize: 16, color: C.t1 },
    pillDark:      { backgroundColor: C.alwaysDark },
    pillDarkText:  { fontFamily: Fonts.semiBold, fontSize: 16, color: C.alwaysLight },
    pressed:       { opacity: 0.9, transform: [{ scale: 0.985 }] },
    mt:            { marginTop: 12 },
    linkWrap:      { alignItems: 'center', paddingVertical: 18 },
    linkWrapTight: { alignItems: 'center', paddingBottom: 12 },
    link:          { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1, textDecorationLine: 'underline' },
    linkOff:       { color: C.t3, textDecorationLine: 'none' },
    linkQuiet:     { fontFamily: Fonts.medium, fontSize: 14, color: C.t2 },
    legal:         { fontFamily: Fonts.regular, fontSize: 12, lineHeight: 17, color: C.t3, textAlign: 'center', paddingHorizontal: 12 },
    legalLink:     { color: C.t2, textDecorationLine: 'underline' },
    input:         {
      height: 58, borderRadius: 22, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.border,
      paddingHorizontal: 18, fontFamily: Fonts.medium, fontSize: 19, color: C.t1,
    },
    hint:          { fontFamily: Fonts.regular, fontSize: 13, color: C.t3, marginTop: 10 },
    cta:           { height: 54, borderRadius: 999, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
    ctaOff:        { opacity: 0.4 },
    ctaText:       { fontFamily: Fonts.semiBold, fontSize: 16, color: C.alwaysLight },
    error:         { fontFamily: Fonts.medium, fontSize: 14, color: C.red, marginTop: 14, textAlign: 'center' },
  });
}
