import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Flag } from 'lucide-react-native';
import { HeroRing } from './HeroRing';
import { useTheme, Fonts, type AppColors } from '@theme';

interface Props {
  weeklyKm: number;
  goalKm:   number;
  /** Lifetime run count > 0 — distinguishes "slow week" (ring stays, normal
   *  caption) from "never run" (ring suppressed, onboarding-style prompt).
   *  A 0km week is a normal week for an established runner; it's a different
   *  moment entirely for someone who's never logged a run at all. */
  hasRunHistory: boolean;
  onPress?: () => void;
}

export function WeeklyRing({ weeklyKm, goalKm, hasRunHistory, onPress }: Props) {
  const C  = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);

  // Never run — narrative copy unchanged, a dashed empty ring added above it
  // rather than the number ring, which would otherwise show a hollow "0km"
  // that reads as a broken/failed week instead of a not-yet-started one.
  if (!hasRunHistory) {
    return (
      <View style={ss.emptyContent}>
        <Pressable onPress={onPress} disabled={!onPress}>
          <HeroRing size={64} trackColor="rgba(255,255,255,0.22)" trackDashed>
            <Flag size={22} color="rgba(255,255,255,0.5)" strokeWidth={1.5} />
          </HeroRing>
        </Pressable>
        <Text style={ss.emptyHeadline}>Your city hasn’t been claimed yet.</Text>
        <Text style={ss.emptyBody}>Run once and I’ll set your weekly goal — every km stakes new ground.</Text>
      </View>
    );
  }

  const hasWeekKm = weeklyKm > 0;
  const pct = goalKm > 0 ? weeklyKm / goalKm : 0;

  // Ring only, no text — the km number/caption this used to carry is gone;
  // the ring itself (plus the History tap-through) is the whole story here.
  return (
    <View style={ss.content}>
      <Pressable onPress={onPress} disabled={!onPress}>
        <HeroRing
          size={76}
          trackColor="rgba(255,255,255,0.15)"
          pct={hasWeekKm ? pct : 0}
          arcColor={hasWeekKm ? '#000000' : undefined}
        />
      </Pressable>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    content:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },

    emptyContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 28, gap: 10 },
    emptyHeadline:{ fontFamily: Fonts.display, fontSize: 20, lineHeight: 25, color: C.white, textAlign: 'center' },
    emptyBody:    { fontFamily: Fonts.regular, fontSize: 12.5, lineHeight: 18, color: 'rgba(255,255,255,0.5)', textAlign: 'center' },
  });
}
