/** Bottom sheet to change the weekly distance goal (H4). */
import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import { GOAL_CHOICES_KM, saveWeeklyGoal } from '../services/weeklyGoal';

export function GoalSheet({ visible, current, onClose, onSaved }: {
  visible: boolean; current: number; onClose: () => void; onSaved: (km: number) => void;
}) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const [km, setKm] = useState(current);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (visible) setKm(current); }, [visible, current]);

  const save = async () => {
    setSaving(true);
    try { await saveWeeklyGoal(km); onSaved(km); onClose(); } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={s.sheet}>
        <View style={s.grab} />
        <Text style={s.title}>Weekly goal</Text>
        <Text style={s.sub}>Distance across all your activities, Monday to Sunday.</Text>
        <View style={s.stepper}>
          <Pressable style={s.stepBtn} onPress={() => setKm(k => Math.max(1, k - 1))} accessibilityLabel="One km less"><Text style={s.stepTxt}>−</Text></Pressable>
          <Text style={s.value}>{km}<Text style={s.unit}> km</Text></Text>
          <Pressable style={s.stepBtn} onPress={() => setKm(k => Math.min(300, k + 1))} accessibilityLabel="One km more"><Text style={s.stepTxt}>+</Text></Pressable>
        </View>
        <View style={s.chips}>
          {GOAL_CHOICES_KM.map(v => (
            <Pressable hitSlop={8} key={v} style={[s.chip, km === v && s.chipOn]} onPress={() => setKm(v)}>
              <Text style={[s.chipTxt, km === v && s.chipTxtOn]}>{v}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={[s.done, saving && { opacity: 0.6 }]} onPress={save} disabled={saving} accessibilityRole="button">
          <Text style={s.doneTxt}>{saving ? 'Saving…' : 'Save goal'}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    scrim: { flex: 1, backgroundColor: 'rgba(12,12,13,0.42)' },
    sheet: { backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 40 },
    grab: { width: 36, height: 5, borderRadius: 3, backgroundColor: C.border, alignSelf: 'center' },
    title: { fontFamily: Fonts.bold, fontSize: 17, color: C.t1, marginTop: 16 },
    sub: { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, marginTop: 4 },
    stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 },
    stepBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
    stepTxt: { fontFamily: Fonts.semiBold, fontSize: 24, color: C.t1 },
    value: { fontFamily: Fonts.numeric, fontSize: 44, color: C.t1 },
    unit: { fontFamily: Fonts.medium, fontSize: 16, color: C.t2 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },
    chip: { minWidth: 52, height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
    chipOn: { backgroundColor: C.t1 },
    chipTxt: { fontFamily: Fonts.semiBold, fontSize: 13, color: C.t1 },
    chipTxtOn: { color: C.bg },
    done: { marginTop: 22, height: 50, borderRadius: 25, backgroundColor: C.t1, alignItems: 'center', justifyContent: 'center' },
    doneTxt: { fontFamily: Fonts.semiBold, fontSize: 15, color: C.bg },
  });
}
