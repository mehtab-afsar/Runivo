// Search · "Invite friends · get 50 PACE each" (mock Search).
// Tap shares your invite code. New runners can type a friend's code here too;
// both get 50 PACE when the new runner finishes their first 1 km+ run
// (server: my_referral_code / redeem_referral, migration 20261117000003).
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, Share, StyleSheet, ActivityIndicator } from 'react-native';
import { Gift } from 'phosphor-react-native';
import { supabase } from '@shared/services/supabase';
import { useTheme, Fonts, type AppColors } from '@theme';

const REDEEM_TEXT: Record<string, string> = {
  ok: 'Code added. You both get 50 PACE after your first 1 km run.',
  invalid: "That code doesn't exist. Check it and try again.",
  own_code: "That's your own code. Share it with a friend instead.",
  too_late: 'Invite codes work in your first 14 days only.',
  already: "You've already used an invite code.",
  blocked: "That code can't be used.",
};

export function InviteRow() {
  const C = useTheme();
  const s = useMemo(() => styles(C), [C]);
  const [busy, setBusy] = useState(false);
  const [entering, setEntering] = useState(false);
  const [code, setCode] = useState('');
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);

  const share = async () => {
    setBusy(true);
    setNote(null);
    const { data, error } = await supabase.rpc('my_referral_code');
    setBusy(false);
    if (error || typeof data !== 'string') {
      setNote({ text: "Couldn't get your invite code. Try again.", ok: false });
      return;
    }
    await Share.share({
      message: `Run with me on Runivo and claim the streets around you. Use my code ${data} when you join and we both get 50 PACE. https://runivo.app/invite?code=${data}`,
    }).catch(() => {});
  };

  const redeem = async () => {
    const c = code.trim();
    if (c.length < 6) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('redeem_referral', { p_code: c });
    setBusy(false);
    const key = error ? '' : String(data);
    setNote({ text: REDEEM_TEXT[key] ?? "Couldn't add that code. Try again.", ok: key === 'ok' });
    if (key === 'ok') { setEntering(false); setCode(''); }
  };

  return (
    <View style={s.wrap}>
      <Pressable style={s.row} onPress={share} disabled={busy} accessibilityRole="button" accessibilityLabel="Invite friends, get 50 PACE each">
        <Gift size={22} color={C.t1} weight="regular" />
        <Text style={s.label}>Invite friends · get 50 PACE each</Text>
        {busy && <ActivityIndicator size="small" color={C.t2} />}
      </Pressable>
      {entering ? (
        <View style={s.codeRow}>
          <TextInput
            style={s.input}
            value={code}
            onChangeText={t => setCode(t.toUpperCase())}
            placeholder="Friend's code"
            placeholderTextColor={C.t3}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
            onSubmitEditing={redeem}
            accessibilityLabel="Friend's invite code"
          />
          <Pressable style={s.addBtn} onPress={redeem} disabled={busy} accessibilityRole="button">
            <Text style={s.addText}>Add</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={() => { setEntering(true); setNote(null); }} hitSlop={8} accessibilityRole="button">
          <Text style={s.link}>Got a code from a friend?</Text>
        </Pressable>
      )}
      {note && <Text style={[s.note, { color: note.ok ? C.green : C.danger }]}>{note.text}</Text>}
    </View>
  );
}

const styles = (C: AppColors) => StyleSheet.create({
  wrap:    { paddingHorizontal: 20, gap: 8, marginBottom: 14 },
  row:     { height: 52, borderRadius: 18, backgroundColor: C.card, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 },
  label:   { flex: 1, fontFamily: Fonts.regular, fontSize: 15, color: C.t1 },
  link:    { fontFamily: Fonts.medium, fontSize: 13, color: C.t2, paddingHorizontal: 4 },
  codeRow: { flexDirection: 'row', gap: 8 },
  input:   { flex: 1, height: 44, borderRadius: 14, backgroundColor: C.card, paddingHorizontal: 14, fontFamily: Fonts.medium, fontSize: 15, letterSpacing: 1.5, color: C.t1 },
  addBtn:  { height: 44, paddingHorizontal: 18, borderRadius: 22, backgroundColor: C.t1, alignItems: 'center', justifyContent: 'center' },
  addText: { fontFamily: Fonts.medium, fontSize: 14, color: C.bg },
  note:    { fontFamily: Fonts.regular, fontSize: 13, paddingHorizontal: 4 },
});
