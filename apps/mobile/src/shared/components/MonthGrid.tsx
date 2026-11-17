/**
 * A month calendar: pick a day, or show a dot per day (plan month view).
 * Dates are YYYY-MM-DD strings (local calendar days), weeks start on Monday.
 */
import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { CaretLeft, CaretRight } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const HEAD = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** First day of the month a date is in, as YYYY-MM-01. */
export const monthOf = (d: string) => `${d.slice(0, 7)}-01`;
/** Shift a YYYY-MM-01 month by n months. */
export function shiftMonth(month: string, n: number): string {
  const y = +month.slice(0, 4), m = +month.slice(5, 7) - 1 + n;
  return iso(y + Math.floor(m / 12), ((m % 12) + 12) % 12, 1);
}

export default function MonthGrid({
  month, onMonth, selected, today, minDate, maxDate, onSelect, dot, done,
}: {
  /** YYYY-MM-01 */
  month: string;
  onMonth: (m: string) => void;
  selected?: string | null;
  today?: string;
  minDate?: string;
  maxDate?: string;
  onSelect?: (d: string) => void;
  /** Colour of a session dot for a day, if any. */
  dot?: (d: string) => string | null;
  /** Days shown with a tick colour (done sessions). */
  done?: (d: string) => boolean;
}) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const y = +month.slice(0, 4), m = +month.slice(5, 7) - 1;
  const first = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(first).fill(null), ...Array.from({ length: count }, (_, i) => iso(y, m, i + 1))];
  while (cells.length % 7) cells.push(null);
  const canPrev = !minDate || shiftMonth(month, -1) >= monthOf(minDate);
  const canNext = !maxDate || shiftMonth(month, 1) <= monthOf(maxDate);

  return (
    <View style={s.root}>
      <View style={s.head}>
        <Pressable style={[s.arrow, !canPrev && { opacity: 0.3 }]} disabled={!canPrev} onPress={() => onMonth(shiftMonth(month, -1))} hitSlop={8} accessibilityRole="button" accessibilityLabel="Previous month">
          <CaretLeft size={16} color={C.t1} weight="bold" />
        </Pressable>
        <Text style={s.title}>{MONTHS[m]} {y}</Text>
        <Pressable style={[s.arrow, !canNext && { opacity: 0.3 }]} disabled={!canNext} onPress={() => onMonth(shiftMonth(month, 1))} hitSlop={8} accessibilityRole="button" accessibilityLabel="Next month">
          <CaretRight size={16} color={C.t1} weight="bold" />
        </Pressable>
      </View>
      <View style={s.row}>{HEAD.map((h, i) => <Text key={i} style={s.headTxt}>{h}</Text>)}</View>
      {Array.from({ length: cells.length / 7 }, (_, r) => (
        <View key={r} style={s.row}>
          {cells.slice(r * 7, r * 7 + 7).map((d, i) => {
            if (!d) return <View key={i} style={s.cell} />;
            const off = (minDate && d < minDate) || (maxDate && d > maxDate);
            const on = d === selected;
            const isToday = d === today;
            const color = dot?.(d) ?? null;
            const tick = done?.(d);
            return (
              <Pressable
                key={i}
                style={[s.cell, s.day, isToday && s.today, on && s.on]}
                disabled={!onSelect || !!off}
                onPress={() => onSelect?.(d)}
                accessibilityRole={onSelect ? 'button' : undefined}
                accessibilityLabel={d}
                accessibilityState={{ selected: on, disabled: !!off }}
              >
                <Text style={[s.num, off && { color: C.t3, opacity: 0.5 }, (on || isToday) && { color: C.alwaysLight }]}>{+d.slice(8)}</Text>
                {(color || tick) && <View style={[s.dot, { backgroundColor: tick ? C.brandGreen : color! }]} />}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function mk(C: AppColors) {
  return StyleSheet.create({
    root:    { backgroundColor: C.card, borderRadius: 22, padding: 12, gap: 4 },
    head:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
    arrow:   { width: 36, height: 36, borderRadius: 18, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
    title:   { fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1 },
    row:     { flexDirection: 'row', gap: 4 },
    headTxt: { flex: 1, textAlign: 'center', fontFamily: Fonts.semiBold, fontSize: 11, color: C.t3, paddingVertical: 2 },
    cell:    { flex: 1, height: 40 },
    day:     { borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 3 },
    today:   { backgroundColor: C.alwaysDark },
    on:      { backgroundColor: C.green },
    num:     { fontFamily: Fonts.medium, fontSize: 13.5, color: C.t1, fontVariant: ['tabular-nums'] },
    dot:     { width: 6, height: 6, borderRadius: 3 },
  });
}
