import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert, Platform, TextInput, Modal, KeyboardAvoidingView } from 'react-native';
import { Apple, Mail, Phone, Plus, X } from 'lucide-react-native';
import { useTheme, Fonts, Type, Spacing, type AppColors } from '@theme';
import { track } from '@shared/services/analytics';
import { linkableMethods, methodLabel, unlinkBlockReason, type LinkedMethod, type SignInMethod } from '@shared/engine/identities';
import { normalizePhone, otpSendPolicy, isOtpCode } from '@shared/engine/onboarding';
import CodeInput from '@features/auth/components/CodeInput';
import {
  loadSignInMethods, linkGoogle, linkApple, sendAddPhoneCode, verifyAddPhoneCode, unlinkMethod,
} from '@features/auth/services/identityLinking';
import { SettingSection } from './SettingSection';

function MethodIcon({ method, color }: { method: SignInMethod; color: string }) {
  if (method === 'apple') return <Apple size={18} color={color} strokeWidth={2} />;
  if (method === 'phone') return <Phone size={18} color={color} strokeWidth={2} />;
  if (method === 'google') return <Text style={{ fontFamily: Fonts.bold, fontSize: 16, color }}>G</Text>;
  return <Mail size={18} color={color} strokeWidth={2} />;
}

/**
 * Settings → Sign-in methods. One Runivo account, several ways in: Apple,
 * Google, phone, email. Linking needs "Allow manual linking" switched on in
 * the Supabase dashboard (docs/ONBOARDING.md).
 */
export function SignInMethodsSection() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const [methods, setMethods] = useState<LinkedMethod[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [phoneOpen, setPhoneOpen] = useState(false);

  const reload = useCallback(async () => {
    try {
      setMethods(await loadSignInMethods());
      setError('');
    } catch (e) {
      setMethods([]);
      setError(e instanceof Error ? e.message : 'Could not load your sign-in methods.');
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const run = useCallback(async (key: string, fn: () => Promise<boolean | void>) => {
    setBusy(key); setError('');
    try {
      const done = await fn();
      if (done !== false) { track('auth_method_changed', { action: key }); await reload(); }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(null);
    }
  }, [reload]);

  const confirmUnlink = (row: LinkedMethod) => {
    Alert.alert(
      `Remove ${row.label}?`,
      `You won't be able to sign in with ${row.label} any more. Your runs and zones stay on this account.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => run(`unlink_${row.method}`, () => unlinkMethod(row)) },
      ],
    );
  };

  const linkable = methods ? linkableMethods(methods, Platform.OS) : [];

  return (
    <SettingSection title="Sign-in methods">
      {methods == null ? (
        <View style={s.loading}><ActivityIndicator color={C.red} /></View>
      ) : (
        <>
          {methods.map(row => {
            const reason = unlinkBlockReason(row, methods);
            return (
              <View key={row.method} style={s.row}>
                <View style={s.icon}><MethodIcon method={row.method} color={C.t1} /></View>
                <View style={s.middle}>
                  <Text style={s.label}>{row.label}</Text>
                  {row.detail ? <Text style={s.detail}>{row.detail}</Text> : null}
                </View>
                {busy === `unlink_${row.method}` ? <ActivityIndicator color={C.t2} /> : row.canUnlink ? (
                  <Pressable onPress={() => confirmUnlink(row)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${row.label}`}>
                    <Text style={s.remove}>Remove</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => reason && Alert.alert(row.label, reason)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`${row.label}: ${reason ?? 'linked'}`}
                  >
                    <Text style={s.linked}>Linked</Text>
                  </Pressable>
                )}
              </View>
            );
          })}

          {linkable.map(method => (
            <Pressable
              key={method}
              style={({ pressed }) => [s.row, pressed && s.pressed]}
              disabled={!!busy}
              onPress={() => {
                if (method === 'google') run('link_google', linkGoogle);
                else if (method === 'apple') run('link_apple', linkApple);
                else setPhoneOpen(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={method === 'phone' ? 'Add phone number' : `Link ${methodLabel(method)}`}
            >
              <View style={[s.icon, s.iconAdd]}><Plus size={16} color={C.red} strokeWidth={2.4} /></View>
              <Text style={[s.label, s.addLabel]}>
                {method === 'phone' ? 'Add phone number' : `Link ${methodLabel(method)}`}
              </Text>
              {busy === `link_${method}` ? <ActivityIndicator color={C.t2} /> : null}
            </Pressable>
          ))}

          {error ? <Text style={s.error}>{error}</Text> : null}
          <Text style={s.footnote}>All of these sign you in to the same account, with the same runs, zones and PACE.</Text>
        </>
      )}

      <AddPhoneSheet
        visible={phoneOpen}
        onClose={() => setPhoneOpen(false)}
        onAdded={async () => { setPhoneOpen(false); track('auth_method_changed', { action: 'add_phone' }); await reload(); }}
      />
    </SettingSection>
  );
}

