/** Plan preview (PRD mock 8): length, peak week, target, the weekly shape and week 1. */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import { fmtDuration, weekday, type TrainingPlanV2 } from '@shared/engine/training';
import { kindColor } from '../sessionLook';
import { fmtRaceDate } from '../services/raceService';

const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function PreviewStep({ plan, today }: { plan: TrainingPlanV2; today: string }) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const peak = Math.max(...plan.weeks.map(w => w.km));
  const first = plan.weeks[0];
  const startsLater = first.startDate > today && (Date.parse(first.startDate) - Date.parse(today)) / 86400e3 > 7;
  const showTarget = plan.goal !== 'start' && plan.goal !== 'return';

  return (
    <View style={{ gap: 12 }}>
      <View style={s.stats}>
        <Stat s={s} label="Weeks" value={String(plan.weeks.length)} />
        <Stat s={s} label="Peak week" value={`${Math.round(peak)} km`} />
        {showTarget
          ? <Stat s={s} label="Target" value={fmtDuration(plan.targetSec)} />
          : <Stat s={s} label="Days a week" value={String(plan.runDays.length)} />}
      </View>

      <View style={s.card}>
        <Text style={s.label}>Weekly distance</Text>
        <View style={s.bars}>
          {plan.weeks.map(w => (
            <View key={w.index} style={[s.bar, {
              height: `${Math.max(8, (w.km / peak) * 100)}%`,
              backgroundColor: w.focus === 'race' ? C.t1 : w.focus === 'taper' || w.focus === 'recovery' ? C.mint2 : C.brandGreen,
            }]} />
          ))}
        </View>
        <Text style={s.small}>Lighter weeks every fourth week, then a taper before {plan.goal === 'race' ? 'race day' : 'the last week'}.</Text>
      </View>

      <View style={s.card}>
        <Text style={s.label}>Week 1 · from {fmtRaceDate(first.startDate)}</Text>
        {first.sessions.map(se => (
          <View key={se.id} style={s.row}>
            <Text style={s.day}>{DAY[weekday(se.date)]}</Text>
            <View style={[s.tick, { backgroundColor: kindColor(C, se.kind) }]} />
            <Text style={s.title} numberOfLines={1}>{se.title}</Text>
            {!/\d km\b/.test(se.title) && <Text style={s.km}>{se.distanceKm} km</Text>}
          </View>
        ))}
      </View>

      {startsLater && <Text style={s.note}>Your race is a while away, so the plan starts on {fmtRaceDate(first.startDate)}. Keep running easy until then.</Text>}
      {plan.goalCapped && <Text style={s.note}>Your goal is faster than your current fitness suggests, so the plan aims for {fmtDuration(plan.targetSec)} to keep training safe.</Text>}
    </View>
  );
}

function Stat({ s, label, value }: { s: ReturnType<typeof mk>; label: string; value: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.small}>{label}</Text>
      <Text style={s.statVal} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

function mk(C: AppColors) {
  return StyleSheet.create({
    stats:   { flexDirection: 'row', gap: 8 },
    stat:    { flex: 1, backgroundColor: C.card, borderRadius: 18, padding: 14 },
    statVal: { fontFamily: Fonts.semiBold, fontSize: 22, letterSpacing: -0.5, color: C.t1, marginTop: 2, fontVariant: ['tabular-nums'] },
    card:    { backgroundColor: C.card, borderRadius: 22, padding: 16, gap: 8 },
    label:   { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
    small:   { fontFamily: Fonts.regular, fontSize: 12.5, color: C.t2 },
    bars:    { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 80 },
    bar:     { flex: 1, borderRadius: 3 },
    row:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 3 },
    day:     { width: 34, fontFamily: Fonts.semiBold, fontSize: 13, color: C.t2 },
    tick:    { width: 4, height: 22, borderRadius: 2 },
    title:   { flex: 1, fontFamily: Fonts.medium, fontSize: 14, color: C.t1 },
    km:      { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, fontVariant: ['tabular-nums'] },
    note:    { fontFamily: Fonts.regular, fontSize: 13, lineHeight: 18, color: C.lavenderInk, backgroundColor: C.lavender, borderRadius: 16, padding: 12 },
  });
}
