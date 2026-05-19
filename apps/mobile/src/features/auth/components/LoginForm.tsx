import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet,
  ActivityIndicator, Platform,
} from 'react-native';
import HexMark from './HexMark';
import type { LoginState } from '../hooks/useLogin';
import { Colors } from '@theme';

const C = Colors;

interface Props extends LoginState {
  onGoBack: () => void;
  onGoSignUp: () => void;
}

export default function LoginForm({
  email, password, showPwd, loading, error, resetSent, valid,
  setEmail, setPassword, setShowPwd, handleSignIn, handleForgotPassword,
  onGoBack, onGoSignUp,
}: Props) {
  const [emailFocused, setEmailFocused] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);

  return (
    <>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.watermark} pointerEvents="none">
          <HexMark size={280} color={C.black} fadedOpacity={0.06} />
        </View>
        <View style={s.navbar}>
          <Pressable onPress={onGoBack} style={s.backBtn}>
            <Text style={s.backText}>← Back</Text>
          </Pressable>
          <View style={s.logoRow}>
            <HexMark size={22} color={C.black} fadedOpacity={0.3} animate delay={100} />
            <Text style={s.logoText}>run<Text style={s.logoRed}>ivo</Text></Text>
          </View>
        </View>

        <View style={s.form}>
          <Text style={s.eyebrow}>Welcome back</Text>
          <View style={s.redRule} />
          <View style={s.titleRow}>
            <HexMark size={32} color={C.black} fadedOpacity={0.28} animate delay={200} />
            <Text style={s.title}>Sign in.</Text>
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
                style={[s.fieldInput, { flex: 1 }]} value={password} onChangeText={setPassword}
                placeholder="••••••••" placeholderTextColor={C.t3}
                secureTextEntry={!showPwd} returnKeyType="done" onSubmitEditing={handleSignIn}
                autoCapitalize="none" autoCorrect={false} spellCheck={false}
                textContentType="password"
                onFocus={() => setPwFocused(true)}
                onBlur={() => setPwFocused(false)}
              />
              <Pressable onPress={() => setShowPwd(!showPwd)} style={s.eyeBtn}>
                <Text style={s.eyeText}>{showPwd ? 'Hide' : 'Show'}</Text>
              </Pressable>
            </View>
          </View>

          <Pressable onPress={handleForgotPassword} style={s.forgotRow} disabled={loading}>
            <Text style={s.forgotText}>Forgot password?</Text>
          </Pressable>

          {resetSent
            ? <Text style={s.resetSentText}>Check your inbox — reset link sent.</Text>
            : error
              ? <Text style={s.errText}>{error}</Text>
              : null}
        </View>
      </ScrollView>

      <View style={s.cta}>
        <Pressable
          style={[s.btn, valid ? s.btnBlack : s.btnDisabled]}
          onPress={handleSignIn} disabled={!valid || loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.btnLabel}>Sign in →</Text>}
        </Pressable>
        <Pressable onPress={onGoSignUp} style={s.switchRow}>
          <Text style={s.switchText}>No account? <Text style={s.switchLink}>Create one</Text></Text>
        </Pressable>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  scroll: { flexGrow: 1 },
  watermark: { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -140 }, { translateY: -168 }] },
  navbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 8,
  },
  backBtn: { padding: 4 },
  backText: { fontSize: 11, color: C.t2 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  logoText: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 14, color: C.black },
  logoRed: { color: C.red },
  form: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  eyebrow: { fontSize: 8, color: C.t3, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 },
  redRule: { width: 24, height: 1.5, backgroundColor: C.red, borderRadius: 1, marginBottom: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 },
  title: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 26, color: C.black },
  field: { paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: C.border },
  fieldFocused: { borderBottomColor: C.red },
  fieldLabel: { fontSize: 8, color: C.t3, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 },
  fieldRow: { flexDirection: 'row', alignItems: 'center' },
  fieldInput: { fontSize: 14, color: C.black, paddingVertical: 0 },
  eyeBtn: { paddingLeft: 8 },
  eyeText: { fontSize: 11, color: C.t3 },
  forgotRow: { alignSelf: 'flex-end', paddingTop: 10 },
  forgotText: { fontSize: 11, color: C.t2, textDecorationLine: 'underline' },
  errText: { fontSize: 9, color: C.red, marginTop: 8 },
  resetSentText: { fontSize: 11, color: '#2D7D46', marginTop: 8 },
  cta: { paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 28 : 20, paddingTop: 12 },
  btn: { paddingVertical: 13, borderRadius: 4, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  btnBlack: { backgroundColor: C.black },
  btnDisabled: { backgroundColor: C.mid },
  btnLabel: { fontWeight: '500', fontSize: 12, color: '#fff', letterSpacing: 1 },
  switchRow: { marginTop: 14, alignItems: 'center' },
  switchText: { fontSize: 11, color: C.t2 },
  switchLink: { color: C.black, textDecorationLine: 'underline' },
});
