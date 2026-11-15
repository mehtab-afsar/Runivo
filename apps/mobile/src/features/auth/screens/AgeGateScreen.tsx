import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@shared/services/supabase';
import { ageGateOutcome } from '@shared/engine/onboarding';
import { clearAllLocalData } from '@shared/services/store';
import { useTheme, Fonts, Type, type AppColors } from '@theme';

/**
 * Shown once to every signed-in account that has not passed it yet, whatever
 * method they signed in with. Neutral by design: it asks for a birth month and
 * year, not "are you 13?", and only the outcome is stored, never the date.
 *  - under 13: not allowed in; the account made a moment ago is deleted.
 *  - 13 to 17: allowed, starting private (profile private, live sharing off).
 *  - 18+: allowed.
 */
export default function AgeGateScreen({ userId, onConfirmed }: { userId: string; onConfirmed: () => void }) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState(false);

  const submit = async () => {
    const outcome = ageGateOutcome(Number(month), Number(year));
    if (outcome === 'invalid') { setError('Enter your birth month (1 to 12) and year.'); return; }
    if (outcome === 'under13') { setBlocked(true); return; }
    setBusy(true);
    setError('');
    const patch: Record<string, unknown> = { age_confirmed_at: new Date().toISOString() };
    if (outcome === 'teen') {
      // A safer start for 13 to 17: not findable by strangers, not sharing a live position.
      Object.assign(patch, { age_range: 'under_18', profile_visibility: 'private', live_run_sharing_enabled: false });
    }
    const { error: err } = await supabase.from('profiles').update(patch).eq('id', userId);
    setBusy(false);
    if (err) { setError("Couldn't save that. Check your connection and try again."); return; }
    onConfirmed();
  };

  const deleteAccount = async () => {
    setBusy(true);
    const { error: err } = await supabase.functions.invoke('delete-account', { body: {} });
    if (err) { setBusy(false); Alert.alert("Couldn't delete the account", 'Check your connection and try again, or email support@runivo.com.'); return; }
    await supabase.auth.signOut().catch(() => {});
    await clearAllLocalData().catch(() => {});
    setBusy(false);
  };

  if (blocked) {
    return (
      <View style={[s.root, { paddingTop: insets.top + 40 }]}>
        <Text style={s.title}>Runivo is for runners 13 and over</Text>
        <Text style={s.body}>We can't create an account for you. We will delete the one that was just made, and we keep nothing.</Text>
        <Pressable style={[s.primary, busy && { opacity: 0.6 }]} onPress={deleteAccount} disabled={busy} accessibilityRole="button">
          {busy ? <ActivityIndicator color={C.bg} /> : <Text style={s.primaryTxt}>Delete this account</Text>}
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[s.root, { paddingTop: insets.top + 40 }]}>
        <Text style={s.title}>When were you born?</Text>
        <Text style={s.body}>Runivo has age limits to keep everyone safe. We use this once to check, and we don't keep your birth date.</Text>
        <View style={s.row}>
          <TextInput style={[s.input, { width: 90 }]} value={month} onChangeText={t => setMonth(t.replace(/\D/g, '').slice(0, 2))}
            placeholder="MM" placeholderTextColor={C.t3} keyboardType="number-pad" maxLength={2}
            accessibilityLabel="Birth month, two digits" returnKeyType="next" />
          <TextInput style={[s.input, { width: 130 }]} value={year} onChangeText={t => setYear(t.replace(/\D/g, '').slice(0, 4))}
            placeholder="YYYY" placeholderTextColor={C.t3} keyboardType="number-pad" maxLength={4}
            accessibilityLabel="Birth year, four digits" returnKeyType="done" onSubmitEditing={submit} />
        </View>
        {!!error && <Text style={s.error}>{error}</Text>}
        <Pressable style={[s.primary, (busy || month.length === 0 || year.length < 4) && { opacity: 0.5 }]}
          onPress={submit} disabled={busy || month.length === 0 || year.length < 4} accessibilityRole="button">
          {busy ? <ActivityIndicator color={C.bg} /> : <Text style={s.primaryTxt}>Continue</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:       { flex: 1, backgroundColor: C.bg, paddingHorizontal: 24 },
    title:      { ...Type.displaySm, color: C.t1, marginBottom: 12 },
    body:       { fontFamily: Fonts.regular, fontSize: 15, lineHeight: 22, color: C.t2, marginBottom: 24 },
    row:        { flexDirection: 'row', gap: 12 },
    input:      { height: 52, borderRadius: 22, backgroundColor: C.card, paddingHorizontal: 16, fontFamily: Fonts.semiBold, fontSize: 18, color: C.t1 },
    error:      { fontFamily: Fonts.regular, fontSize: 13.5, color: C.red, marginTop: 12 },
    primary:    { height: 52, borderRadius: 14, backgroundColor: C.t1, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
    primaryTxt: { fontFamily: Fonts.semiBold, fontSize: 16, color: C.bg },
  });
}
