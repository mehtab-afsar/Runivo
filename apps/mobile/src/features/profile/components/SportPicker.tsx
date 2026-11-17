/** The small "Run ▾" chip and its sheet: replaces the full-width sport tabs. */
import React, { useMemo, useState } from 'react';
import { Text, Pressable, StyleSheet } from 'react-native';
import { CaretDown, Check } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import type { SportFilter } from '../utils/profileStats';
import { ModalSheet } from '@mobile/shared/components/ModalSheet';

export const SPORT_LABEL: Record<SportFilter, string> = { all: 'All sports', run: 'Run', walk: 'Walk and hike', hike: 'Hike', ride: 'Ride' };
const SHORT: Record<SportFilter, string> = { all: 'All', run: 'Run', walk: 'Walk', hike: 'Hike', ride: 'Ride' };

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
      <ModalSheet visible={open} onClose={() => setOpen(false)}>
        <Text style={s.title}>Show stats for</Text>
        {note ? <Text style={s.sub}>{note}</Text> : null}
        {(Object.keys(SPORT_LABEL) as SportFilter[]).map((k, i, arr) => (
          <Pressable key={k} style={[s.row, i < arr.length - 1 && s.rowBorder]} onPress={() => { onChange(k); setOpen(false); }} accessibilityRole="button" accessibilityState={{ selected: k === value }}>
            <Text style={s.rowTxt}>{SPORT_LABEL[k]}</Text>
            {k === value && <Check size={18} color={C.red} weight="bold" />}
          </Pressable>
        ))}
      </ModalSheet>
    </>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: C.surface },
    chipTxt: { fontFamily: Fonts.semiBold, fontSize: 13, color: C.t1 },
    title: { fontFamily: Fonts.bold, fontSize: 17, color: C.t1, marginTop: 16 },
    sub: { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, marginTop: 4, marginBottom: 6 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52 },
    rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
    rowTxt: { fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1 },
  });
}
