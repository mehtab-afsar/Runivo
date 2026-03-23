/**
 * BeatPacerChip — in-run HUD chip showing BPM + mute toggle + pulse dot.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { Volume2, VolumeX } from 'lucide-react-native';

const C = { bg: 'rgba(10,10,10,0.75)', border: 'rgba(255,255,255,0.12)', text: '#fff', muted: 'rgba(255,255,255,0.5)', red: '#D93518' };

interface Props {
  bpm: number;
  enabled: boolean;
  onToggle: () => void;
}

export default function BeatPacerChip({ bpm, enabled, onToggle }: Props) {
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
    <Pressable style={ss.chip} onPress={onToggle} hitSlop={8}>
      <Animated.View style={[ss.dot, { transform: [{ scale: pulse }] }, !enabled && ss.dotMuted]} />
      <Text style={ss.bpm}>{bpm}</Text>
      <Text style={ss.unit}>BPM</Text>
      {enabled
        ? <Volume2 size={12} color={C.text} strokeWidth={1.5} />
        : <VolumeX size={12} color={C.muted} strokeWidth={1.5} />}
    </Pressable>
  );
}

const ss = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.bg, borderWidth: 0.5, borderColor: C.border,
    borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.red },
  dotMuted: { backgroundColor: C.muted },
  bpm: { fontFamily: 'Barlow_600SemiBold', fontSize: 13, color: C.text },
  unit: { fontFamily: 'Barlow_400Regular', fontSize: 10, color: C.muted, marginRight: 2 },
});
