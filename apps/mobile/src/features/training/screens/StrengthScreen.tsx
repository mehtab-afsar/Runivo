/**
 * T8: strength and mobility library. Pick a session, then a guided timer
 * walks you through each move with a countdown, a haptic at each change and
 * the next move shown underneath.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from '@theme/hapticsGated';
import { CaretLeft, Barbell, PersonSimpleTaiChi, Pause, Play, SkipForward } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import { STRENGTH_SESSIONS, type StrengthSession } from '@shared/engine/strength';

export default function StrengthScreen() {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [active, setActive] = useState<StrengthSession | null>(null);

  if (active) return <Guided session={active} onDone={() => setActive(null)} />;

  return (
    <View style={s.root}>
      <View style={[s.top, { paddingTop: insets.top + 6 }]}>
        <Pressable style={s.back} hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }} onPress={() => navigation.goBack()} accessibilityLabel="Back"><CaretLeft size={20} color={C.t1} weight="bold" /></Pressable>
        <Text style={s.title}>Strength and mobility</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: 60 }}>
        <Text style={s.intro}>Short sessions that make runners harder to injure. Two strength sessions a week alongside your runs is plenty.</Text>
        {STRENGTH_SESSIONS.map(x => {
          const Icon = x.focus === 'strength' ? Barbell : PersonSimpleTaiChi;
          return (
            <Pressable key={x.id} style={s.card} onPress={() => setActive(x)} accessibilityRole="button">
              <View style={s.icon}><Icon size={20} color={C.t1} /></View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.cardTitle}>{x.title}</Text>
                <Text style={s.cardSub}>{x.minutes} min · {x.focus === 'strength' ? 'Strength' : 'Mobility'} · no equipment</Text>
                <Text style={s.blurb}>{x.blurb}</Text>
              </View>
              <Play size={16} color={C.red} weight="fill" />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function Guided({ session, onDone }: { session: StrengthSession; onDone: () => void }) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const insets = useSafeAreaInsets();
  const [i, setI] = useState(-1); // -1 = get ready
  const [left, setLeft] = useState(5);
  const [paused, setPaused] = useState(false);
  const step = i >= 0 ? session.steps[i] : null;
  const next = session.steps[i + 1];
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (paused) return;
    timer.current = setInterval(() => setLeft(l => l - 1), 1000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [paused]);

  useEffect(() => {
    if (left > 0) { if (left <= 3) Haptics.selectionAsync(); return; }
    if (i + 1 >= session.steps.length) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPaused(true);
      setI(session.steps.length);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setI(i + 1);
    setLeft(session.steps[i + 1].seconds);
  }, [left]); // eslint-disable-line react-hooks/exhaustive-deps

  const finished = i >= session.steps.length;
  const total = session.steps.length;
  return (
    <View style={[s.root, { paddingTop: insets.top + 6 }]}>
      <View style={s.top}>
        <Pressable style={s.back} hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }} onPress={onDone} accessibilityLabel="Stop"><CaretLeft size={20} color={C.t1} weight="bold" /></Pressable>
        <Text style={s.title}>{session.title}</Text>
        <Text style={s.cardSub}>{Math.min(Math.max(i + 1, 0), total)}/{total}</Text>
      </View>
      <View style={s.guided}>
        {finished ? (
          <>
            <Text style={s.big}>Done</Text>
            <Text style={s.cue}>{session.minutes} minutes in the bank. Nice work.</Text>
            <Pressable style={s.cta} onPress={onDone} accessibilityRole="button"><Text style={s.ctaTxt}>Finish</Text></Pressable>
          </>
        ) : (
          <>
            <Text style={[s.stepName, step?.rest && { color: C.t2 }]}>{step ? step.name : 'Get ready'}</Text>
            <Text style={s.big}>{left}</Text>
            <Text style={s.cue}>{step ? step.cue : session.steps[0].cue}</Text>
            {(next || i === -1) && <Text style={s.next}>Next: {(i === -1 ? session.steps[0] : next)!.name}</Text>}
            <View style={s.controls}>
              <Pressable style={s.ctrl} onPress={() => setPaused(p => !p)} accessibilityLabel={paused ? 'Resume' : 'Pause'}>
                {paused ? <Play size={22} color={C.bg} weight="fill" /> : <Pause size={22} color={C.bg} weight="fill" />}
              </Pressable>
              <Pressable style={[s.ctrl, { backgroundColor: C.surface }]} onPress={() => setLeft(0)} accessibilityLabel="Skip">
                <SkipForward size={22} color={C.t1} weight="fill" />
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

function mk(C: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    top: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 6 },
    back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    title: { flex: 1, fontFamily: Fonts.bold, fontSize: 20, color: C.t1 },
    intro: { fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
    card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 22, padding: 16 },
    icon: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
    cardTitle: { fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1 },
    cardSub: { fontFamily: Fonts.medium, fontSize: 12, color: C.t2 },
    blurb: { fontFamily: Fonts.regular, fontSize: 12.5, color: C.t2 },
    guided: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 12 },
    stepName: { fontFamily: Fonts.bold, fontSize: 24, color: C.t1, textAlign: 'center' },
    big: { fontFamily: Fonts.numeric, fontSize: 120, color: C.t1 },
    cue: { fontFamily: Fonts.medium, fontSize: 15, color: C.t2, textAlign: 'center' },
    next: { fontFamily: Fonts.regular, fontSize: 13, color: C.t3, marginTop: 6 },
    controls: { flexDirection: 'row', gap: 16, marginTop: 24 },
    ctrl: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.t1, alignItems: 'center', justifyContent: 'center' },
    cta: { marginTop: 20, height: 50, paddingHorizontal: 40, borderRadius: 25, backgroundColor: C.t1, justifyContent: 'center' },
    ctaTxt: { fontFamily: Fonts.semiBold, fontSize: 15, color: C.bg },
  });
}
