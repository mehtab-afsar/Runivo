import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { Mission } from '@shared/services/missions';
import { DifficultyBadge } from './DifficultyBadge';

const C = {
  white: '#FFFFFF', stone: '#F0EDE8', border: '#DDD9D4', black: '#0A0A0A',
  t2: '#6B6B6B', red: '#D93518', green: '#1A6B40', greenLo: '#EDF7F2', amber: '#9E6800',
};

const TYPE_EMOJI: Record<string, string> = {
  run_distance:        '📍',
  claim_territories:   '⚡',
  fortify_territories: '🛡️',
  explore_new_hexes:   '🗺️',
  run_in_enemy_zone:   '⚔️',
  capture_enemy:       '🏴',
  speed_run:           '💨',
  run_streak:          '🔥',
  complete_run:        '✅',
  beat_pace:           '⏱️',
};

interface MissionCardProps {
  mission: Mission;
  onClaim: (id: string) => void;
}

export function MissionCard({ mission, onClaim }: MissionCardProps) {
  const pct = Math.min(1, mission.current / mission.target);
  const diff = (mission.difficulty ?? 'medium') as 'easy' | 'medium' | 'hard';
  const emoji = TYPE_EMOJI[mission.type] ?? '🎯';

  return (
    <View style={[ss.card, mission.claimed && ss.cardClaimed]}>
      <View style={ss.cardRow}>
        <View style={ss.iconBox}>
          <Text style={{ fontSize: 18 }}>{emoji}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <View style={ss.titleRow}>
            <Text style={ss.missionTitle} numberOfLines={1}>{mission.title}</Text>
            <DifficultyBadge difficulty={diff} />
          </View>
          <Text style={ss.missionDesc} numberOfLines={2}>{mission.description}</Text>
        </View>
      </View>

      <View style={ss.progressBg}>
        <View style={[ss.progressFill, { flex: pct, backgroundColor: mission.completed ? C.green : C.red }]} />
        <View style={{ flex: 1 - pct }} />
      </View>

      <View style={ss.cardFooter}>
        <Text style={ss.progressText}>
          {mission.completed ? 'Completed!' : `${mission.current} / ${mission.target}`}
        </Text>
        <View style={ss.rewardRow}>
          {mission.rewards.xp > 0 && <Text style={ss.rewardText}>+{mission.rewards.xp} XP</Text>}
          {mission.rewards.coins > 0 && <Text style={[ss.rewardText, { color: C.amber }]}> +{mission.rewards.coins}💰</Text>}
        </View>
      </View>

      {mission.completed && !mission.claimed && (
        <Pressable style={ss.claimBtn} onPress={() => onClaim(mission.id)}>
          <Text style={ss.claimBtnLabel}>Claim reward →</Text>
        </Pressable>
      )}
      {mission.claimed && (
        <View style={ss.claimedBanner}>
          <Text style={ss.claimedText}>✓ Reward claimed</Text>
        </View>
      )}
    </View>
  );
}

const ss = StyleSheet.create({
  card: { backgroundColor: C.white, borderRadius: 14, borderWidth: 0.5, borderColor: C.border, padding: 14 },
  cardClaimed: { opacity: 0.7 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: C.stone, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' },
  missionTitle: { fontFamily: 'Barlow_500Medium', fontSize: 13, color: C.black, flex: 1 },
  missionDesc: { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t2, lineHeight: 16 },
  progressBg: { height: 3, backgroundColor: '#E8E4DF', borderRadius: 2, overflow: 'hidden', marginBottom: 8, flexDirection: 'row' },
  progressFill: { height: 3 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressText: { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t2 },
  rewardRow: { flexDirection: 'row', alignItems: 'center' },
  rewardText: { fontFamily: 'Barlow_400Regular', fontSize: 11, color: C.green },
  claimBtn: { marginTop: 10, backgroundColor: C.black, borderRadius: 4, paddingVertical: 10, alignItems: 'center' },
  claimBtnLabel: { fontFamily: 'Barlow_500Medium', fontSize: 12, color: '#fff', textTransform: 'uppercase', letterSpacing: 1 },
  claimedBanner: { marginTop: 10, backgroundColor: C.greenLo, borderRadius: 6, paddingVertical: 8, alignItems: 'center' },
  claimedText: { fontFamily: 'Barlow_400Regular', fontSize: 11, color: C.green },
});
