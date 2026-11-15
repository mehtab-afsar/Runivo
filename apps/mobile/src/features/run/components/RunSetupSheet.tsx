import { SafetyNote } from '@mobile/shared/components/SafetyNote';
import React, { useMemo } from 'react';
import { View, Text, Animated, StyleSheet, TouchableOpacity, Switch, ScrollView, Linking } from 'react-native';
import * as Haptics from '@theme/hapticsGated';
import { CaretRight, Check, MusicNotes as Music2, PathIcon as RouteIcon, Hexagon, Info } from 'phosphor-react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import { ENGINE } from '@shared/engine/runEngine';
import type { ActivityType } from '../types';
import { activityMetaFor, sportFor } from '../constants/activities';
import { useTheme, Type, Fonts, type AppColors } from '@theme';
import { RunPrefChips } from './RunPrefChips';

/** Route and Beat Pacer pickers are not in the v1 design; they stay built for later. */
const RUN_OPTIONS = false;

interface RunSetupSheetProps {
  sheetAnim: Animated.Value;
  panHandlers: object;
  activityType: ActivityType;
  selectedRouteName: string | null;
  gpsReady: boolean;
  /** Set when there's no GPS because of permission or the phone's location switch. */
  gpsProblem?: 'denied' | 'off';
  bottomInset: number;
  pacerEnabled: boolean;
  pacerPace: string;
  pacerPaceOptions: string[];
  onPacerToggle: () => void;
  onPacerPaceChange: (pace: string) => void;
  onActivityPress: () => void;
  onSportChange: (id: ActivityType) => void;
  /** Opens the full Choose a sport sheet (rendered by the screen). */
  onMoreSports: () => void;
  onRoutePress: () => void;
  onStartPress: () => void;
  /** "3 rival zones and 2 fading zones of yours within 1 km" (R3). */
  nearbyLine?: string | null;
  /** Current streak, shown as a chip. */
  streakDays?: number;
}

