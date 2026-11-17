/**
 * Home's week strip (PRD daily mock B): Monday to Sunday of this week, today
 * in ink, a dot per planned session in its kind's colour, green when done.
 */
import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import { addDays, mondayOf, sessionOn, isMissed, type TrainingPlanV2, type Session } from '@shared/engine/training';
import { kindColor, KIND_LABEL } from '../sessionLook';

const LETTER = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const NAME = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function WeekStrip({ plan, today, onDay }: { plan: TrainingPlanV2; today: string; onDay: (session: Session | null) => void }) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const monday = mondayOf(today);
  return (
    <View style={s.strip}>
      {Array.from({ length: 7 }, (_, i) => {
        const d = addDays(monday, i);
        const x = sessionOn(plan, d);
        const isToday = d === today;
        const missed = x ? isMissed(x, today) : false;
        const color = !x || x.status === 'skipped' ? null : x.status === 'done' ? C.brandGreen : kindColor(C, x.kind);
        const state = !x ? 'rest' : x.status === 'done' ? 'done' : x.status === 'skipped' ? 'skipped' : missed ? 'missed' : 'planned';
        return (
          <Pressable
            key={d} style={[s.day, isToday && s.today]} onPress={() => onDay(x)} disabled={!x}
            accessibilityRole="button" accessibilityLabel={`${NAME[i]} ${+d.slice(8)}: ${x ? `${KIND_LABEL[x.kind]}, ${state}` : 'rest'}`}
          >
            <Text style={[s.letter, isToday && s.todayLetter]}>{LETTER[i]}</Text>
            <Text style={[s.num, isToday && s.todayNum]}>{+d.slice(8)}</Text>
            <View style={[s.dot, color ? { backgroundColor: color } : null, missed && s.missed]} />
          </Pressable>
        );
      })}
    </View>
  );
}

function mk(C: AppColors) {
  return StyleSheet.create({
    strip:       { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: C.card, borderRadius: 22, padding: 6 },
    day:         { flex: 1, alignItems: 'center', gap: 2, paddingTop: 6, paddingBottom: 7, borderRadius: 16 },
    today:       { backgroundColor: C.alwaysDark },
    letter:      { fontFamily: Fonts.semiBold, fontSize: 11, color: C.t3 },
    todayLetter: { color: 'rgba(255,255,255,0.65)' },
    num:         { fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1, fontVariant: ['tabular-nums'] },
    todayNum:    { color: C.alwaysLight },
    dot:         { width: 7, height: 7, borderRadius: 4, marginTop: 2 },
    missed:      { borderWidth: 1.5, borderColor: C.danger },
  });
}
