import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';

const C = { white: '#FFFFFF', black: '#0A0A0A', red: '#D93518', mid: '#E0DFDD', muted: '#6B6B6B' };
const FONT      = 'Barlow_400Regular';
const FONT_SEMI = 'Barlow_600SemiBold';
const FONT_BOLD = 'Barlow_700Bold';

function fmt(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

interface FinishConfirmSheetProps {
  distance: number;
  elapsed: number;
  territoriesClaimed: number;
  bottomInset: number;
  onKeepRunning: () => void;
  onFinish: () => void;
}

export default function FinishConfirmSheet({
  distance, elapsed, territoriesClaimed, bottomInset, onKeepRunning, onFinish,
}: FinishConfirmSheetProps) {
  return (
    <Pressable style={ss.overlay} onPress={onKeepRunning}>
      <Pressable style={[ss.sheet, { paddingBottom: bottomInset + 16 }]}>
        <Text style={ss.title}>End Run?</Text>
        <Text style={ss.sub}>{distance.toFixed(2)} km · {fmt(elapsed)} · {territoriesClaimed} territories</Text>
        <View style={ss.actions}>
          <Pressable style={ss.cancel} onPress={onKeepRunning}>
            <Text style={ss.cancelText}>Keep Running</Text>
          </Pressable>
          <Pressable style={ss.finish} onPress={onFinish}>
            <Text style={ss.finishText}>Finish</Text>
          </Pressable>
        </View>
      </Pressable>
    </Pressable>
  );
}

const ss = StyleSheet.create({
  overlay:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', zIndex: 100 },
  sheet:      { backgroundColor: C.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  title:      { fontFamily: FONT_BOLD, fontSize: 18, color: C.black, textAlign: 'center', marginBottom: 8 },
  sub:        { fontFamily: FONT, fontSize: 13, color: C.muted, textAlign: 'center', marginBottom: 24 },
  actions:    { flexDirection: 'row', gap: 12 },
  cancel:     { flex: 1, paddingVertical: 14, borderRadius: 3, borderWidth: 1, borderColor: C.mid, alignItems: 'center' },
  cancelText: { fontFamily: FONT_SEMI, fontSize: 14, color: C.black },
  finish:     { flex: 1, paddingVertical: 14, borderRadius: 3, backgroundColor: C.red, alignItems: 'center' },
  finishText: { fontFamily: FONT_SEMI, fontSize: 14, color: C.white },
});
