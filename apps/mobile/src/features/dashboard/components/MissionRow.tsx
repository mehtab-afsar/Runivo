import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Mission } from '@shared/services/missions';
import { useTheme, Type, type AppColors } from '@theme';

interface Props {
  mission: Mission;
  isLast?: boolean;
}

export function MissionRow({ mission: m, isLast }: Props) {
  const C   = useTheme();
  const ss  = useMemo(() => mkStyles(C), [C]);
  const bar = Math.min(m.current / Math.max(m.target, 1), 1);

  return (
    <View style={[ss.row, !isLast && ss.rowBorder]}>
      <View style={[ss.iconBox, m.completed && ss.iconBoxDone]}>
        <Text style={ss.emojiText}>{m.completed ? '✅' : m.icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[ss.title, m.completed && ss.titleDone]}>{m.title}</Text>
        <View style={ss.barBg}>
          <View style={[ss.barFill, { width: `${bar * 100}%`, backgroundColor: m.completed ? C.green : C.red }]} />
        </View>
      </View>
      <Text style={[ss.xp, m.completed && ss.xpDone]}>+{m.rewards.pace} PACE</Text>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    row:        { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingBottom: 14, marginBottom: 14 },
    rowBorder:  { borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.08)' },
    iconBox:    { width: 32, height: 32, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
    iconBoxDone:{ backgroundColor: 'rgba(26,107,64,0.3)' },
    emojiText:  { fontSize: 16, lineHeight: 20 },
    // Sits on the always-dark mission card, so the title must be a fixed-light token —
    // C.bg inverts to near-black in dark mode and vanishes against the card.
    title:      { ...Type.bodySm, color: C.alwaysLight, marginBottom: 8 },
    titleDone:  { color: 'rgba(255,255,255,0.35)', textDecorationLine: 'line-through' },
    barBg:      { height: 2, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 1, overflow: 'hidden' },
    barFill:    { height: '100%', borderRadius: 1 },
    xp:         { ...Type.labelSm, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
    xpDone:     { color: C.green },
  });
}
