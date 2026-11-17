/**
 * Find your race (PRD mock 2): search by name or city, filter by month and
 * distance, nearest first. "Don't see your race? Add it" sits inside the
 * results, after the first two.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator, StyleSheet } from 'react-native';
import { MagnifyingGlass, Plus, CaretRight } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import { ChipGroup } from '@mobile/shared/components/form/FormKit';
import { positionIfAllowed, type DevicePosition } from '@mobile/shared/location/devicePosition';
import { searchRaces, entrantsLabel, fmtRaceDate, type RaceResult } from '../services/raceService';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DISTANCES = [
  { value: 0, label: 'Any distance' }, { value: 5000, label: '5K' }, { value: 10000, label: '10K' },
  { value: 21097, label: 'Half' }, { value: 42195, label: 'Marathon' },
];

/** "any", then the next 8 months as YYYY-MM. */
function monthOptions(today: string) {
  const y = +today.slice(0, 4), m = +today.slice(5, 7) - 1;
  return [{ value: 'any', label: 'Any month' }, ...Array.from({ length: 8 }, (_, i) => {
    const mm = (m + i) % 12, yy = y + Math.floor((m + i) / 12);
    return { value: `${yy}-${String(mm + 1).padStart(2, '0')}`, label: `${MONTHS[mm]}${yy !== y ? ` ${String(yy).slice(2)}` : ''}` };
  })];
}
const monthEnd = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return `${ym}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
};

export default function RaceSearchStep({ today, onPick, onAdd }: {
  today: string;
  onPick: (r: RaceResult) => void;
  onAdd: (name: string) => void;
}) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const [q, setQ] = useState('');
  const [month, setMonth] = useState('any');
  const [dist, setDist] = useState(0);
  const [near, setNear] = useState<DevicePosition | null>(null);
  const [rows, setRows] = useState<RaceResult[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tries, setTries] = useState(0);
  const seq = useRef(0);

  useEffect(() => { positionIfAllowed({ timeoutMs: 3000 }).then(setNear).catch(() => {}); }, []);

  useEffect(() => {
    const n = ++seq.current;
    const t = setTimeout(() => {
      setFailed(false);
      searchRaces({
        q, near, distanceM: dist || null,
        from: month === 'any' ? null : `${month}-01`, to: month === 'any' ? null : monthEnd(month),
      })
        .then(r => { if (n === seq.current) setRows(r); })
        .catch(() => { if (n === seq.current) { setRows([]); setFailed(true); } });
    }, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [q, month, dist, near, tries]);

  const months = useMemo(() => monthOptions(today), [today]);
  const add = (
    <Pressable key="add" style={s.add} onPress={() => onAdd(q.trim())} accessibilityRole="button">
      <View style={s.addIcon}><Plus size={18} color={C.t1} weight="bold" /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.addTitle}>Don't see your race?</Text>
        <Text style={s.addSub}>Add it with its name, date and distance</Text>
      </View>
      <CaretRight size={16} color={C.t3} weight="bold" />
    </Pressable>
  );

  const cards = (rows ?? []).map(r => {
    const who = entrantsLabel(r.entrants);
    const line = [r.city, r.kmAway != null && r.kmAway > 15 ? `${r.kmAway} km away` : null, who].filter(Boolean).join(' · ');
    return (
      <Pressable key={r.id} style={s.card} onPress={() => onPick(r)} accessibilityRole="button" accessibilityLabel={`${r.name}, ${fmtRaceDate(r.startsOn)}`}>
        <Text style={s.when}>{fmtRaceDate(r.startsOn)} · {r.distances.map(d => d.label).join(', ')}</Text>
        <Text style={s.name} numberOfLines={2}>{r.name}</Text>
        {!!line && <Text style={s.line} numberOfLines={1}>{line}</Text>}
        {r.status === 'pending' && <Text style={s.pending}>Added by you · only you can see it until it's checked</Text>}
      </Pressable>
    );
  });
  const list = rows && rows.length ? [...cards.slice(0, 2), add, ...cards.slice(2)] : [];

  return (
    <View style={{ gap: 14 }}>
      <View style={s.search}>
        <MagnifyingGlass size={18} color={C.t2} />
        <TextInput
          style={s.input} value={q} onChangeText={setQ} placeholder="Race name or city" placeholderTextColor={C.t3}
          returnKeyType="search" autoCorrect={false} accessibilityLabel="Search races" selectionColor={C.green}
        />
      </View>
      <ChipGroup options={months} value={month} onChange={setMonth} wrap={false} />
      <ChipGroup options={DISTANCES} value={dist} onChange={setDist} wrap={false} />

      {rows === null ? <ActivityIndicator color={C.t2} style={{ marginTop: 24 }} />
        : failed ? (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>Couldn't load races</Text>
            <Pressable onPress={() => setTries(t => t + 1)} hitSlop={8} accessibilityRole="button"><Text style={s.retry}>Try again</Text></Pressable>
            {add}
          </View>
        ) : rows.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>{q ? `No races match "${q.trim()}"` : 'No races listed for these filters yet'}</Text>
            <Text style={s.emptySub}>Add yours and the plan works straight away.</Text>
            {add}
          </View>
        ) : list}
    </View>
  );
}

function mk(C: AppColors) {
  return StyleSheet.create({
    search:   { flexDirection: 'row', alignItems: 'center', gap: 10, height: 54, borderRadius: 16, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 16 },
    input:    { flex: 1, fontFamily: Fonts.regular, fontSize: 16, color: C.t1, paddingVertical: 0 },
    card:     { backgroundColor: C.card, borderRadius: 20, padding: 16, gap: 4 },
    when:     { fontFamily: Fonts.semiBold, fontSize: 12.5, color: C.green },
    name:     { fontFamily: Fonts.semiBold, fontSize: 17, lineHeight: 22, color: C.t1 },
    line:     { fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
    pending:  { fontFamily: Fonts.medium, fontSize: 12, color: C.lavenderInk, marginTop: 2 },
    add:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 20, padding: 14, borderWidth: 1.5, borderColor: C.border, borderStyle: 'dashed' },
    addIcon:  { width: 40, height: 40, borderRadius: 13, backgroundColor: C.mint, alignItems: 'center', justifyContent: 'center' },
    addTitle: { fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1 },
    addSub:   { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, marginTop: 1 },
    empty:    { gap: 10, marginTop: 6 },
    emptyTitle: { fontFamily: Fonts.semiBold, fontSize: 16, color: C.t1 },
    emptySub: { fontFamily: Fonts.regular, fontSize: 14, color: C.t2 },
    retry:    { fontFamily: Fonts.semiBold, fontSize: 14, color: C.green },
  });
}
