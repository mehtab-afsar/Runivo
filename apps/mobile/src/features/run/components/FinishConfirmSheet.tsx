import React, { useMemo } from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useTheme, Fonts, type AppColors } from '@theme';

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
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
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

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    overlay:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', zIndex: 100 },
    sheet:      { backgroundColor: C.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
    title:      { fontFamily: Fonts.bold, fontSize: 18, color: C.black, textAlign: 'center', marginBottom: 8 },
    sub:        { fontFamily: Fonts.regular, fontSize: 13, color: C.muted, textAlign: 'center', marginBottom: 24, fontVariant: ['tabular-nums'] },
    actions:    { flexDirection: 'row', gap: 12 },
    cancel:     { flex: 1, paddingVertical: 14, borderRadius: 3, borderWidth: 0.5, borderColor: C.mid, alignItems: 'center' },
    cancelText: { fontFamily: Fonts.semiBold, fontSize: 14, color: C.black },
    finish:     { flex: 1, paddingVertical: 14, borderRadius: 3, backgroundColor: C.red, alignItems: 'center' },
    finishText: { fontFamily: Fonts.semiBold, fontSize: 14, color: C.white },
  });
}
