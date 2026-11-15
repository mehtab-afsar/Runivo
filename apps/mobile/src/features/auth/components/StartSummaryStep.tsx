import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { RUNNING_GOALS } from '@shared/engine/onboarding';
import { RACE_LABEL } from '@shared/engine/training';
import { useTheme, Fonts, type AppColors } from '@theme';
import { mkStep } from './onboardingStyles';
import { NIGGLES, type OnboardingData } from '../types';
import type { StartPreview } from '../startPlan';

const DAY = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const DAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIME = { early: 'before 7', morning: 'mornings', evening: 'evenings', varies: 'any time' } as const;
const TONE = { encouraging: 'Encouraging', structured: 'Structured', competitive: 'Competitive', friendly: 'Friendly' } as const;

/** The last onboarding screen: PaceX sums up the answers and shows week 1. */
export default function StartSummaryStep({ data, preview, weeklyTargetKm, tone }: {
  data: OnboardingData; preview: StartPreview; weeklyTargetKm: number; tone: keyof typeof TONE;
}) {
  const C = useTheme();
  const s = useMemo(() => mkStep(C), [C]);
  const st = useMemo(() => mk(C), [C]);
  const name = data.username || 'there';
  const facts: [string, string][] = [
    ['Goal', preview.kind === 'plan'
      ? `${RACE_LABEL[preview.plan.race]}${preview.plan.goalSec ? ` · ${fmtClock(preview.plan.targetSec)}` : ''}`
      : RUNNING_GOALS.find(g => g.key === data.goal)?.label ?? 'Get fit'],
    ['Weekly start', `${preview.kind === 'plan' ? preview.plan.weeks[0].km : Math.round(weeklyTargetKm * (preview.cautious ? 0.8 : 1))} km`],
    ['Run days', data.runDays.map(d => DAY_LONG[d].slice(0, 3)).join(', ') || '—'],
    ['Long run', `${DAY_LONG[data.longRunDay]}${data.usualTime ? `, ${TIME[data.usualTime]}` : ''}`],
    ...(data.niggles.length ? [['Watch out for', data.niggles.map(n => NIGGLES.find(x => x.key === n)?.label).join(', ')] as [string, string]] : []),
    ['PaceX voice', TONE[tone]],
  ];
  const headline = preview.kind === 'plan'
    ? `${RACE_LABEL[preview.plan.race]} on ${new Date(`${preview.plan.raceDate}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}, ${preview.plan.weeks.length} weeks of training.${preview.plan.goalCapped ? ' Your goal is ambitious, so PaceX aims a little slower for now.' : ''}`
    : 'A first week built from your answers. Every run you log tunes it.';

  return (
    <ScrollView contentContainerStyle={s.content}>
      <View style={st.coach}><View style={st.orb} /><Text style={st.coachName}>PaceX</Text></View>
      <Text style={[s.title, { fontSize: 30, lineHeight: 34 }]}>Here's your start, {name}.</Text>
      <Text style={s.sub}>{headline}{preview.cautious ? ' Gentle on the body to begin with.' : ''}</Text>

      <View style={st.card}>
        {facts.map(([k, v], i) => (
          <View key={k} style={[st.fact, i === facts.length - 1 && { borderBottomWidth: 0 }]}>
            <Text style={st.k}>{k}</Text><Text style={st.v} numberOfLines={1}>{v}</Text>
          </View>
        ))}
      </View>

      <View style={[st.card, { marginTop: 12, paddingVertical: 12 }]}>
        <Text style={st.weekTitle}>Week 1</Text>
        {preview.week1.map(d => (
          <View key={`${d.day}-${d.label}`} style={st.day}>
            <Text style={st.dayName}>{DAY[d.day]}</Text>
            <View style={[st.bar, { backgroundColor: d.kind === 'long' ? C.lime : d.kind === 'hard' ? C.amberBg : C.mint2 }]} />
            <View style={{ flex: 1 }}>
              <Text style={st.dayLabel}>{d.label}</Text>
              <Text style={st.dayDetail} numberOfLines={2}>{d.detail}</Text>
            </View>
          </View>
        ))}
      </View>
      {preview.kind === 'week' && preview.planNote && <Text style={s.note}>{preview.planNote}</Text>}
      <Text style={s.note}>Every run you log updates this: faster runs speed up your targets, missed days get moved, and "Not feeling 100%" eases the week.</Text>
    </ScrollView>
  );
}

function fmtClock(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.round(sec % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

function mk(C: AppColors) {
  return StyleSheet.create({
    coach:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    orb:       { width: 40, height: 40, borderRadius: 20, backgroundColor: '#9D94E6', borderWidth: 6, borderColor: '#C9C2F6' },
    coachName: { fontFamily: Fonts.semiBold, fontSize: 14, color: C.lavenderInk },
    card:      { backgroundColor: C.card, borderRadius: 22, paddingHorizontal: 16 },
    fact:      { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
    k:         { fontFamily: Fonts.regular, fontSize: 14, color: C.t2 },
    v:         { flexShrink: 1, fontFamily: Fonts.medium, fontSize: 14, color: C.t1, textAlign: 'right' },
    weekTitle: { fontFamily: Fonts.semiBold, fontSize: 17, color: C.t1, marginBottom: 6 },
    day:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 7 },
    dayName:   { width: 38, fontFamily: Fonts.semiBold, fontSize: 12, color: C.t2 },
    bar:       { width: 8, height: 34, borderRadius: 4 },
    dayLabel:  { fontFamily: Fonts.medium, fontSize: 15, color: C.t1 },
    dayDetail: { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, marginTop: 1 },
  });
}