export default function RunSetupSheet({
  sheetAnim, panHandlers, activityType, selectedRouteName,
  gpsReady, gpsProblem, bottomInset,
  pacerEnabled, pacerPace, pacerPaceOptions, onPacerToggle, onPacerPaceChange,
  onActivityPress, onSportChange: _onSportChange, onMoreSports, onRoutePress, onStartPress, nearbyLine, streakDays = 0,
}: RunSetupSheetProps) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const activity = activityMetaFor(activityType);
  const ActivityIcon = activity.icon;
  const sport = sportFor(activityType);
  const SportIcon = sport.icon;

  return (
    <Animated.View style={[ss.sheet, { height: sheetAnim }]} {...panHandlers}>
      <View style={ss.handleWrap}><View style={ss.handle} /></View>

      {/* What you're following: today's session, a route, or a free run (mock). */}
      <TouchableOpacity style={ss.follow} onPress={onRoutePress} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`Following: ${selectedRouteName ?? 'free run'}. Change`} testID="run-follow-row">
        <View style={ss.followThumb}>
          <RouteIcon size={22} color={selectedRouteName ? C.green : C.t2} weight="bold" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={ss.followMeta}>{selectedRouteName ? 'FOLLOWING' : 'FREE RUN'}</Text>
          <Text style={ss.followVal} numberOfLines={1}>{selectedRouteName ?? (sport.claims && nearbyLine ? nearbyLine : 'Run anywhere, close a loop to claim')}</Text>
        </View>
        <Text style={ss.change}>{selectedRouteName ? 'Change' : 'Pick'}</Text>
      </TouchableOpacity>

      <View style={ss.chips}>
        {sport.claims ? (<>
          <View style={[ss.chip, { backgroundColor: C.mint }]}><Hexagon size={12} color={C.brandGreen} weight="fill" /><Text style={[ss.chipTxt, { color: C.green }]}>Claims zones</Text></View>
          <View style={[ss.chip, { backgroundColor: C.amberBg }]}><Text style={[ss.chipTxt, { color: C.amber }]}>{ENGINE.PACE_PER_KM} PACE / km</Text></View>
        </>) : (
          <View style={[ss.chip, { backgroundColor: C.surface }]}><Info size={12} color={C.t2} /><Text style={ss.chipTxt}>Tracked only · no zones or PACE</Text></View>
        )}
        {streakDays > 0 && <View style={[ss.chip, { backgroundColor: C.surface }]}><Text style={ss.chipTxt}>Streak {streakDays} {streakDays === 1 ? 'day' : 'days'}</Text></View>}
      </View>

      {/* Activity and Beat Pacer are off for v1 (not in the design). */}
      {RUN_OPTIONS && (<>
      {/* Activity + Route row */}
      <View style={ss.selectorRow}>
        <TouchableOpacity style={[ss.selectorBtn, ss.selectorBtnBorder]} onPress={onActivityPress} activeOpacity={0.7}>
          <View style={[ss.selectorIcon, { backgroundColor: activity.bg }]}>
            <ActivityIcon size={18} color={activity.color} weight="regular" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ss.selectorMeta}>Activity</Text>
            <Text style={ss.selectorVal}>{activity.label}</Text>
          </View>
          <CaretRight size={14} color={C.t3} weight="bold" />
        </TouchableOpacity>
        <TouchableOpacity style={ss.selectorBtn} onPress={onRoutePress} activeOpacity={0.7}>
          <View style={[ss.selectorIcon, { backgroundColor: selectedRouteName ? C.t1 : C.bg }]}>
            {selectedRouteName
              ? <Check size={16} color={C.bg} weight="bold" />
              : <RouteIcon size={16} color={C.t2} weight="regular" />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ss.selectorMeta}>Route</Text>
            <Text style={ss.selectorVal} numberOfLines={1}>{selectedRouteName ?? 'None'}</Text>
          </View>
          <CaretRight size={14} color={C.t3} weight="bold" />
        </TouchableOpacity>
      </View>

      {/* Beat Pacer toggle */}
      <View style={ss.pacerCard}>
        <TouchableOpacity
          style={ss.pacerRow}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPacerToggle(); }}
          activeOpacity={0.7}
        >
          <View style={[ss.pacerIcon, { backgroundColor: pacerEnabled ? C.redLo : C.bg }]}>
            <Music2 size={16} color={pacerEnabled ? C.red : C.t2} weight="regular" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ss.pacerTitle}>Beat pacer</Text>
            <Text style={ss.pacerSub}>{pacerEnabled ? `${pacerPace}/km rhythm` : 'Off · tap to turn on'}</Text>
          </View>
          <Switch
            value={pacerEnabled}
            onValueChange={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPacerToggle(); }}
            trackColor={{ false: C.border, true: C.red }}
            thumbColor={C.white}
          />
        </TouchableOpacity>

        {/* Pace picker — only when pacer is on */}
        {pacerEnabled && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={ss.paceScroll}
            contentContainerStyle={ss.paceScrollContent}
          >
            {pacerPaceOptions.map(p => {
              const active = p === pacerPace;
              return (
                <TouchableOpacity
                  key={p}
                  style={[ss.paceChip, active && ss.paceChipActive]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPacerPaceChange(p); }}
                  activeOpacity={0.7}
                >
                  <Text style={[ss.paceChipTxt, active && ss.paceChipTxtActive]}>{p}</Text>
                  <Text style={[ss.paceChipUnit, active && ss.paceChipUnitActive]}>/km</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      </>)}

      {!gpsProblem && <RunPrefChips />}

      <View style={[ss.startWrap, { paddingBottom: Math.max(bottomInset, 16) }]}>
        {gpsProblem ? (<>
          <Text style={ss.gpsHelp}>
            {gpsProblem === 'denied'
              ? 'Runivo needs your location to track the route and claim ground.'
              : 'Location is switched off on this phone. Turn on Location Services to track a run.'}
          </Text>
          <TouchableOpacity style={ss.settingsBtn} onPress={() => { Linking.openSettings().catch(() => {}); }} activeOpacity={0.85} testID="run-gps-settings-btn">
            <Text style={ss.settingsLabel}>{gpsProblem === 'denied' ? 'Allow location in Settings' : 'Open Settings'}</Text>
          </TouchableOpacity>
        </>) : (
          <View style={ss.controls}>
            <TouchableOpacity style={ss.side} onPress={() => { Haptics.selectionAsync(); onMoreSports(); }} accessibilityRole="button" accessibilityLabel={`Sport: ${sport.label}. Change`} testID="run-sport-picker">
              <View style={ss.sideIcon}><SportIcon size={26} color={C.t1} /></View>
              <Text style={ss.sideTxt} numberOfLines={1}>{sport.label} ▾</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onStartPress} disabled={!gpsReady} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={gpsReady ? `Start ${sport.verb}` : 'Waiting for GPS'} testID="run-start-btn">
              <Svg width={96} height={96} viewBox="0 0 96 96">
                <Path d="M48 4 86 26v44L48 92 10 70V26Z" fill={gpsReady ? C.alwaysDark : C.t3} strokeLinejoin="round" />
                <SvgText x={48} y={54} textAnchor="middle" fontFamily={Fonts.semiBold} fontSize={gpsReady ? 17 : 12} fill={gpsReady ? C.lime : C.alwaysLight}>{gpsReady ? 'START' : 'FINDING GPS'}</SvgText>
              </Svg>
            </TouchableOpacity>
            <TouchableOpacity style={ss.side} onPress={onRoutePress} accessibilityRole="button" accessibilityLabel="Routes">
              <View style={ss.sideIcon}><RouteIcon size={26} color={C.t1} /></View>
              <Text style={ss.sideTxt}>Route</Text>
            </TouchableOpacity>
          </View>
        )}
        <SafetyNote kind="run" />
      </View>
    </Animated.View>
  );
}

