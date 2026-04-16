import React from 'react';
import { View, Text, Pressable, Animated, StyleSheet, Switch } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Music2 } from 'lucide-react-native';
import type { ActivityType } from '../types';

const C = {
  bg: '#F7F6F4', white: '#FFFFFF', border: '#E0DFDD', black: '#0A0A0A',
  red: '#D93518', muted: '#6B6B6B', t3: '#ADADAD', stone: '#F0EDE8',
};
const FONT       = 'Barlow_400Regular';
const FONT_MED   = 'Barlow_500Medium';
const FONT_LIGHT = 'Barlow_300Light';

const ACTIVITIES: { id: ActivityType; label: string; emoji: string; bg: string }[] = [
  { id: 'run',      label: 'Run',      emoji: '🏃', bg: '#FDE8E4' },
  { id: 'walk',     label: 'Walk',     emoji: '🚶', bg: '#D1FAE5' },
  { id: 'cycle',    label: 'Cycle',    emoji: '🚴', bg: '#E0F2FE' },
  { id: 'hike',     label: 'Hike',     emoji: '⛰️', bg: '#FEF3C7' },
  { id: 'trail',    label: 'Trail',    emoji: '🌲', bg: '#DCFCE7' },
  { id: 'interval', label: 'Intervals',emoji: '🔁', bg: '#EDE9FE' },
  { id: 'long_run', label: 'Long Run', emoji: '📈', bg: '#FFEDD5' },
];

interface RunSetupSheetProps {
  sheetAnim: Animated.Value;
  panHandlers: object;
  activityType: ActivityType;
  selectedRouteName: string | null;
  intelEnemy: number;
  intelNeutral: number;
  intelWeak: number;
  gpsReady: boolean;
  bottomInset: number;
  pacerEnabled: boolean;
  pacerBpm: number;
  pacerPace: string;
  onPacerToggle: () => void;
  onActivityPress: () => void;
  onRoutePress: () => void;
  onStartPress: () => void;
}

