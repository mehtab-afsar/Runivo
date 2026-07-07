/**
 * BeatPacerChip — in-run HUD chip showing BPM + mute toggle + pulse dot.
 */
import React, { useEffect, useRef, useMemo } from 'react';
import { Text, Pressable, StyleSheet, Animated } from 'react-native';
import { SpeakerHigh as Volume2, SpeakerSlash as VolumeX } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';

interface Props {
  bpm: number;
  enabled: boolean;
  onToggle: () => void;
}

export default function BeatPacerChip({ bpm, enabled, onToggle }: Props) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!enabled) {
      pulse.setValue(1);
      return;
    }
    const intervalMs = 60_000 / bpm;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.5, duration: 80, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: intervalMs - 80, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [enabled, bpm, pulse]);

  return (
    <Pressable style={[ss.chip, enabled && ss.chipEnabled]} onPress={onToggle} hitSlop={8}>
      <Animated.View style={[ss.dot, { transform: [{ scale: pulse }] }, enabled && ss.dotEnabled]} />
      <Text style={[ss.bpm, enabled && ss.bpmEnabled]}>{bpm}</Text>
      <Text style={[ss.unit, enabled && ss.unitEnabled]}>BPM</Text>
      {enabled
        ? <Volume2 size={12} color="rgba(255,255,255,0.7)" weight="light" />
        : <VolumeX size={12} color={C.muted} weight="light" />}
    </Pressable>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    chip:        { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
    chipEnabled: { backgroundColor: C.red, borderColor: C.red },
    dot:         { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)' },
    dotEnabled:  { backgroundColor: C.white },
    bpm:         { fontFamily: Fonts.semiBold, fontSize: 13, color: 'rgba(255,255,255,0.6)', fontVariant: ['tabular-nums'] },
    bpmEnabled:  { color: C.white },
    unit:        { fontFamily: Fonts.regular, fontSize: 10, color: 'rgba(255,255,255,0.55)', marginRight: 2 },
    unitEnabled: { color: 'rgba(255,255,255,0.7)' },
  });
}
