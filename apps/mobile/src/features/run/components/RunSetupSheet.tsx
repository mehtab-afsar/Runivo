import { SafetyNote } from '@mobile/shared/components/SafetyNote';
import React, { useMemo } from 'react';
import { View, Text, Animated, StyleSheet, TouchableOpacity, Switch, ScrollView, Alert, Linking } from 'react-native';
import * as Haptics from '@theme/hapticsGated';
import { CaretRight, Check, Play, MusicNotes as Music2, PathIcon as RouteIcon, Hexagon, Info, DotsThree } from 'phosphor-react-native';
import type { ActivityType } from '../types';
import { activityMetaFor, SPORTS, MORE_SPORTS, sportFor } from '../constants/activities';
import { useTheme, Type, Fonts, type AppColors } from '@theme';
import { RunPrefChips } from './RunPrefChips';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';

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
  onRoutePress: () => void;
  onStartPress: () => void;
  /** "3 rival zones and 2 fading zones of yours within 1 km" (R3). */
  nearbyLine?: string | null;
}

export default function RunSetupSheet({
  sheetAnim, panHandlers, activityType, selectedRouteName,
  gpsReady, gpsProblem, bottomInset,
  pacerEnabled, pacerPace, pacerPaceOptions, onPacerToggle, onPacerPaceChange,
  onActivityPress, onSportChange, onRoutePress, onStartPress, nearbyLine,
}: RunSetupSheetProps) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const activity = activityMetaFor(activityType);
  const ActivityIcon = activity.icon;
  const sport = sportFor(activityType);
  const moreOn = MORE_SPORTS.some(m => m.id === sport.id);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <Animated.View style={[ss.sheet, { height: sheetAnim }]} {...panHandlers}>
      <View style={ss.handleWrap}><View style={ss.handle} /></View>

      {/* Sport picker, Strava-style: the choice is remembered for next time. */}
      <View style={ss.sports} testID="run-sport-picker">
        {[...SPORTS.slice(0, 4), ...(moreOn ? [sport] : [SPORTS[4]])].map(sp => {
          const on = sp.id === sport.id;
          const Icon = sp.icon;
          return (
            <TouchableOpacity
              key={sp.id}
              style={[ss.sportChip, on && ss.sportChipOn]}
              onPress={() => { if (!on) { Haptics.selectionAsync(); onSportChange(sp.id); } }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              testID={`run-sport-${sp.id}`}
            >
              <Icon size={20} color={on ? C.bg : C.t1} weight={on ? 'fill' : 'regular'} />
              <Text style={[ss.sportTxt, on && ss.sportTxtOn]} numberOfLines={1} adjustsFontSizeToFit>{sp.label}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={ss.sportChip}
          onPress={() => {
            Haptics.selectionAsync();
            Alert.alert('More sports', 'Wheelchair and stroller runs claim zones like a run. Treadmill runs are logged by hand and only count for distance.', [
              ...[...MORE_SPORTS, ...(moreOn ? [SPORTS[4]] : [])].map(sp => ({ text: sp.label, onPress: () => onSportChange(sp.id) })),
              { text: 'Treadmill (log by hand)', onPress: () => navigation.navigate('LogTreadmill') },
              { text: 'Cancel', style: 'cancel' as const },
            ]);
          }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="More sports"
        >
          <DotsThree size={20} color={C.t1} weight="bold" />
          <Text style={ss.sportTxt} numberOfLines={1}>More</Text>
        </TouchableOpacity>
      </View>

      <View style={ss.rule}>
        {sport.claims
          ? <Hexagon size={14} color={C.red} weight="fill" />
          : <Info size={14} color={C.t2} weight="regular" />}
        <Text style={ss.ruleTxt} numberOfLines={1}>
          {sport.claims && nearbyLine
            ? nearbyLine
            : sport.claims
              ? 'Claims zones · earns PACE · keeps your streak'
              : "Tracked only · rides don't claim zones or earn PACE"}
        </Text>
      </View>

      {/* Follow (R1): free run, a route, or today's workout. */}
      <TouchableOpacity style={ss.followRow} onPress={onRoutePress} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={`Follow: ${selectedRouteName ?? 'Free run'}`} testID="run-follow-row">
        <View style={[ss.selectorIcon, { backgroundColor: selectedRouteName ? C.t1 : C.card }]}>
          {selectedRouteName
            ? <Check size={16} color={C.bg} weight="bold" />
            : <RouteIcon size={16} color={C.t2} weight="regular" />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={ss.selectorMeta}>Follow</Text>
          <Text style={ss.selectorVal} numberOfLines={1}>{selectedRouteName ?? 'Free run'}</Text>
        </View>
        <CaretRight size={14} color={C.t3} weight="bold" />
      </TouchableOpacity>

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

      {/* The help line takes this row's space, so Start stays inside the sheet. */}
      {!gpsProblem && <RunPrefChips />}

      {/* Start button */}
      <View style={[ss.startWrap, { paddingBottom: Math.max(bottomInset, 16) }]}>
        {gpsProblem ? (<>
          <Text style={ss.gpsHelp}>
            {gpsProblem === 'denied'
              ? 'Runivo needs your location to track the route and claim ground.'
              : 'Location is switched off on this phone. Turn on Location Services to track a run.'}
          </Text>
          <TouchableOpacity style={ss.startBtn} onPress={() => { Linking.openSettings().catch(() => {}); }} activeOpacity={0.85} testID="run-gps-settings-btn">
            <Text style={ss.startLabel}>{gpsProblem === 'denied' ? 'Allow location in Settings' : 'Open Settings'}</Text>
          </TouchableOpacity>
        </>) : (
          <TouchableOpacity style={[ss.startBtn, !gpsReady && ss.startBtnDisabled]} onPress={onStartPress} disabled={!gpsReady} activeOpacity={0.85} testID="run-start-btn">
            <Play size={18} color={C.white} weight="fill" />
            <Text style={ss.startLabel}>{gpsReady ? `Start ${sport.verb}` : 'Waiting for GPS'}</Text>
          </TouchableOpacity>
        )}
        <SafetyNote kind="run" />
      </View>
    </Animated.View>
  );
}

function mkStyles(C: AppColors) {
  const card = { backgroundColor: C.card, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 } as const;
  return StyleSheet.create({
    sheet:            { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 8 },
    followRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 18, marginBottom: 10, paddingHorizontal: 12, height: 50, borderRadius: 14, borderWidth: 1, borderColor: C.border },
    handleWrap:       { alignItems: 'center', paddingTop: 10, paddingBottom: 8 },
    handle:           { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border },
    sports:           { flexDirection: 'row', gap: 6, paddingHorizontal: 18, paddingTop: 2 },
    sportChip:        { flex: 1, height: 58, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 4, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
    sportChipOn:      { backgroundColor: C.t1, borderColor: C.t1 },
    sportTxt:         { fontFamily: Fonts.semiBold, fontSize: 12, color: C.t1 },
    sportTxtOn:       { color: C.bg },
    rule:             { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 12 },
    ruleTxt:          { flex: 1, fontFamily: Fonts.medium, fontSize: 12, color: C.t2 },
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
    startBtn:         { backgroundColor: C.red, borderRadius: 999, height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, shadowColor: C.red, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
    startBtnDisabled: { backgroundColor: C.t3, shadowOpacity: 0 },
    gpsHelp:          { ...Type.caption, color: C.t2, textAlign: 'center', marginBottom: 10, paddingHorizontal: 12 },
    startLabel:       { fontFamily: Fonts.semiBold, fontSize: 17, color: C.white },
  });
}
