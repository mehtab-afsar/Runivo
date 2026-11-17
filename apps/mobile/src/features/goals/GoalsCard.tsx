/** P3: Home's goals card, plus the sheet to add and remove goals. */
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Plus } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import { getRuns, getSettings, saveSettings, type StoredRun } from '@shared/services/store';
import { goalProgress, goalLabel, SPORT_NAME, type SportGoal } from './sportGoals';
import { FormScreen, ChipGroup, FormButton } from '@mobile/shared/components/form/FormKit';

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
        <Pressable
          onPress={() => {
            // Adding a fifth goal used to silently delete the oldest one.
            if (goals.length >= MAX_GOALS) { Alert.alert(`You can track ${MAX_GOALS} goals`, 'Remove one to add another. Long-press a goal to remove it.'); return; }
            setOpen(true);
          }}
          hitSlop={8} accessibilityRole="button" accessibilityLabel="Add a goal" style={s.add}>
          <Plus size={13} color={C.t1} weight="bold" /><Text style={s.addTxt}>Add</Text>
        </Pressable>
      </View>
      {goals.length === 0 ? (
        <Pressable onPress={() => setOpen(true)} accessibilityRole="button"><Text style={s.empty}>Set a weekly or monthly goal for running, walking or riding.</Text></Pressable>
      ) : goals.map(g => {
        const done = goalProgress(g, runs);
        const pct = Math.min(1, done / g.target);
        return (
          <Pressable key={g.id} style={s.goal} accessibilityHint="Long-press to remove this goal" accessibilityActions={[{ name: 'delete', label: 'Remove goal' }]} onAccessibilityAction={() => Alert.alert('Remove this goal?', goalLabel(g), [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => save(goals.filter(x => x.id !== g.id)) }])} onLongPress={() => Alert.alert('Remove this goal?', goalLabel(g), [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => save(goals.filter(x => x.id !== g.id)) }])}>
            <View style={s.goalHead}>
              <Text style={s.goalName}>{SPORT_NAME[g.sport]} this {g.period}</Text>
              <Text style={[s.goalVal, pct >= 1 && { color: C.red }]}>{done.toFixed(done >= 100 ? 0 : 1)} / {g.target} {g.metric === 'km' ? 'km' : 'h'}</Text>
            </View>
            <View style={s.track}><View style={[s.fill, { width: `${Math.round(pct * 100)}%` }]} /></View>
          </Pressable>
        );
      })}
      <AddGoal visible={open} onClose={() => setOpen(false)} onAdd={g => { save([...goals, g].slice(0, MAX_GOALS)); setOpen(false); }} />
    </View>
  );
}

const MAX_GOALS = 4;

function AddGoal({ visible, onClose, onAdd }: { visible: boolean; onClose: () => void; onAdd: (g: SportGoal) => void }) {
  const [sport, setSport] = useState<SportGoal['sport']>('run');
  const [period, setPeriod] = useState<SportGoal['period']>('month');
  const [metric, setMetric] = useState<SportGoal['metric']>('km');
  const [target, setTarget] = useState(80);
  const unit = metric === 'km' ? 'km' : 'h';
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <FormScreen
        title="Set a"
        accent="goal."
        subtitle="Progress fills in from every activity you record."
        onClose={onClose}
        footer={<FormButton label={`Aim for ${target} ${unit} a ${period}`} onPress={() => onAdd({ id: String(Date.now()), sport, period, metric, target })} />}
      >
        <ChipGroup label="Sport" options={(['run', 'walk', 'ride', 'all'] as const).map(k => ({ value: k, label: SPORT_NAME[k] }))} value={sport} onChange={setSport} />
        <ChipGroup label="Every" options={[{ value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} value={period} onChange={v => setPeriod(v as SportGoal['period'])} />
        <ChipGroup label="Measure" options={[{ value: 'km', label: 'Distance' }, { value: 'hours', label: 'Time' }]} value={metric} onChange={v => { setMetric(v as SportGoal['metric']); setTarget(v === 'km' ? 40 : 4); }} />
        <ChipGroup label="Target" options={TARGETS[metric].map(t => ({ value: t, label: `${t} ${unit}` }))} value={target} onChange={setTarget} />
      </FormScreen>
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
