/** P3: Home's goals card, plus the sheet to add and remove goals. */
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Plus, X } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import { getRuns, getSettings, saveSettings, type StoredRun } from '@shared/services/store';
import { goalProgress, goalLabel, SPORT_NAME, type SportGoal } from './sportGoals';

const TARGETS: Record<SportGoal['metric'], number[]> = { km: [10, 20, 40, 80, 150, 300], hours: [2, 4, 6, 10, 20] };

export function GoalsCard() {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const [goals, setGoals] = useState<SportGoal[]>([]);
  const [runs, setRuns] = useState<StoredRun[]>([]);
  const [open, setOpen] = useState(false);
  const load = useCallback(() => {
    getSettings().then(st => setGoals(st.sportGoals ?? [])).catch(() => {});
    getRuns(500).then(setRuns).catch(() => {});
  }, []);
  useFocusEffect(load);

  const save = async (next: SportGoal[]) => {
    setGoals(next);
    const st = await getSettings();
    await saveSettings({ ...st, sportGoals: next });
  };

  return (
    <View style={s.card}>
      <View style={s.head}>
        <Text style={s.label}>Goals</Text>
        <Pressable onPress={() => setOpen(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Add a goal" style={s.add}>
          <Plus size={13} color={C.t1} weight="bold" /><Text style={s.addTxt}>Add</Text>
        </Pressable>
      </View>
      {goals.length === 0 ? (
        <Pressable onPress={() => setOpen(true)}><Text style={s.empty}>Set a weekly or monthly goal for running, walking or riding.</Text></Pressable>
      ) : goals.map(g => {
        const done = goalProgress(g, runs);
        const pct = Math.min(1, done / g.target);
        return (
          <Pressable key={g.id} style={s.goal} onLongPress={() => Alert.alert('Remove this goal?', goalLabel(g), [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => save(goals.filter(x => x.id !== g.id)) }])}>
            <View style={s.goalHead}>
              <Text style={s.goalName}>{SPORT_NAME[g.sport]} this {g.period}</Text>
              <Text style={[s.goalVal, pct >= 1 && { color: C.red }]}>{done.toFixed(done >= 100 ? 0 : 1)} / {g.target} {g.metric === 'km' ? 'km' : 'h'}</Text>
            </View>
            <View style={s.track}><View style={[s.fill, { width: `${Math.round(pct * 100)}%` }]} /></View>
          </Pressable>
        );
      })}
      <AddGoal visible={open} onClose={() => setOpen(false)} onAdd={g => { save([...goals, g].slice(-4)); setOpen(false); }} />
    </View>
  );
}

function AddGoal({ visible, onClose, onAdd }: { visible: boolean; onClose: () => void; onAdd: (g: SportGoal) => void }) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const [sport, setSport] = useState<SportGoal['sport']>('run');
  const [period, setPeriod] = useState<SportGoal['period']>('month');
  const [metric, setMetric] = useState<SportGoal['metric']>('km');
  const [target, setTarget] = useState(80);
  const Chip = ({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) => (
    <Pressable style={[s.chip, on && s.chipOn]} onPress={onPress}><Text style={[s.chipTxt, on && s.chipTxtOn]}>{label}</Text></Pressable>
  );
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.sheetHead}><Text style={s.sheetTitle}>New goal</Text><Pressable onPress={onClose} accessibilityLabel="Close"><X size={18} color={C.t2} /></Pressable></View>
        <Text style={s.lbl}>Sport</Text>
        <View style={s.chips}>{(['run', 'walk', 'ride', 'all'] as const).map(k => <Chip key={k} on={sport === k} label={SPORT_NAME[k]} onPress={() => setSport(k)} />)}</View>
        <Text style={s.lbl}>Every</Text>
        <View style={s.chips}><Chip on={period === 'week'} label="Week" onPress={() => setPeriod('week')} /><Chip on={period === 'month'} label="Month" onPress={() => setPeriod('month')} /></View>
        <Text style={s.lbl}>Measure</Text>
        <View style={s.chips}><Chip on={metric === 'km'} label="Distance" onPress={() => { setMetric('km'); setTarget(40); }} /><Chip on={metric === 'hours'} label="Time" onPress={() => { setMetric('hours'); setTarget(4); }} /></View>
        <Text style={s.lbl}>Target</Text>
        <View style={s.chips}>{TARGETS[metric].map(t => <Chip key={t} on={target === t} label={`${t} ${metric === 'km' ? 'km' : 'h'}`} onPress={() => setTarget(t)} />)}</View>
        <Pressable style={s.done} onPress={() => onAdd({ id: String(Date.now()), sport, period, metric, target })} accessibilityRole="button">
          <Text style={s.doneTxt}>Add goal</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function mk(C: AppColors) {
  return StyleSheet.create({
    card: { backgroundColor: C.card, borderRadius: 18, padding: 16, gap: 10 },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    label: { fontFamily: Fonts.semiBold, fontSize: 13, color: C.t2 },
    add: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    addTxt: { fontFamily: Fonts.semiBold, fontSize: 13, color: C.t1 },
    empty: { fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
    goal: { gap: 6 },
    goalHead: { flexDirection: 'row', justifyContent: 'space-between' },
    goalName: { fontFamily: Fonts.semiBold, fontSize: 13.5, color: C.t1 },
    goalVal: { fontFamily: Fonts.semiBold, fontSize: 12.5, color: C.t1 },
    track: { height: 6, borderRadius: 3, backgroundColor: C.surface, overflow: 'hidden' },
    fill: { height: 6, borderRadius: 3, backgroundColor: C.red },
    scrim: { flex: 1, backgroundColor: 'rgba(12,12,13,0.42)' },
    sheet: { backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 40, gap: 8 },
    sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sheetTitle: { fontFamily: Fonts.bold, fontSize: 17, color: C.t1 },
    lbl: { fontFamily: Fonts.semiBold, fontSize: 12, color: C.t2, marginTop: 6 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: C.surface, justifyContent: 'center' },
    chipOn: { backgroundColor: C.t1 },
    chipTxt: { fontFamily: Fonts.semiBold, fontSize: 12.5, color: C.t1 },
    chipTxtOn: { color: C.bg },
    done: { marginTop: 14, height: 50, borderRadius: 25, backgroundColor: C.t1, alignItems: 'center', justifyContent: 'center' },
    doneTxt: { fontFamily: Fonts.semiBold, fontSize: 15, color: C.bg },
  });
}
