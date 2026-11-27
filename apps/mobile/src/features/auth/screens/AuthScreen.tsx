/**
 * AuthScreen — one way in for new and returning runners (PRD: no passwords).
 * Apple, Google, a phone number with an SMS code, or an email magic link. The
 * first sign-in creates the account; App.tsx then routes to onboarding or home.
 * The older email + password forms stay reachable for existing accounts.
 */
import { RunivoMark } from '@mobile/shared/components/RunivoMark';
import { appAlert } from '@mobile/shared/components/AppAlert';
import { GoogleIcon, AppleIcon } from '@mobile/shared/components/BrandIcons';
import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Haptics from '@theme/hapticsGated';
import { ArrowLeft, Phone, Mail } from '@mobile/shared/icons/lucideCompat';
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
  const a = usePasswordlessAuth(mode);
  const login = useLogin();
  const signUp = useSignUp();
  const [social, setSocial] = useState<'google' | 'apple' | null>(null);

  async function socialSignIn(provider: 'google' | 'apple') {
    setSocial(provider);
    try {
      if (provider === 'google') await signInWithGoogle(); else await signInWithApple();
    } catch {
      appAlert('Sign in failed', 'Please try again, or use your phone or email.');
    } finally {
      setSocial(null);
    }
  }

  // The older password forms keep their own layout and back button.
  if (a.stage === 'password') {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <LoginForm {...login} onGoBack={() => a.setStage('choose')} onGoSignUp={() => a.setStage('passwordSignup')} onForgot={() => a.setStage('reset')} />
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
    ? (a.resendsLeft === 0 ? `New codes in ${Math.ceil(a.resendIn / 60)} min` : `Resend in ${Math.floor(a.resendIn / 60)}:${String(a.resendIn % 60).padStart(2, '0')}`)
    : (a.channel === 'sms' ? 'Send a new code' : 'Send a new link');

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[s.nav, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={onBack} hitSlop={10} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Back">
          <ArrowLeft size={16} color={C.t1} strokeWidth={1.8} />
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} accessibilityRole="header" accessibilityLabel="Runivo"><RunivoMark size={22} inline /><Text style={s.logo}>runivo</Text></View>
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

            {/* From "Get started" this must open the create-account form: it used to
                open the sign-in form, so a new runner's email and password came back
                "Invalid login credentials". */}
            <Pressable onPress={() => a.setStage(mode === 'signup' ? 'passwordSignup' : 'password')} hitSlop={8} style={s.linkWrap}>
              <Text style={s.link}>{mode === 'signup' ? 'Sign up with a password instead' : 'Use a password instead'}</Text>
            </Pressable>
            <Text style={s.legal}>
              By continuing you agree to our{' '}
              <Text style={s.legalLink} onPress={() => Linking.openURL('https://runivo.in/terms')}>Terms</Text> and{' '}
              <Text style={s.legalLink} onPress={() => Linking.openURL('https://runivo.in/privacy')}>Privacy Policy</Text>.
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

        {a.stage === 'reset' && (
          <>
            <Text style={s.hero}>Reset your password</Text>
            <Text style={s.sub}>Enter your email and we’ll send a link to set a new one.</Text>
            <Text style={s.fieldLabel}>Email</Text>
            <TextInput
              value={login.email}
              onChangeText={login.setEmail}
              placeholder="you@example.com"
              placeholderTextColor={C.t3}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              style={s.input}
              onSubmitEditing={login.handleForgotPassword}
              accessibilityLabel="Email address"
            />
            <Text style={s.resetNote} accessibilityLiveRegion="polite">
              {login.resetSent
                ? 'If an account uses that email, a link is on its way.'
                : 'If an account uses that email, a link is on its way. Signed up with Apple, Google or phone? Use that instead.'}
            </Text>
            {!!login.error && <Text style={s.error}>{login.error}</Text>}
            <Cta
              label={login.resetCooldownSeconds > 0 ? `Send again in ${login.resetCooldownSeconds}s` : 'Send reset link'}
              busy={login.loading}
              disabled={login.resetCooldownSeconds > 0 || !/^\S+@\S+\.\S+$/.test(login.email.trim())}
              onPress={login.handleForgotPassword}
              s={s} C={C}
            />
            <Pressable onPress={() => a.setStage('password')} hitSlop={8} style={s.linkWrapTight} accessibilityRole="button">
              <Text style={s.linkPlain}>Back to sign in</Text>
            </Pressable>
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
            <Text style={s.sub}>
              We sent 6 digits to <Text style={s.strong}>{a.destination}</Text>.{a.channel === 'sms' ? '' : ' It works for an hour.'}
            </Text>
            <CodeInput value={a.code} onChange={a.setCode} onComplete={c => a.submitCode(c)} error={!!a.error} />
            <Pressable onPress={a.resend} disabled={a.resendIn > 0 || a.busy} hitSlop={8} style={s.linkWrap} accessibilityRole="button">
              <Text style={s.resendLine}>
                Didn’t get it? <Text style={[s.strong, a.resendIn === 0 && s.link]}>{resendLabel}</Text>
              </Text>
            </Pressable>
            <Pressable onPress={a.back} hitSlop={8} style={s.linkWrapTight} accessibilityRole="button">
              <Text style={s.linkPlain}>Use a different number or email</Text>
            </Pressable>
            <View style={s.mt}>
              <Cta label="Verify" onPress={() => a.submitCode(a.code)} busy={a.busy} disabled={a.code.length < 6} s={s} C={C} />
            </View>
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
    fieldLabel:    { fontFamily: Fonts.medium, fontSize: 14, color: C.t2, marginBottom: 8 },
    resetNote:     { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 20, color: C.t2, marginTop: 12, marginBottom: 20 },
    resendLine:    { fontFamily: Fonts.regular, fontSize: 15, color: C.t2 },
    linkPlain:     { fontFamily: Fonts.medium, fontSize: 15, color: C.t1 },
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
    error:         { fontFamily: Fonts.medium, fontSize: 14, color: C.danger, marginTop: 14, textAlign: 'center' },
  });
}
