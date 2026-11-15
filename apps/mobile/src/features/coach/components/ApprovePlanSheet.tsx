/**
 * PaceX → "Approve this plan": PaceX proposes a plan from what the runner told
 * it; they approve it, or change the details in the plan builder. Nothing is
 * saved until they approve.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import { RACE_LABEL, fmtPace, hardKm } from '@shared/engine/training';
import { createPlan, localToday } from '@features/training/services/planService';
import { loadPlanAnswers, proposePlan, type PlanProposal } from '../services/planFromProfile';

const DAY = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const NEEDS: Record<Exclude<PlanProposal, { kind: 'plan' }>['reason'], { title: string; body: string }> = {
  race:     { title: 'Which race are you training for?', body: 'Tell PaceX the distance and the date, and it builds the plan around them.' },
  past:     { title: 'That race has been and gone', body: 'Pick your next race and PaceX builds a new plan.' },
  five_k:   { title: 'PaceX needs a recent 5K time', body: 'It sets every target pace from it. A guess is fine; your runs correct it.' },
  days:     { title: 'Pick 3 to 5 run days', body: 'Including your long-run day, so PaceX can place the sessions.' },
  too_soon: { title: 'That race is too close for a full plan', body: 'Pick a later race or a shorter distance.' },
};

export function ApprovePlanSheet({ onApproved, onChangeDetails }: {
  onApproved: () => void;
  /** Open the plan builder (with the race prefilled when known). */
  onChangeDetails: (race?: string) => void;
}) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const [proposal, setProposal] = useState<PlanProposal | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPlanAnswers()
      .then(a => setProposal(a ? proposePlan(a, localToday()) : { kind: 'needs', reason: 'race' }))
      .catch(() => setProposal({ kind: 'needs', reason: 'race' }));
  }, []);

  if (!proposal) return <ActivityIndicator color={C.t2} style={{ marginTop: 40 }} />;

  if (proposal.kind === 'needs') {
    const n = NEEDS[proposal.reason];
    return (
      <View style={s.wrap}>
        <View style={s.orbRow}><View style={s.orb} /><Text style={s.orbName}>PaceX</Text></View>
        <Text style={s.title}>{n.title}</Text>
        <Text style={s.body}>{proposal.reason === 'too_soon' && proposal.minWeeks ? `${n.body} This distance needs at least ${proposal.minWeeks} weeks.` : n.body}</Text>
        <Pressable style={s.primary} onPress={() => onChangeDetails()} accessibilityRole="button">
          <Text style={s.primaryTxt}>Set up my plan</Text>
        </Pressable>
      </View>
    );
  }

  const { plan, cautious } = proposal;
  const w1 = plan.weeks[0];
  const peak = Math.max(...plan.weeks.map(w => w.km));
  const hardPct = Math.round((plan.weeks.reduce((t, w) => t + w.sessions.reduce((n, x) => n + hardKm(x), 0), 0) / plan.weeks.reduce((t, w) => t + w.km, 0)) * 100);
  const date = new Date(`${plan.raceDate}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' });

  const approve = async () => {
    setSaving(true); setError('');
    try { await createPlan(plan); onApproved(); }
    catch { setError("Couldn't save the plan. Check your connection and try again."); }
    finally { setSaving(false); }
  };

  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <View style={s.orbRow}><View style={s.orb} /><Text style={s.orbName}>PaceX</Text></View>
      <Text style={s.title}>{RACE_LABEL[plan.race]} plan, {plan.weeks.length} weeks</Text>
      <Text style={s.body}>
        Race day {date}. Target {fmtClock(plan.targetSec)} ({fmtPace(plan.targetSec / raceKm(plan.race))} /km)
        {plan.goalCapped ? ', a little slower than your goal for now: your 5K says that is the safe target, and faster runs raise it.' : '.'}
        {cautious ? ' Built gently for your niggle: lower start, slower growth, fewer hard days.' : ''}
      </Text>

      <View style={s.stats}>
        <Stat label="Week 1" value={`${w1.km} km`} s={s} />
        <Stat label="Peak week" value={`${peak} km`} s={s} />
        <Stat label="Hard running" value={`${hardPct}%`} s={s} />
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Week 1</Text>
        {w1.sessions.map(se => {
          const d = (new Date(`${se.date}T00:00:00Z`).getUTCDay() + 6) % 7;
          const hard = se.kind === 'tempo' || se.kind === 'intervals';
          return (
            <View key={se.id} style={s.row}>
              <Text style={s.day}>{DAY[d]}</Text>
              <View style={[s.bar, { backgroundColor: se.kind === 'long' ? C.lime : hard ? C.amberBg : C.mint2 }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.sess}>{se.title}</Text>
                <Text style={s.sessSub} numberOfLines={2}>{se.summary}</Text>
              </View>
            </View>
          );
        })}
      </View>
      <Text style={s.note}>Weekly distance grows at most {cautious ? '6' : '10'}% a week, every fourth week is lighter, and there's a taper before race day. Your runs keep it honest: faster runs speed up your targets.</Text>

      {!!error && <Text style={s.error}>{error}</Text>}
      <Pressable style={s.primary} onPress={approve} disabled={saving} accessibilityRole="button">
        {saving ? <ActivityIndicator color={C.alwaysLight} /> : <Text style={s.primaryTxt}>Approve this plan</Text>}
      </Pressable>
      <Pressable style={s.secondary} onPress={() => onChangeDetails(plan.race)} accessibilityRole="button">
        <Text style={s.secondaryTxt}>Change the details</Text>
      </Pressable>
    </ScrollView>
  );
}

function Stat({ label, value, s }: { label: string; value: string; s: ReturnType<typeof mk> }) {
  return <View style={s.stat}><Text style={s.statLabel}>{label}</Text><Text style={s.statVal}>{value}</Text></View>;
}
const raceKm = (r: string) => ({ '5k': 5, '10k': 10, half: 21.0975, marathon: 42.195 } as Record<string, number>)[r] ?? 10;
function fmtClock(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), x = Math.round(sec % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`;
}

