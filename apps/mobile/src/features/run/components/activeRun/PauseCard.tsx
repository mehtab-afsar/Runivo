import React, { useEffect, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { useSharedValue, withSpring, useAnimatedStyle } from 'react-native-reanimated';
import { Play } from 'phosphor-react-native';
import { useTheme, Type, Fonts, type AppColors } from '@theme';
import { convertKm, convertPaceStringPerKm } from '@mobile/shared/lib/formatters';
import { fmtTime } from '../../utils/activeRunFormatters';

interface Props {
  isPaused: boolean;
  bottomInset: number;
  elapsed: number;
  distance: number;
  pace: string;
  unit: 'km' | 'mi';
  onResume: () => void;
  onFinish: () => void;
}

/** Dimmed overlay plus the slide-up pause card (Reanimated) instead of a native alert. */
export default function PauseCard({ isPaused, bottomInset, elapsed, distance, pace, unit, onResume, onFinish }: Props) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);

  // ── Pause card animation ───────────────────────────────────────────────────
  const pauseCardY = useSharedValue(400);
  const pauseCardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pauseCardY.value }],
  }));

  useEffect(() => {
    pauseCardY.value = withSpring(isPaused ? 0 : 400, { damping: 22, stiffness: 220 });
  }, [isPaused]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* Pause overlay — dims and absorbs touches only. It must NOT resume on tap: a
          pocket/palm/rain touch would restart the run. Resume is the explicit button below. */}
      {isPaused && <View style={ss.pauseOverlay} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />}

      {/* Pause card */}
      <Animated.View
        style={[ss.pauseCard, { paddingBottom: bottomInset + 16 }, pauseCardStyle]}
        pointerEvents={isPaused ? 'auto' : 'none'}
        accessibilityElementsHidden={!isPaused}
        importantForAccessibility={isPaused ? 'auto' : 'no-hide-descendants'}
      >
        <View style={ss.pauseHandle} />
        <Text style={ss.pauseTitle}>Paused</Text>
        <Text style={ss.pauseTime}>{fmtTime(elapsed)}</Text>
        <View style={ss.pauseStats}>
          <View style={ss.pauseStat}>
            <Text style={ss.pauseStatVal}>{convertKm(distance, unit).toFixed(2)}</Text>
            <Text style={ss.pauseStatLbl}>{unit}</Text>
          </View>
          <View style={ss.pauseStatDivider} />
          <View style={ss.pauseStat}>
            <Text style={ss.pauseStatVal}>{convertPaceStringPerKm(pace, unit)}</Text>
            <Text style={ss.pauseStatLbl}>Avg pace /{unit}</Text>
          </View>
        </View>
        <Pressable style={ss.resumeBtn} onPress={onResume} accessibilityRole="button" accessibilityLabel="Resume">
          <Play size={16} color={C.bg} weight="fill" />
          <Text style={ss.resumeBtnTxt}>Resume</Text>
        </Pressable>
        <Pressable style={ss.pauseFinishBtn} onPress={onFinish} accessibilityRole="button" accessibilityLabel="Finish run">
          <View style={ss.finishSquare} />
          <Text style={ss.pauseFinishBtnTxt}>Finish run</Text>
        </Pressable>
      </Animated.View>
    </>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    pauseOverlay:      { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 10 },
    pauseCard:         { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingHorizontal: 24, zIndex: 11, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 20 },
    pauseHandle:       { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 18 },
    pauseTitle:        { ...Type.overline, color: C.t2, textAlign: 'center', marginBottom: 4 },
    pauseTime:         { fontFamily: Fonts.numeric, fontSize: 72, color: C.t1, textAlign: 'center', letterSpacing: -1, lineHeight: 72, marginBottom: 14, fontVariant: ['tabular-nums'] },
    pauseStats:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28, marginBottom: 22 },
    pauseStat:         { alignItems: 'center', gap: 2 },
    pauseStatVal:      { fontFamily: Fonts.numeric, fontSize: 30, color: C.t1, fontVariant: ['tabular-nums'] },
    pauseStatLbl:      { ...Type.caption, color: C.t2 },
    pauseStatDivider:  { width: StyleSheet.hairlineWidth, height: 32, backgroundColor: C.border },
    resumeBtn:         { backgroundColor: C.t1, borderRadius: 30, height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 },
    resumeBtnTxt:      { fontFamily: Fonts.semiBold, fontSize: 16, color: C.bg },
    pauseFinishBtn:    { height: 52, borderRadius: 26, backgroundColor: C.redLo, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    finishSquare:      { width: 12, height: 12, borderRadius: 3, backgroundColor: C.red },
    pauseFinishBtnTxt: { fontFamily: Fonts.semiBold, fontSize: 15, color: C.red },
  });
}
