/**
 * PaceX's weekly check-in on the plan: what happened last week and the one
 * change it suggests. The runner decides; nothing changes until they tap.
 * Shown once per plan week, on Home's plan block and the plan screen.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { PaceXOrb } from '@mobile/shared/components/PaceXOrb';
import { useTheme, Fonts, type AppColors } from '@theme';
import { easeNextDays } from '@shared/engine/training';
import { reviewLastWeek } from '@shared/engine/planReview';
import { checkInAnswered, markCheckInAnswered, localToday, savePlan, type ActivePlan } from '../services/planService';

interface Props {
  ap: ActivePlan;
  /** Called with the changed plan after the runner accepts a change. */
  onChange: (next: ActivePlan) => void;
  style?: StyleProp<ViewStyle>;
}

export function WeekCheckIn({ ap, onChange, style }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const today = localToday();
  const review = useMemo(() => reviewLastWeek(ap.plan, today), [ap.plan, today]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let live = true;
    if (!review) { setOpen(false); return; }
    checkInAnswered(ap.id, review.weekStart).then(seen => { if (live) setOpen(!seen); });
    return () => { live = false; };
  }, [ap.id, review]);

  if (!review || !open) return null;

  const close = () => { setOpen(false); void markCheckInAnswered(ap.id, review.weekStart); };
  const ease = () => {
    const next = { ...ap, plan: easeNextDays(ap.plan, today) };
    onChange(next);
    void savePlan(next).catch(() => {});
    close();
  };

  return (
    <View style={[s.card, style]} accessibilityRole="summary">
      <View style={s.head}>
        <PaceXOrb size={22} />
        <Text style={s.eyebrow}>PaceX · weekly check-in</Text>
      </View>
      <Text style={s.body}>{review.reason}</Text>
      {review.suggestion === 'ease' ? (
        <View style={s.row}>
          <Pressable style={[s.btn, s.primary]} onPress={ease} accessibilityRole="button" accessibilityLabel="Ease this week">
            <Text style={s.primaryTxt}>Ease this week</Text>
          </Pressable>
          <Pressable style={[s.btn, s.ghost]} onPress={close} accessibilityRole="button" accessibilityLabel="Keep the plan">
            <Text style={s.ghostTxt}>Keep the plan</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={[s.btn, s.ghost, s.single]} onPress={close} accessibilityRole="button" accessibilityLabel="Got it">
          <Text style={s.ghostTxt}>Got it</Text>
        </Pressable>
      )}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card:    { backgroundColor: C.card, borderRadius: 22, padding: 16, gap: 10 },
    head:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
    eyebrow: { fontFamily: Fonts.semiBold, fontSize: 12.5, color: C.t2 },
    body:    { fontFamily: Fonts.regular, fontSize: 14.5, lineHeight: 20, color: C.t1 },
    row:     { flexDirection: 'row', gap: 10 },
    btn:     { flex: 1, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    single:  { flex: 0, alignSelf: 'flex-start', paddingHorizontal: 22 },
    primary: { backgroundColor: C.t1 },
    primaryTxt: { fontFamily: Fonts.semiBold, fontSize: 14, color: C.bg },
    ghost:   { borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
    ghostTxt: { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
  });
}