function mk(C: AppColors) {
  return StyleSheet.create({
    wrap:      { padding: 20, gap: 14, paddingBottom: 60 },
    orbRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
    orb:       { width: 36, height: 36, borderRadius: 18, backgroundColor: '#9D94E6', borderWidth: 5, borderColor: '#C9C2F6' },
    orbName:   { fontFamily: Fonts.semiBold, fontSize: 14, color: C.lavenderInk },
    title:     { fontFamily: Fonts.semiBold, fontSize: 26, letterSpacing: -0.6, color: C.t1 },
    body:      { fontFamily: Fonts.regular, fontSize: 15, lineHeight: 22, color: C.t2 },
    stats:     { flexDirection: 'row', gap: 8 },
    stat:      { flex: 1, borderRadius: 18, backgroundColor: C.card, padding: 12 },
    statLabel: { fontFamily: Fonts.regular, fontSize: 12, color: C.t2 },
    statVal:   { fontFamily: Fonts.numeric, fontSize: 20, color: C.t1, marginTop: 2 },
    card:      { backgroundColor: C.card, borderRadius: 22, padding: 16, gap: 4 },
    cardTitle: { fontFamily: Fonts.semiBold, fontSize: 17, color: C.t1, marginBottom: 4 },
    row:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
    day:       { width: 36, fontFamily: Fonts.semiBold, fontSize: 12, color: C.t2 },
    bar:       { width: 8, height: 34, borderRadius: 4 },
    sess:      { fontFamily: Fonts.medium, fontSize: 15, color: C.t1 },
    sessSub:   { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, marginTop: 1 },
    note:      { fontFamily: Fonts.regular, fontSize: 12, lineHeight: 17, color: C.t2 },
    error:     { fontFamily: Fonts.medium, fontSize: 13, color: C.danger },
    primary:   { height: 56, borderRadius: 28, backgroundColor: C.alwaysDark, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
    primaryTxt:{ fontFamily: Fonts.semiBold, fontSize: 16, color: C.alwaysLight },
    secondary: { height: 48, alignItems: 'center', justifyContent: 'center' },
    secondaryTxt: { fontFamily: Fonts.medium, fontSize: 15, color: C.t1 },
  });
}
