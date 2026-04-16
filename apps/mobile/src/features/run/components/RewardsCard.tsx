import React, { useRef, useEffect } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';

const C = { black: '#0A0A0A', white: '#FFFFFF', red: '#D93518', amber: '#9E6800', green: '#1A6B40' };
const FONT       = 'Barlow_400Regular';
const FONT_MED   = 'Barlow_500Medium';
const FONT_LIGHT = 'Barlow_300Light';
const FONT_SEMI  = 'Barlow_600SemiBold';

function XPBar({ fromPct, toPct }: { fromPct: number; toPct: number }) {
  const anim = useRef(new Animated.Value(fromPct)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: toPct, duration: 1400, delay: 500, useNativeDriver: false }).start();
  }, []);
  return (
    <View style={ss.xpTrack}>
      <Animated.View style={[ss.xpFill, { width: anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]} />
    </View>
  );
}

interface RewardsCardProps {
  xp: number;
  level: number;
  xpProgress: number;
  xpNeeded: number;
  xpPercent: number;
  xpPrevPercent: number;
  leveledUp?: boolean;
  preRunLevel?: number;
  newLevel?: number;
  completedMissions?: { id: string; title: string }[];
}

export default function RewardsCard({
  xp, level, xpProgress, xpNeeded,
  xpPercent, xpPrevPercent, leveledUp, preRunLevel, newLevel, completedMissions,
}: RewardsCardProps) {
  return (
    <View style={ss.card}>
      {leveledUp && (
        <View style={ss.levelUpBanner}>
          <Text style={ss.levelUpEmoji}>🎉</Text>
          <View>
            <Text style={ss.levelUpTitle}>Level Up!</Text>
            <Text style={ss.levelUpSub}>Lv {preRunLevel} → Lv {newLevel}</Text>
          </View>
        </View>
      )}

      <View style={ss.xpRow}>
        <Text style={ss.xpLabel}>XP EARNED</Text>
        <Text style={ss.xpValue}>+{xp} <Text style={ss.xpUnit}>XP</Text></Text>
      </View>

      <XPBar fromPct={xpPrevPercent} toPct={xpPercent} />
      <View style={ss.xpRowLabels}>
        <Text style={ss.xpRowLabel}>Lv {level}</Text>
        <Text style={ss.xpRowLabel}>{xpProgress} / {xpNeeded} XP</Text>
        <Text style={ss.xpRowLabel}>Lv {level + 1}</Text>
      </View>

      {(completedMissions?.length ?? 0) > 0 && (
        <View style={{ marginTop: 16 }}>
          <Text style={ss.missionsHeader}>MISSIONS COMPLETED</Text>
          <View style={ss.rewardRows}>
            {completedMissions!.map(m => (
              <View key={m.id} style={ss.rewardRow}>
                <View style={ss.rewardLeft}>
                  <View style={ss.missionCheck}><Text style={ss.missionMark}>✓</Text></View>
                  <Text style={ss.rewardLabel}>{m.title}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const ss = StyleSheet.create({
  card:           { marginHorizontal: 16, marginBottom: 12, backgroundColor: C.black, borderRadius: 4, padding: 20 },
  levelUpBanner:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(217,53,24,0.15)', borderWidth: 1, borderColor: 'rgba(217,53,24,0.3)', borderRadius: 3, padding: 10, marginBottom: 16 },
  levelUpEmoji:   { fontSize: 20 },
  levelUpTitle:   { fontFamily: FONT_SEMI, fontSize: 13, color: C.red },
  levelUpSub:     { fontFamily: FONT, fontSize: 11, color: 'rgba(217,53,24,0.7)', marginTop: 1 },
  xpRow:          { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 },
  xpLabel:        { fontFamily: FONT_SEMI, fontSize: 10, letterSpacing: 1.2, color: 'rgba(255,255,255,0.35)' },
  xpValue:        { fontFamily: FONT_LIGHT, fontSize: 22, color: C.red, letterSpacing: -0.5 },
  xpUnit:         { fontFamily: FONT, fontSize: 12, color: 'rgba(217,53,24,0.7)' },
  xpTrack:        { height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden', marginBottom: 6 },
  xpFill:         { height: '100%', backgroundColor: C.red, borderRadius: 2 },
  xpRowLabels:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  xpRowLabel:     { fontFamily: FONT, fontSize: 10, color: 'rgba(255,255,255,0.3)' },
  rewardRows:     { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' },
  rewardRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#111', padding: 10 },
  rewardLeft:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rewardLabel:    { fontFamily: FONT, fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  rewardValue:    { fontFamily: FONT_LIGHT, fontSize: 16, color: C.amber },
  missionsHeader: { fontFamily: FONT_SEMI, fontSize: 10, letterSpacing: 1.2, color: 'rgba(255,255,255,0.3)', marginBottom: 10 },
  missionCheck:   { width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(26,107,64,0.15)', alignItems: 'center', justifyContent: 'center' },
  missionMark:    { fontSize: 9, color: C.green },
});
