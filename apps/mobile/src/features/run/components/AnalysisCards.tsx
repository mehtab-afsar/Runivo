/**
 * Run summary analysis:
 *   A5 "Same route": earlier efforts on this route, your place, vs last time
 *   A6 "Planned vs actual": when the run counted for a training session
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Trophy, Target } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import { getRuns } from '@shared/services/store';
import { matchedRuns, plannedVsActual, type MatchedRuns, type PlannedVsActual } from '@shared/engine/analysis';
import { fmtPace, type Session } from '@shared/engine/training';
import { getCachedPlan } from '@features/training/services/planService';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function clock(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.round(sec % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
const ord = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`;

export function AnalysisCards({ runId }: { runId: string }) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const [match, setMatch] = useState<MatchedRuns | null>(null);
  const [pva, setPva] = useState<{ session: Session; r: PlannedVsActual } | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const runs = await getRuns(500);
      const me = runs.find(r => r.id === runId);
      if (!me || !live) return;
      setMatch(matchedRuns(me, runs));
      const ap = await getCachedPlan().catch(() => null);
      const session = ap?.plan.weeks.flatMap(w => w.sessions).find(x => x.runId === runId);
      if (session && live) setPva({ session, r: plannedVsActual(session, me) });
    })().catch(() => {});
    return () => { live = false; };
  }, [runId]);

  if (!match && !pva) return null;
  const verdictLine: Record<PlannedVsActual['verdict'], string> = {
    on_target: 'Right in the target pace. Nicely judged.',
    fast: 'Quicker than planned. Easy days are meant to feel easy.',
    slow: 'Slower than the target. Fine if you felt tired; the plan adapts.',
    short: 'Shorter than planned.',
    long: 'Longer than planned.',
    done: 'Session done.',
  };

  return (
    <>
      {pva && (
        <View style={s.card}>
          <View style={s.head}><Target size={16} color={C.t1} /><Text style={s.title}>Planned vs actual · {pva.session.title}</Text></View>
          <View style={s.grid}>
            <View style={s.cell}><Text style={s.lbl}>Distance</Text><Text style={s.val}>{pva.r.actualKm.toFixed(1)}<Text style={s.of}> / {pva.r.plannedKm} km</Text></Text></View>
            {pva.r.targetPace && pva.r.actualPace && (
              <View style={s.cell}><Text style={s.lbl}>Pace /km</Text><Text style={s.val}>{fmtPace(pva.r.actualPace)}<Text style={s.of}> · aim {fmtPace(pva.r.targetPace.fast)}–{fmtPace(pva.r.targetPace.slow)}</Text></Text></View>
            )}
          </View>
          <Text style={[s.note, pva.r.verdict === 'on_target' && { color: C.t1 }]}>{verdictLine[pva.r.verdict]}</Text>
        </View>
      )}
      {match && (
        <View style={s.card}>
          <View style={s.head}>
            <Trophy size={16} color={match.rank === 1 ? C.red : C.t1} weight={match.rank === 1 ? 'fill' : 'regular'} />
            <Text style={s.title}>
              Same route · {match.efforts.length} times · {match.rank === 1 ? 'your fastest' : `${ord(match.rank)} fastest`}
            </Text>
          </View>
          {match.vsLast != null && (
            <Text style={[s.note, { color: match.vsLast < 0 ? C.green : C.t2 }]}>
              {match.vsLast < 0 ? `${clock(-match.vsLast)} faster than last time` : match.vsLast > 0 ? `${clock(match.vsLast)} slower than last time` : 'Same time as last time'}
            </Text>
          )}
          {match.efforts.slice(0, 5).map((e, i) => {
            const d = new Date(e.startTime);
            return (
              <View key={e.id} style={[s.row, e.isThis && s.rowMe]}>
                <Text style={s.rank}>{i + 1}</Text>
                <Text style={s.when}>{e.isThis ? 'This run' : `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear() !== new Date().getFullYear() ? d.getFullYear() : ''}`}</Text>
                <Text style={s.time}>{clock(e.durationSec)}</Text>
              </View>
            );
          })}
        </View>
      )}
    </>
  );
}

function mk(C: AppColors) {
  return StyleSheet.create({
    card: { marginHorizontal: 18, marginTop: 12, backgroundColor: C.card, borderRadius: 22, padding: 16, gap: 8 },
    head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { flex: 1, fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
    grid: { flexDirection: 'row', gap: 16 },
    cell: { gap: 2 },
    lbl: { fontFamily: Fonts.regular, fontSize: 12, color: C.t2 },
    val: { fontFamily: Fonts.numeric, fontSize: 22, color: C.t1 },
    of: { fontFamily: Fonts.medium, fontSize: 12, color: C.t2 },
    note: { fontFamily: Fonts.medium, fontSize: 12.5, color: C.t2 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
    rowMe: { backgroundColor: C.redLo, borderRadius: 8, paddingHorizontal: 6 },
    rank: { width: 16, fontFamily: Fonts.bold, fontSize: 13, color: C.t2 },
    when: { flex: 1, fontFamily: Fonts.medium, fontSize: 13, color: C.t1 },
    time: { fontFamily: Fonts.semiBold, fontSize: 13, color: C.t1 },
  });
}
