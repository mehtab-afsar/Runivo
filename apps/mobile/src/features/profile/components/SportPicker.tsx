/** The small "Run ▾" chip and its sheet: replaces the full-width sport tabs. */
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { CaretDown, Check } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import type { SportFilter } from '../utils/profileStats';

export const SPORT_LABEL: Record<SportFilter, string> = { all: 'All sports', run: 'Run', walk: 'Walk and hike', ride: 'Ride' };
const SHORT: Record<SportFilter, string> = { all: 'All', run: 'Run', walk: 'Walk', ride: 'Ride' };

export function SportChip({ value, onChange, note }: { value: SportFilter; onChange: (s: SportFilter) => void; note?: string }) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable hitSlop={8} style={s.chip} onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`Sport: ${SPORT_LABEL[value]}. Change`}>
        <Text style={s.chipTxt}>{SHORT[value]}</Text>
        <CaretDown size={12} color={C.t1} weight="bold" />
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.scrim} onPress={() => setOpen(false)} accessibilityLabel="Close" />
        <View style={s.sheet}>
          <View style={s.grab} />
          <Text style={s.title}>Show stats for</Text>
          {note ? <Text style={s.sub}>{note}</Text> : null}
          {(Object.keys(SPORT_LABEL) as SportFilter[]).map((k, i, arr) => (
            <Pressable key={k} style={[s.row, i < arr.length - 1 && s.rowBorder]} onPress={() => { onChange(k); setOpen(false); }} accessibilityRole="button" accessibilityState={{ selected: k === value }}>
              <Text style={s.rowTxt}>{SPORT_LABEL[k]}</Text>
              {k === value && <Check size={18} color={C.red} weight="bold" />}
            </Pressable>
          ))}
        </View>
      </Modal>
    </>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: C.surface },
    chipTxt: { fontFamily: Fonts.semiBold, fontSize: 13, color: C.t1 },
    scrim: { flex: 1, backgroundColor: 'rgba(12,12,13,0.42)' },
    sheet: { backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 40 },
    grab: { width: 36, height: 5, borderRadius: 3, backgroundColor: C.border, alignSelf: 'center' },
    title: { fontFamily: Fonts.bold, fontSize: 17, color: C.t1, marginTop: 16 },
    sub: { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, marginTop: 4, marginBottom: 6 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52 },
    rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
    rowTxt: { fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1 },
  });
}
