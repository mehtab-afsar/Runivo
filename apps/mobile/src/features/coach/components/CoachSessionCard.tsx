// PaceX chat · session card (mock PaceXChat): title, day and time, steps, "Add to my plan".
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { fmtBand, type Session, type Step } from '@shared/engine/training';
import { appleWatchSupported, sendToAppleWatch, sendToGarmin } from '@features/training/services/sendToWatch';
import type { CoachSession } from '@shared/engine/coachSession';
import { addCoachSessionToPlan } from '@features/training/services/planService';
import { useTheme, Fonts, type AppColors } from '@theme';

const km = (m: number) => (m >= 1000 ? `${Math.round(m / 100) / 10} km` : `${Math.round(m)} m`);

function stepDetail(st: Step): string {
  if (st.pace) return fmtBand(st.pace).replace('/km', ' /km');
  const base = st.distanceM ? km(st.distanceM) : st.durationSec ? `${Math.round(st.durationSec / 60)} min` : '';
  const feel = st.kind === 'warmup' || st.kind === 'cooldown' ? 'easy' : st.kind === 'recover' ? 'jog' : '';
  return [base, feel].filter(Boolean).join(st.kind === 'recover' ? ' ' : ' · ');
}

export function CoachSessionCard({ session }: { session: CoachSession }) {
  const C = useTheme();
  const s = useMemo(() => styles(C), [C]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [state, setState] = useState<'idle' | 'busy' | 'added' | 'no_plan' | 'outside' | 'error'>('idle');
  const [added, setAdded] = useState<Session | null>(null);
  const [appleOk, setAppleOk] = useState(false);
  useEffect(() => { appleWatchSupported().then(setAppleOk).catch(() => {}); }, []);

  const day = new Date(`${session.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
  const bar = (k: Step['kind']) => (k === 'run' ? C.rivalAmber : k === 'recover' ? C.lavender : C.mint2);

  const add = async () => {
    setState('busy');
    try {
      const r = await addCoachSessionToPlan(session);
      if (r.status === 'added') setAdded(r.session);
      setState(r.status);
    } catch { setState('error'); }
  };

  // Apple Watch when this iPhone supports it; otherwise Garmin (needs the session in the plan).
  const sendToWatch = async () => {
    const target = added;
    if (!target) return;
    const r = appleOk ? await sendToAppleWatch(target) : await sendToGarmin(target);
    Alert.alert(r.title, r.message);
  };

  const note =
    state === 'added'   ? 'Added. It’s in your plan for ' + day + '.'
    : state === 'no_plan' ? 'You don’t have a plan yet.'
    : state === 'outside' ? 'That day is outside your current plan.'
    : state === 'error'   ? 'Couldn’t add it. Try again.'
    : null;

  return (
    <View style={s.card}>
      <View style={s.head}>
        <Text style={s.title} numberOfLines={1}>{session.title} · {session.distanceKm} km</Text>
        <Text style={s.when}>{day}{session.durationMin ? ` · ${session.durationMin} min` : ''}</Text>
      </View>
      <View style={s.steps}>
        {session.steps.map((st, i) => (
          <View key={i} style={s.step}>
            <View style={[s.bar, { backgroundColor: bar(st.kind) }]} />
            <Text style={s.stepLabel} numberOfLines={1}>{st.label}</Text>
            <Text style={s.stepDetail}>{stepDetail(st)}</Text>
          </View>
        ))}
      </View>
      {state === 'no_plan' ? (
        <Pressable style={s.btn} onPress={() => navigation.navigate('TrainingPlan')} accessibilityRole="button">
          <Text style={s.btnText}>Make a plan</Text>
        </Pressable>
      ) : (
        <View style={s.btnRow}>
          <Pressable style={[s.btn, { flex: 1 }, state === 'added' && s.btnDone]} onPress={add} disabled={state === 'busy' || state === 'added'} accessibilityRole="button">
            {state === 'busy' ? <ActivityIndicator color={C.alwaysLight} /> : (
              <Text style={[s.btnText, state === 'added' && { color: C.t1 }]}>{state === 'added' ? 'In your plan ✓' : 'Add to my plan'}</Text>
            )}
          </Pressable>
          {added && (
            <Pressable style={s.ghost} onPress={sendToWatch} accessibilityRole="button">
              <Text style={s.ghostText}>Send to watch</Text>
            </Pressable>
          )}
        </View>
      )}
      {note && <Text style={[s.note, state === 'error' && { color: C.danger }]}>{note}</Text>}
    </View>
  );
}

const styles = (C: AppColors) => StyleSheet.create({
  card:       { backgroundColor: C.card, borderRadius: 22, padding: 14, gap: 10, borderWidth: 1.5, borderColor: C.lavender, marginTop: 8 },
  head:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  title:      { flex: 1, fontFamily: Fonts.semiBold, fontSize: 16, color: C.t1 },
  when:       { fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
  steps:      { gap: 6 },
  step:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bar:        { width: 8, height: 28, borderRadius: 4 },
  stepLabel:  { flex: 1, fontFamily: Fonts.regular, fontSize: 14, color: C.t1 },
  stepDetail: { fontFamily: Fonts.regular, fontSize: 14, color: C.t2 },
  btn:        { height: 44, borderRadius: 22, backgroundColor: C.alwaysDark, alignItems: 'center', justifyContent: 'center' },
  btnDone:    { backgroundColor: C.mint },
  btnRow:     { flexDirection: 'row', gap: 8 },
  ghost:      { height: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  ghostText:  { fontFamily: Fonts.regular, fontSize: 15, color: C.t1 },
  btnText:    { fontFamily: Fonts.medium, fontSize: 15, color: C.alwaysLight },
  note:       { fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
});