function mkStyles(C: AppColors) {
  const card = { backgroundColor: C.card, borderRadius: 22, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 } as const;
  return StyleSheet.create({
    sheet:            { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.card, borderTopLeftRadius: 34, borderTopRightRadius: 34, shadowColor: '#17181A', shadowOffset: { width: 0, height: -12 }, shadowOpacity: 0.08, shadowRadius: 32, elevation: 8 },
    handleWrap:       { alignItems: 'center', paddingTop: 10, paddingBottom: 12 },
    handle:           { width: 40, height: 5, borderRadius: 3, backgroundColor: C.border },
    follow:           { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, padding: 12, borderRadius: 22, backgroundColor: C.bg },
    followThumb:      { width: 48, height: 48, borderRadius: 14, backgroundColor: C.mint, alignItems: 'center', justifyContent: 'center' },
    followMeta:       { fontFamily: Fonts.medium, fontSize: 12, color: C.t2 },
    followVal:        { fontFamily: Fonts.medium, fontSize: 16, color: C.t1, marginTop: 1 },
    change:           { fontFamily: Fonts.regular, fontSize: 14, color: C.t2 },
    chips:            { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 },
    chip:             { height: 24, paddingHorizontal: 9, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 4 },
    chipTxt:          { fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
    controls:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, marginBottom: 4 },
    side:             { width: 76, alignItems: 'center', gap: 6 },
    sideIcon:         { width: 56, height: 56, borderRadius: 28, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
    sideTxt:          { fontFamily: Fonts.medium, fontSize: 13, color: C.t1 },
    settingsBtn:      { backgroundColor: C.alwaysDark, borderRadius: 999, height: 56, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
    settingsLabel:    { fontFamily: Fonts.semiBold, fontSize: 16, color: C.alwaysLight },
    selectorRow:      { ...card, flexDirection: 'row', marginHorizontal: 18, marginBottom: 10, overflow: 'hidden' },
    selectorBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14 },
    selectorBtnBorder:{ borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: C.border },
    selectorIcon:     { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    selectorMeta:     { ...Type.caption, color: C.t2 },
    selectorVal:      { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1, marginTop: 1 },
    pacerCard:        { ...card, marginHorizontal: 18, marginBottom: 12, overflow: 'hidden' },
    pacerRow:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
    pacerIcon:        { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    pacerTitle:       { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
    pacerSub:         { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, marginTop: 1 },
    paceScroll:       { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
    paceScrollContent:{ flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
    paceChip:         { flexDirection: 'row', alignItems: 'baseline', gap: 2, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: C.bg },
    paceChipActive:   { backgroundColor: C.t1 },
    paceChipTxt:      { fontFamily: Fonts.numeric, fontSize: 18, color: C.t1, fontVariant: ['tabular-nums'] },
    paceChipTxtActive:{ color: C.bg },
    paceChipUnit:     { fontFamily: Fonts.medium, fontSize: 11, color: C.t2 },
    paceChipUnitActive:{ color: C.bg },
    startWrap:        { paddingHorizontal: 18, marginTop: 'auto' },
    gpsHelp:          { ...Type.caption, color: C.t2, textAlign: 'center', marginBottom: 10, paddingHorizontal: 12 },
  });
}
