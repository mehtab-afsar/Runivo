/**
 * Plan a loop (PRD M2): pick a distance and what the loop is for; the map
 * shows the suggested loop; Start follows it as a route.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import { X } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import { planLoop, type LoopMode, type LoopPlan, type LoopZone } from '@shared/engine/planLoop';
import { compass } from '@shared/engine/targetZone';

const LENGTHS = [2, 3, 5, 8];

interface Props {
  zones: LoopZone[];
  bottomInset: number;
  onPlan: (p: LoopPlan | null) => void;
  onStart: (p: LoopPlan) => void;
  onClose: () => void;
}

export default function PlanLoopSheet({ zones, bottomInset, onPlan, onStart, onClose }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const [km, setKm] = useState(3);
  const [mode, setMode] = useState<LoopMode>(zones.some(z => z.fading) ? 'refresh' : 'new');
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [noFix, setNoFix] = useState(false);
  const [plan, setPlan] = useState<LoopPlan | null>(null);

  useEffect(() => {
    (async () => {
      const last = await Location.getLastKnownPositionAsync().catch(() => null);
      const fix = last ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null);
      if (fix) setPos({ lat: fix.coords.latitude, lng: fix.coords.longitude }); else setNoFix(true);
    })();
  }, []);

  useEffect(() => {
    if (!pos) return;
    const p = planLoop(pos, km * 1000, mode, zones);
    setPlan(p);
    onPlan(p);
  }, [pos, km, mode, zones]); // eslint-disable-line react-hooks/exhaustive-deps

  const outcome = !plan ? '' : mode === 'refresh'
    ? (plan.refreshes ? `Runs through ${plan.refreshes} of your fading zone${plan.refreshes > 1 ? 's' : ''}` : 'No fading zones within reach, so this loop heads for new ground')
    : `About ${Math.round(plan.newShare * 100)}% of the ground inside is new to you`;

  return (
    <View style={[s.sheet, { paddingBottom: Math.max(bottomInset, 16) }]}>
      <View style={s.head}>
        <Text style={s.title}>Plan a loop</Text>
        <Pressable onPress={() => { onPlan(null); onClose(); }} hitSlop={10} accessibilityLabel="Close"><X size={18} color={C.t2} /></Pressable>
      </View>

      <View style={s.row}>
        {LENGTHS.map(n => (
          <Pressable key={n} style={[s.chip, km === n && s.chipOn]} onPress={() => setKm(n)} accessibilityRole="button" accessibilityState={{ selected: km === n }}>
            <Text style={[s.chipTxt, km === n && s.chipTxtOn]}>{n} km</Text>
          </Pressable>
        ))}
      </View>
      <View style={s.row}>
        {([['refresh', 'Refresh fading zones'], ['new', 'Claim new ground']] as const).map(([m, label]) => (
          <Pressable key={m} style={[s.chip, s.wide, mode === m && s.chipOn]} onPress={() => setMode(m)} accessibilityRole="button" accessibilityState={{ selected: mode === m }}>
            <Text style={[s.chipTxt, mode === m && s.chipTxtOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {noFix ? (
        <Text style={s.sub}>Turn on location to plan a loop from where you are.</Text>
      ) : !plan ? (
        <ActivityIndicator color={C.t2} style={{ marginVertical: 12 }} />
      ) : (
        <>
          <Text style={s.outcome}>{outcome}</Text>
          <Text style={s.sub}>Heads {compass(plan.heading)} and back to where you are. It's a guide line: follow the streets nearest to it.</Text>
          <Pressable style={s.start} onPress={() => onStart(plan)} accessibilityRole="button">
            <Text style={s.startTxt}>Start this loop</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    sheet:   { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18, paddingTop: 14, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 16, elevation: 8 },
    head:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    title:   { fontFamily: Fonts.semiBold, fontSize: 17, color: C.t1 },
    row:     { flexDirection: 'row', gap: 8, marginBottom: 10 },
    chip:    { flex: 1, height: 38, borderRadius: 19, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card },
    wide:    { paddingHorizontal: 6 },
    chipOn:  { backgroundColor: C.t1, borderColor: C.t1 },
    chipTxt: { fontFamily: Fonts.semiBold, fontSize: 13, color: C.t1 },
    chipTxtOn: { color: C.bg },
    outcome: { fontFamily: Fonts.semiBold, fontSize: 14.5, color: C.t1, marginTop: 4 },
    sub:     { fontFamily: Fonts.regular, fontSize: 12.5, color: C.t2, marginTop: 4, lineHeight: 18 },
    start:   { height: 50, borderRadius: 14, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
    startTxt:{ fontFamily: Fonts.semiBold, fontSize: 16, color: C.alwaysLight },
  });
}
