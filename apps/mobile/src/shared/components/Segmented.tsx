/**
 * The one segmented control.
 *
 *   pill (default)  grey track, the chosen option a raised white segment; the
 *                   options share the width (or hug their labels with `fit`)
 *   tabs            page tabs: labels in a row, the chosen one bold with an
 *                   ink underline (Profile, Club, Groups)
 */
import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme, Fonts, type AppColors } from '@theme';

export interface SegmentOption<T extends string | number> { value: T; label: string; a11y?: string }

export function Segmented<T extends string | number>({
  options, value, onChange, variant = 'pill', size = 'md', fit, disabled, style, renderLabel,
}: {
  options: SegmentOption<T>[];
  value: T | null;
  onChange: (v: T) => void;
  variant?: 'pill' | 'tabs';
  size?: 'md' | 'sm';
  /** Pill only: hug the labels instead of sharing the full width. */
  fit?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Tabs only: custom content per tab (an icon above the label, a count). */
  renderLabel?: (o: SegmentOption<T>, on: boolean) => React.ReactNode;
}) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  if (variant === 'tabs') {
    return (
      <View style={[s.tabs, style]} accessibilityRole="tablist">
        {options.map(o => {
          const on = o.value === value;
          return (
            <Pressable key={String(o.value)} style={[s.tab, on && s.tabOn]} onPress={() => onChange(o.value)} disabled={disabled}
              accessibilityRole="tab" accessibilityLabel={o.a11y ?? o.label} accessibilityState={{ selected: on, disabled: !!disabled }}>
              {renderLabel ? renderLabel(o, on) : <Text style={[s.tabTxt, on && s.tabTxtOn]} numberOfLines={1}>{o.label}</Text>}
            </Pressable>
          );
        })}
      </View>
    );
  }
  const sm = size === 'sm';
  return (
    <View style={[s.track, fit && { alignSelf: 'flex-start' }, style]} accessibilityRole="tablist">
      {options.map(o => {
        const on = o.value === value;
        return (
          <Pressable key={String(o.value)} style={[s.item, sm && s.itemSm, !fit && { flex: 1 }, on && s.itemOn]}
            onPress={() => { if (!on) onChange(o.value); }} disabled={disabled}
            accessibilityRole="tab" accessibilityLabel={o.a11y ?? o.label} accessibilityState={{ selected: on, disabled: !!disabled }}>
            <Text style={[s.txt, sm && s.txtSm, on && s.txtOn]} numberOfLines={1}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function mk(C: AppColors) {
  return StyleSheet.create({
    track:  { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 999, padding: 3 },
    item:   { height: 34, paddingHorizontal: 14, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
    itemSm: { height: 28, paddingHorizontal: 10 },
    itemOn: { backgroundColor: C.card, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
    txt:    { fontFamily: Fonts.medium, fontSize: 13.5, color: C.t2 },
    txtSm:  { fontSize: 12.5 },
    txtOn:  { fontFamily: Fonts.semiBold, color: C.t1 },
    tabs:   { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
    tab:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: 12, paddingBottom: 11, borderBottomWidth: 3, borderBottomColor: 'transparent' },
    tabOn:  { borderBottomColor: C.t1 },
    tabTxt: { fontFamily: Fonts.regular, fontSize: 14.5, color: C.t2 },
    tabTxtOn: { fontFamily: Fonts.semiBold, color: C.t1 },
  });
}
