import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { Pause, Play, Square } from 'lucide-react-native';
import { Colors } from '@theme';

const C = Colors;

const FONT = 'Barlow_400Regular';

interface RunControlsProps {
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export default function RunControls({ isPaused, onPause, onResume, onStop }: RunControlsProps) {
  return (
    <View style={ss.controls}>
      <Pressable
        style={ss.secondaryControl}
        onPress={isPaused ? onResume : onPause}
      >
        {isPaused
          ? <Play size={22} color={C.black} strokeWidth={2} />
          : <Pause size={22} color={C.black} strokeWidth={2} />}
        <Text style={ss.secondaryControlLabel}>{isPaused ? 'Resume' : 'Pause'}</Text>
      </Pressable>

      <Pressable style={ss.finishBtn} onPress={onStop}>
        <Square size={22} color={C.white} strokeWidth={2} fill={C.white} />
      </Pressable>
    </View>
  );
}

const ss = StyleSheet.create({
  controls: {
    backgroundColor: C.black,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 24,
    paddingTop: 20, paddingHorizontal: 24,
  },
  finishBtn: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: C.red, alignItems: 'center', justifyContent: 'center',
    shadowColor: C.red, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 5,
  },
  secondaryControl: {
    alignItems: 'center', gap: 4, padding: 12,
    borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)',
  },
  secondaryControlLabel: { fontFamily: FONT, fontSize: 10, color: 'rgba(255,255,255,0.5)' },
});
