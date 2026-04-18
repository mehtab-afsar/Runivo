import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet,
  ActivityIndicator, Platform,
} from 'react-native';
import HexMark from './HexMark';
import type { SignUpState } from '../hooks/useSignUp';
import { Colors } from '@theme';

const C = Colors;

interface Props extends Omit<SignUpState, 'emailExists' | 'rateLimitSeconds'> {
  onGoBack: () => void;
  onGoLogin: () => void;
  emailExists?: boolean;
  rateLimitSeconds?: number;
}

export default function SignUpForm({
  username, email, pwd, showPwd, loading, error, valid, pwStrength, pwColor,
  emailExists = false, rateLimitSeconds = 0,
  setUsername, setEmail, setPwd, setShowPwd, handleSignUp,
  onGoBack, onGoLogin,
}: Props) {
  const [usernameFocused, setUsernameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);

  return (
    <>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.watermark} pointerEvents="none">
          <HexMark size={220} color={C.red} fadedOpacity={0.04} />
        </View>
        <View style={s.navbar}>
          <Pressable onPress={onGoBack} style={s.backBtn}>
            <Text style={s.backText}>← Back</Text>
          </Pressable>
        </View>

        <View style={s.form}>
          <View style={s.logoRow}>
            <HexMark size={26} color={C.red} fadedOpacity={0.28} animate delay={100} />
            <Text style={s.logoText}>runivo</Text>
          </View>
          <Text style={s.title}>Join the conquest.</Text>
          <Text style={s.subtitle}>Create your account and claim your city.</Text>

          <View style={[s.field, usernameFocused && s.fieldFocused]}>
            <Text style={s.fieldLabel}>Username</Text>
            <View style={s.fieldRow}>
              <TextInput
                style={[s.fieldInput, { flex: 1 }]} value={username}
                onChangeText={v => setUsername(v.slice(0, 20))}
                placeholder="e.g. marcus_runs" placeholderTextColor={C.t3}
                autoCapitalize="none" autoCorrect={false} autoFocus returnKeyType="next"
                onFocus={() => setUsernameFocused(true)}
                onBlur={() => setUsernameFocused(false)}
              />
              <Text style={s.charCount}>{username.length}/20</Text>
            </View>
          </View>

          <View style={[s.field, emailFocused && s.fieldFocused]}>
            <Text style={s.fieldLabel}>Email</Text>
            <TextInput
              style={s.fieldInput} value={email} onChangeText={setEmail}
              placeholder="you@example.com" placeholderTextColor={C.t3}
              keyboardType="email-address" autoCapitalize="none"
              autoCorrect={false} returnKeyType="next"
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
            />
          </View>

          <View style={[s.field, pwFocused && s.fieldFocused]}>
            <Text style={s.fieldLabel}>Password</Text>
            <View style={s.fieldRow}>
              <TextInput
                style={[s.fieldInput, { flex: 1 }]} value={pwd} onChangeText={setPwd}
                placeholder="Min. 8 characters" placeholderTextColor={C.t3}
                secureTextEntry={!showPwd} returnKeyType="done" onSubmitEditing={handleSignUp}
                autoCapitalize="none" autoCorrect={false} spellCheck={false}
                textContentType="newPassword"
                onFocus={() => setPwFocused(true)}
                onBlur={() => setPwFocused(false)}
              />
              <Pressable onPress={() => setShowPwd(!showPwd)} style={s.eyeBtn}>
                <Text style={s.eyeText}>{showPwd ? 'Hide' : 'Show'}</Text>
              </Pressable>
            </View>
          </View>

          {pwd.length > 0 && (
            <View style={s.strengthRow}>
              {[1, 2, 3].map(i => (
                <View key={i} style={[s.strengthBar, { backgroundColor: i <= pwStrength ? pwColor : C.mid }]} />
              ))}
            </View>
          )}
          {error ? <Text style={s.errText}>{error}</Text> : null}
          {emailExists ? (
            <View style={s.emailExistsBanner}>
              <Text style={s.emailExistsText}>That email is already registered. </Text>
              <Pressable onPress={onGoLogin}><Text style={s.emailExistsLink}>Sign in instead?</Text></Pressable>
            </View>
          ) : null}
          {rateLimitSeconds > 0 ? (
            <Text style={s.rateLimitText}>Too many attempts. Try again in {rateLimitSeconds}s</Text>
          ) : null}
        </View>
      </ScrollView>

      <View style={s.cta}>
        <Pressable
          style={[s.btn, valid && rateLimitSeconds === 0 ? s.btnRed : s.btnDisabled]}
          onPress={handleSignUp} disabled={!valid || loading || rateLimitSeconds > 0}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.btnLabel}>{rateLimitSeconds > 0 ? `Wait ${rateLimitSeconds}s` : 'Create account →'}</Text>}
        </Pressable>
        <Pressable onPress={onGoLogin} style={s.switchRow}>
          <Text style={s.switchText}>Already a runner? <Text style={s.switchLink}>Sign in</Text></Text>
        </Pressable>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  scroll: { flexGrow: 1 },
  watermark: { position: 'absolute', bottom: -32, right: -32 },
  navbar: { paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 8 },
  backBtn: { padding: 4 },
  backText: { fontFamily: 'Barlow_400Regular', fontSize: 11, color: C.t3 },
  form: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 },
  logoText: { fontFamily: 'Barlow_300Light', fontSize: 15, color: C.black, letterSpacing: -0.2 },
  title: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 28, color: C.black, letterSpacing: -0.5, lineHeight: 31, marginBottom: 6 },
  subtitle: { fontFamily: 'Barlow_300Light', fontSize: 12, color: C.t3, lineHeight: 19, marginBottom: 28 },
  field: { paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.border },
  fieldFocused: { borderBottomColor: C.red },
  fieldLabel: { fontFamily: 'Barlow_400Regular', fontSize: 8, color: C.t3, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 },
  fieldRow: { flexDirection: 'row', alignItems: 'center' },
  fieldInput: { fontFamily: 'Barlow_300Light', fontSize: 14, color: C.black, paddingVertical: 0 },
  charCount: { fontFamily: 'Barlow_300Light', fontSize: 9, color: C.t3 },
  eyeBtn: { paddingLeft: 8 },
  eyeText: { fontFamily: 'Barlow_400Regular', fontSize: 11, color: C.t3 },
  strengthRow: { flexDirection: 'row', gap: 4, marginTop: 8 },
  strengthBar: { flex: 1, height: 2, borderRadius: 1 },
  errText: { fontFamily: 'Barlow_400Regular', fontSize: 9, color: C.red, marginTop: 8 },
  emailExistsBanner: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  emailExistsText: { fontFamily: 'Barlow_400Regular', fontSize: 11, color: C.t2 },
  emailExistsLink: { fontFamily: 'Barlow_500Medium', fontSize: 11, color: C.black, textDecorationLine: 'underline' },
  rateLimitText: { fontFamily: 'Barlow_400Regular', fontSize: 10, color: '#D4870A', marginTop: 8 },
  cta: { paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 28 : 20, paddingTop: 12 },
  btn: { paddingVertical: 13, borderRadius: 4, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  btnRed: { backgroundColor: C.red },
  btnDisabled: { backgroundColor: C.mid },
  btnLabel: { fontFamily: 'Barlow_500Medium', fontSize: 12, color: '#fff', textTransform: 'uppercase', letterSpacing: 1 },
  switchRow: { marginTop: 14, alignItems: 'center' },
  switchText: { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t2 },
  switchLink: { fontFamily: 'Barlow_400Regular', color: C.black, textDecorationLine: 'underline' },
});