export default function RunSetupSheet({
  sheetAnim, panHandlers, activityType, selectedRouteName,
  intelEnemy, intelNeutral, intelWeak, gpsReady, bottomInset,
  pacerEnabled, pacerBpm, pacerPace,
  onPacerToggle, onActivityPress, onRoutePress, onStartPress,
}: RunSetupSheetProps) {
  const activity = ACTIVITIES.find(a => a.id === activityType) ?? ACTIVITIES[0];

  return (
    <Animated.View style={[ss.sheet, { height: sheetAnim }]} {...panHandlers}>
      <View style={ss.handleWrap}><View style={ss.handle} /></View>

      <View style={ss.statsRow}>
        {[
          { label: 'DIST', value: '0.00', unit: 'km' },
          { label: 'TIME', value: '0:00', unit: '' },
          { label: 'PACE', value: '0:00', unit: '/km' },
          { label: 'ZONES', value: String(intelEnemy + intelNeutral), unit: '' },
        ].map((s, i) => (
          <View key={s.label} style={[ss.statCell, i > 0 && ss.statCellBorder]}>
            <Text style={ss.statLabel}>{s.label}</Text>
            <Text style={ss.statValue}>{s.value}{s.unit ? <Text style={ss.statUnit}> {s.unit}</Text> : null}</Text>
          </View>
        ))}
      </View>

      <View style={ss.selectorRow}>
        <Pressable style={[ss.selectorBtn, ss.selectorBtnBorder]} onPress={onActivityPress}>
          <View style={[ss.selectorIcon, { backgroundColor: activity.bg }]}>
            <Text style={{ fontSize: 14 }}>{activity.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ss.selectorMeta}>Activity</Text>
            <Text style={ss.selectorVal}>{activity.label}</Text>
          </View>
          <Text style={ss.chevron}>›</Text>
        </Pressable>
        <Pressable style={ss.selectorBtn} onPress={onRoutePress}>
          <View style={[ss.selectorIcon, { backgroundColor: selectedRouteName ? C.black : C.stone }]}>
            <Text style={{ fontSize: 14 }}>{selectedRouteName ? '✓' : '🗺'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ss.selectorMeta}>Route</Text>
            <Text style={ss.selectorVal} numberOfLines={1}>{selectedRouteName ?? 'None'}</Text>
          </View>
          <Text style={ss.chevron}>›</Text>
        </Pressable>
      </View>

      <View style={ss.intelRow}>
        <View style={[ss.chip, { backgroundColor: '#FDE8E4' }]}><Text style={[ss.chipText, { color: C.red }]}>{intelEnemy} Enemy</Text></View>
        <View style={[ss.chip, { backgroundColor: C.white }]}><Text style={[ss.chipText, { color: C.muted }]}>{intelNeutral} Free</Text></View>
        <View style={[ss.chip, { backgroundColor: '#FFFBEB' }]}><Text style={[ss.chipText, { color: '#B45309' }]}>{intelWeak} Weak</Text></View>
      </View>

      <Pressable style={ss.pacerRow} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPacerToggle(); }}>
        <View style={ss.pacerLeft}>
          <Music2 size={14} color={pacerEnabled ? C.red : C.muted} strokeWidth={1.5} />
          <View>
            <Text style={ss.pacerTitle}>Beat Pacer</Text>
            <Text style={ss.pacerSub}>{pacerEnabled ? `${pacerBpm} BPM · ${pacerPace}/km` : 'Off'}</Text>
          </View>
        </View>
        <Switch value={pacerEnabled} onValueChange={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPacerToggle(); }} trackColor={{ false: C.border, true: C.red }} thumbColor={C.white} />
      </Pressable>

      <View style={[ss.startWrap, { paddingBottom: Math.max(bottomInset, 16) }]}>
        <Pressable style={[ss.startBtn, !gpsReady && ss.startBtnDisabled]} onPress={onStartPress} disabled={!gpsReady}>
          <View style={[ss.startDot, !gpsReady && ss.startDotDisabled]}>
            <Text style={{ color: '#fff', fontSize: 10 }}>▶</Text>
          </View>
          <Text style={ss.startLabel}>{gpsReady ? 'START RUN' : 'WAITING FOR GPS'}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const ss = StyleSheet.create({
  sheet:           { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 0.5, borderColor: C.border, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 8 },
  handleWrap:      { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  handle:          { width: 36, height: 3, borderRadius: 9, backgroundColor: C.border },
  statsRow:        { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, backgroundColor: C.white, borderRadius: 14, borderWidth: 0.5, borderColor: C.border, overflow: 'hidden' },
  statCell:        { flex: 1, alignItems: 'center', paddingVertical: 10 },
  statCellBorder:  { borderLeftWidth: 0.5, borderLeftColor: C.border },
  statLabel:       { fontFamily: FONT, fontSize: 8, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 },
  statValue:       { fontFamily: FONT_LIGHT, fontSize: 20, color: C.black, lineHeight: 24, marginTop: 2 },
  statUnit:        { fontFamily: FONT, fontSize: 9, color: C.muted },
  selectorRow:     { flexDirection: 'row', marginHorizontal: 16, marginBottom: 10, backgroundColor: C.white, borderRadius: 12, borderWidth: 0.5, borderColor: C.border, overflow: 'hidden' },
  selectorBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12 },
  selectorBtnBorder:{ borderRightWidth: 0.5, borderRightColor: C.border },
  selectorIcon:    { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  selectorMeta:    { fontFamily: FONT, fontSize: 8, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 },
  selectorVal:     { fontFamily: FONT_MED, fontSize: 12, color: C.black, marginTop: 1 },
  chevron:         { fontFamily: FONT_LIGHT, fontSize: 16, color: C.t3 },
  intelRow:        { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 10 },
  chip:            { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9, borderWidth: 0.5, borderColor: C.border },
  chipText:        { fontFamily: FONT, fontSize: 11 },
  pacerRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginBottom: 10, backgroundColor: C.white, borderRadius: 12, borderWidth: 0.5, borderColor: C.border, paddingVertical: 10, paddingHorizontal: 14 },
  pacerLeft:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pacerTitle:      { fontFamily: FONT_MED, fontSize: 12, color: C.black },
  pacerSub:        { fontFamily: FONT_LIGHT, fontSize: 10, color: C.muted, marginTop: 1 },
  startWrap:       { paddingHorizontal: 16, marginTop: 'auto' },
  startBtn:        { backgroundColor: C.black, borderRadius: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  startBtnDisabled:{ backgroundColor: '#D1D5DB' },
  startDot:        { width: 34, height: 34, borderRadius: 17, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' },
  startDotDisabled:{ backgroundColor: '#9CA3AF' },
  startLabel:      { fontFamily: FONT_MED, fontSize: 14, color: '#fff', letterSpacing: 1.5 },
});
