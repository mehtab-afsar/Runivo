/**
 * Countdown length and auto-pause as chips on the start sheet (R6), so they
 * aren't buried in Settings. Tapping cycles the value and saves it.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from '@theme/hapticsGated';
import { Timer, PauseCircle, Heartbeat } from 'phosphor-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { getSettings, saveSettings } from '@shared/services/store';
import { useTheme, Fonts, type AppColors } from '@theme';

const COUNTDOWNS = [0, 3, 5] as const;

export function RunPrefChips() {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [countdown, setCountdown] = useState<0 | 3 | 5>(3);
  const [autoPause, setAutoPause] = useState(true);
  useEffect(() => {
    getSettings().then(st => { setCountdown(st.countdownSeconds ?? 3); setAutoPause(st.autoPause ?? true); }).catch(() => {});
  }, []);

  const save = async (patch: { countdownSeconds?: 0 | 3 | 5; autoPause?: boolean }) => {
    Haptics.selectionAsync();
    const st = await getSettings();
    await saveSettings({ ...st, ...patch });
  };
  const nextCountdown = () => {
    const n = COUNTDOWNS[(COUNTDOWNS.indexOf(countdown) + 1) % COUNTDOWNS.length];
    setCountdown(n); save({ countdownSeconds: n });
  };
  const togglePause = () => { const v = !autoPause; setAutoPause(v); save({ autoPause: v }); };

  return (
    // Wraps instead of scrolling sideways: a chip cut at the screen edge read as broken.
    <View style={[s.row, { marginBottom: 12 }]}>
      <Pressable hitSlop={8} style={s.chip} onPress={nextCountdown} accessibilityRole="button" accessibilityLabel={`Countdown ${countdown ? `${countdown} seconds` : 'off'}. Change`}>
        <Timer size={14} color={C.t1} />
        <Text style={s.txt}>Countdown {countdown ? `${countdown}s` : 'off'}</Text>
      </Pressable>
      <Pressable hitSlop={8} style={[s.chip, autoPause && s.chipOn]} onPress={togglePause} accessibilityRole="switch" accessibilityState={{ checked: autoPause }} accessibilityLabel="Auto-pause">
        <PauseCircle size={14} color={autoPause ? C.bg : C.t1} />
        <Text style={[s.txt, autoPause && s.txtOn]}>Auto-pause {autoPause ? 'on' : 'off'}</Text>
      </Pressable>
      {/* R4: pair a heart-rate strap or watch from here. */}
      <Pressable hitSlop={8} style={s.chip} onPress={() => navigation.navigate('ConnectedDevices')} accessibilityRole="button">
        <Heartbeat size={14} color={C.t1} />
        <Text style={s.txt}>Watch or HR strap</Text>
      </Pressable>
    </View>
  );
}

function mk(C: AppColors) {
  return StyleSheet.create({
    row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, paddingHorizontal: 18 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
    chipOn: { backgroundColor: C.t1, borderColor: C.t1 },
    txt: { fontFamily: Fonts.semiBold, fontSize: 12.5, color: C.t1 },
    txtOn: { color: C.bg },
  });
}
