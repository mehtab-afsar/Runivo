/**
 * Record → "Choose a sport" (Strava's grouped list). Sports that claim zones
 * and earn PACE first, then the ones that are only tracked.
 */
import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Modal } from 'react-native';
import { Check, Barbell } from 'phosphor-react-native';
import * as Haptics from '@theme/hapticsGated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Fonts, type AppColors } from '@theme';
import { ENGINE } from '@shared/engine/runEngine';
import type { ActivityType } from '../types';
import { SPORTS, MORE_SPORTS, type Sport } from '../constants/activities';

export function SportSheet({ visible, current, onPick, onTreadmill, onClose }: {
  visible: boolean; current: ActivityType;
  onPick: (id: ActivityType) => void; onTreadmill: () => void; onClose: () => void;
}) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const insets = useSafeAreaInsets();
  const all = [...SPORTS, ...MORE_SPORTS];
  const claims = all.filter(sp => sp.claims);
  const tracked = all.filter(sp => !sp.claims);

  const Row = ({ sp }: { sp: Sport }) => {
    const on = sp.id === current;
    const Icon = sp.icon;
    return (
      <Pressable
        style={s.row} onPress={() => { Haptics.selectionAsync(); onPick(sp.id); onClose(); }}
        accessibilityRole="radio" accessibilityState={{ checked: on }}
      >
        <Icon size={24} color={on ? C.green : C.t1} weight={on ? 'fill' : 'regular'} />
        <Text style={[s.rowTxt, on && s.rowTxtOn]}>{sp.label}</Text>
        {on && <Check size={20} color={C.green} weight="bold" />}
      </Pressable>
    );
  };

  return (
    // A real Modal: it sits above the start panel and the map, so it never
    // pushes or hides the panel behind it, and its list scrolls in full.
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={[s.sheet, { paddingBottom: insets.bottom + 8 }]} accessibilityViewIsModal>
      <View style={s.grab} />
      <View style={s.head}>
        <Text style={s.title} accessibilityRole="header">Choose a sport</Text>
      </View>
      <ScrollView contentContainerStyle={s.body} accessibilityRole="radiogroup">
        <View style={s.groupHead}>
          <Text style={s.group}>Claims zones</Text>
          <Text style={[s.groupNote, { color: C.green }]}>{ENGINE.PACE_PER_KM} PACE / km</Text>
        </View>
        {claims.map(sp => <Row key={sp.id} sp={sp} />)}

        <View style={[s.groupHead, { marginTop: 10 }]}>
          <Text style={s.group}>Tracked only</Text>
          <Text style={s.groupNote}>no zones or PACE</Text>
        </View>
        {tracked.map(sp => <Row key={sp.id} sp={sp} />)}
        <Pressable style={s.row} onPress={() => { onClose(); onTreadmill(); }} accessibilityRole="button">
          <Barbell size={24} color={C.t1} />
          <Text style={s.rowTxt}>Treadmill <Text style={s.rowSub}>· logged by hand</Text></Text>
        </Pressable>
      </ScrollView>
      </View>
    </Modal>
  );
}

function mk(C: AppColors) {
  return StyleSheet.create({
    scrim:     { flex: 1, backgroundColor: 'rgba(23,24,26,0.42)' },
    sheet:     { maxHeight: '82%', backgroundColor: C.card, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 10 },
    grab:      { width: 40, height: 5, borderRadius: 3, backgroundColor: C.border, alignSelf: 'center', marginBottom: 12 },
    head:      { paddingHorizontal: 20, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
    title:     { fontFamily: Fonts.semiBold, fontSize: 22, color: C.t1 },
    body:      { paddingHorizontal: 20, paddingBottom: 36 },
    groupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 14, paddingBottom: 4 },
    group:     { fontFamily: Fonts.semiBold, fontSize: 17, color: C.t1 },
    groupNote: { fontFamily: Fonts.semiBold, fontSize: 12, color: C.t2 },
    row:       { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 14 },
    rowTxt:    { flex: 1, fontFamily: Fonts.regular, fontSize: 17, color: C.t1 },
    rowTxtOn:  { fontFamily: Fonts.semiBold, color: C.green },
    rowSub:    { fontFamily: Fonts.regular, fontSize: 14, color: C.t2 },
  });
}
