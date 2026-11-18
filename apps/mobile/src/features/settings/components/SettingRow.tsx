import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, Fonts, type AppColors } from '@theme';

interface SettingRowProps {
  label: string;
  sub?: string;
  children: React.ReactNode;
  /** Put the control under the label (for wide controls). */
  stacked?: boolean;
}

export function SettingRow({ label, sub, children, stacked }: SettingRowProps) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  return (
    <View style={[ss.row, stacked && ss.rowStacked]}>
      <View style={[ss.labelWrap, stacked && ss.labelStacked]}>
        <Text style={ss.rowLabel}>{label}</Text>
        {sub ? <Text style={ss.rowSub}>{sub}</Text> : null}
      </View>
      {React.Children.map(children, child =>
        // A bare Switch has no name for VoiceOver/TalkBack ("switch, on"). Give it the row's
        // label and sub-text so it reads "Voice cues, switch, on".
        React.isValidElement<{ onValueChange?: unknown; accessibilityLabel?: string; accessibilityHint?: string }>(child) && child.props.onValueChange
          ? React.cloneElement(child, { accessibilityLabel: child.props.accessibilityLabel ?? label, accessibilityHint: child.props.accessibilityHint ?? sub })
          : child,
      )}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, minHeight: 56, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
    labelWrap: { flex: 1, paddingRight: 12 },
    // A wide control (a three-way switch) goes under its label instead of squeezing it.
    rowStacked: { flexDirection: 'column', alignItems: 'stretch', gap: 10, paddingVertical: 14 },
    labelStacked: { flex: 0, paddingRight: 0 },
    rowLabel: { fontFamily: Fonts.regular, fontSize: 16, color: C.t1 },
    rowSub: { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, marginTop: 2 },
  });
}