/** Number → SMS code, with the same resend limits as sign-in (30 s, 3 per 10 min). */
function AddPhoneSheet({ visible, onClose, onAdded }: { visible: boolean; onClose: () => void; onAdded: () => void }) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const [phone, setPhone] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [sends, setSends] = useState<number[]>([]);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) { setPhone(''); setSentTo(null); setCode(''); setError(''); return; }
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [visible]);

  const policy = otpSendPolicy(sends, now);

  const send = async (dest: string) => {
    const p = otpSendPolicy(sends, Date.now());
    if (!p.allowed) {
      setError(p.resendsLeft === 0 ? `Too many codes. Try again in ${Math.ceil(p.waitSeconds / 60)} min.` : `Wait ${p.waitSeconds}s before asking again.`);
      return;
    }
    setBusy(true); setError('');
    try {
      await sendAddPhoneCode(dest);
      setSends(prev => [...prev, Date.now()]);
      setSentTo(dest); setCode('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the code.');
    } finally {
      setBusy(false);
    }
  };

  const submitPhone = () => {
    const n = normalizePhone(phone);
    if (!n.ok) { setError(n.error); return; }
    send(n.e164);
  };

  const verify = async (value: string) => {
    if (!sentTo || !isOtpCode(value) || busy) return;
    setBusy(true); setError('');
    try {
      await verifyAddPhoneCode(sentTo, value);
      onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That code didn’t work.');
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.sheetBackdrop}>
        <View style={s.sheet}>
          <View style={s.sheetHead}>
            <Text style={s.sheetTitle}>{sentTo ? 'Enter the code' : 'Add phone number'}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <X size={20} color={C.t2} />
            </Pressable>
          </View>

          {!sentTo ? (
            <>
              <Text style={s.sheetSub}>We’ll text a 6-digit code to check it’s yours. Numbers without a country code use +91.</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="+91 98765 43210"
                placeholderTextColor={C.t3}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                autoComplete="tel"
                autoFocus
                style={s.input}
                onSubmitEditing={submitPhone}
              />
              <Pressable style={[s.primary, busy && s.primaryBusy]} disabled={busy} onPress={submitPhone} accessibilityRole="button">
                {busy ? <ActivityIndicator color={C.alwaysLight} /> : <Text style={s.primaryText}>Send code</Text>}
              </Pressable>
            </>
          ) : (
            <>
              <Text style={s.sheetSub}>Sent to {sentTo}.</Text>
              <CodeInput value={code} onChange={setCode} onComplete={verify} error={!!error} />
              <Pressable
                onPress={() => send(sentTo)}
                disabled={!policy.allowed || busy}
                style={s.resend}
                accessibilityRole="button"
              >
                <Text style={[s.resendText, (!policy.allowed || busy) && s.resendOff]}>
                  {policy.allowed ? 'Send a new code' : policy.resendsLeft === 0 ? 'No more codes for now' : `Send a new code in ${policy.waitSeconds}s`}
                </Text>
              </Pressable>
              {busy ? <ActivityIndicator color={C.red} style={{ marginTop: 8 }} /> : null}
            </>
          )}
          {error ? <Text style={s.error}>{error}</Text> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    loading:    { paddingVertical: 18, alignItems: 'center' },
    row:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: C.border },
    pressed:    { opacity: 0.7 },
    icon:       { width: 32, height: 32, borderRadius: 9, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
    iconAdd:    { backgroundColor: C.redLo },
    middle:     { flex: 1 },
    label:      { fontFamily: Fonts.regular, fontSize: 14, color: C.t1 },
    addLabel:   { flex: 1, fontFamily: Fonts.medium, color: C.red },
    detail:     { fontFamily: Fonts.regular, fontSize: 12, color: C.t3, marginTop: 2 },
    remove:     { fontFamily: Fonts.medium, fontSize: 13, color: C.red },
    linked:     { fontFamily: Fonts.medium, fontSize: 13, color: C.t3 },
    error:      { ...Type.caption, color: C.red, paddingHorizontal: 14, paddingTop: 10 },
    footnote:   { ...Type.caption, color: C.t3, paddingHorizontal: 14, paddingVertical: 12 },
    sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(12,12,13,0.35)' },
    sheet:      { backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.gutter, paddingBottom: 40, gap: 12 },
    sheetHead:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sheetTitle: { ...Type.title, color: C.t1 },
    sheetSub:   { ...Type.bodySm, color: C.t2 },
    input:      {
      height: 52, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
      paddingHorizontal: 16, fontFamily: Fonts.medium, fontSize: 17, color: C.t1,
    },
    primary:    { height: 52, borderRadius: 999, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' },
    primaryBusy:{ opacity: 0.6 },
    primaryText:{ fontFamily: Fonts.semiBold, fontSize: 16, color: C.alwaysLight },
    resend:     { alignItems: 'center', paddingVertical: 6 },
    resendText: { fontFamily: Fonts.medium, fontSize: 14, color: C.t1 },
    resendOff:  { color: C.t3 },
  });
}
