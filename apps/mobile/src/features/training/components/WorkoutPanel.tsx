/**
 * Workout mode on the live screen: the current step, what's left, the target
 * pace and whether you are on it, and what comes next.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import { fmtBand, fmtPace } from '@shared/engine/training';
import type { WorkoutView } from '../hooks/useWorkoutMode';

const fmtLeft = (r: { metres?: number; seconds?: number }) =>
  r.metres != null ? (r.metres >= 1000 ? `${(r.metres / 1000).toFixed(2)} km` : `${Math.round(r.metres)} m`)
  : r.seconds != null ? `${Math.floor(r.seconds / 60)}:${String(Math.round(r.seconds % 60)).padStart(2, '0')}` : '';

export default function WorkoutPanel({ view }: { view: WorkoutView }) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const { session, progress, status, stepPace } = view;

  if (progress.done) {
    return (
      <View style={[s.panel, { backgroundColor: C.greenLo }]}>
        <Text style={s.label}>{session.title}</Text>
        <Text style={s.big}>Session complete</Text>
        <Text style={s.sub}>Keep going or finish when you're ready.</Text>
      </View>
    );
  }

  const step = progress.step;
  const tone = status === 'slow' ? { bg: C.amberBg, fg: C.amber, word: 'Speed up' }
    : status === 'fast' ? { bg: C.blueBg, fg: C.blue, word: 'Ease off' }
    : status === 'on' ? { bg: C.greenLo, fg: C.green, word: 'On pace' } : null;

  return (
    <View style={s.panel} accessibilityLiveRegion="polite">
      <View style={s.top}>
        <Text style={s.label} numberOfLines={1}>Step {progress.index + 1} of {session.steps.length} · {session.title}</Text>
        {tone && <View style={[s.pill, { backgroundColor: tone.bg }]}><Text style={[s.pillTxt, { color: tone.fg }]}>{tone.word}</Text></View>}
      </View>
      <View style={s.mid}>
        <Text style={s.stepName} numberOfLines={1}>{step.label}</Text>
        <Text style={s.big}>{fmtLeft(progress.remaining)}</Text>
      </View>
      <Text style={s.sub} numberOfLines={1}>
        {step.pace ? `Target ${fmtBand(step.pace)}` : 'Easy jog'}
        {stepPace ? ` · you ${fmtPace(stepPace)}/km` : ''}
        {progress.next ? ` · next: ${progress.next.label}` : ''}
      </Text>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    panel:   { backgroundColor: C.surface, borderRadius: 14, padding: 12, marginBottom: 12 },
    top:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    label:   { flex: 1, fontFamily: Fonts.medium, fontSize: 12, color: C.t2 },
    pill:    { height: 22, paddingHorizontal: 9, borderRadius: 11, justifyContent: 'center' },
    pillTxt: { fontFamily: Fonts.semiBold, fontSize: 11.5 },
    mid:     { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6 },
    stepName:{ flex: 1, fontFamily: Fonts.semiBold, fontSize: 17, color: C.t1 },
    big:     { fontFamily: Fonts.numeric, fontSize: 26, color: C.t1, fontVariant: ['tabular-nums'] },
    sub:     { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, marginTop: 4 },
  });
}
