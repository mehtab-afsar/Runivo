import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MapPin, Map, Flag, Wind, Flame, Timer, Target, Coins, Check, Zap, Shield, Swords, type LucideIcon } from 'lucide-react-native';
import type { Mission } from '@shared/services/missions';
import { DifficultyBadge } from './DifficultyBadge';
import { Colors } from '@theme';

const C = Colors;

const TYPE_ICON: Record<string, { Icon: LucideIcon; color: string }> = {
  run_distance:        { Icon: MapPin,  color: '#D93518' },
  claim_territories:   { Icon: Zap,    color: '#EAB308' },
  fortify_territories: { Icon: Shield, color: '#059669' },
  explore_new_hexes:   { Icon: Map,    color: '#0284C7' },
  run_in_enemy_zone:   { Icon: Swords, color: '#DC2626' },
  capture_enemy:       { Icon: Flag,   color: '#9CA3AF' },
  speed_run:           { Icon: Wind,   color: '#64748B' },
  run_streak:          { Icon: Flame,  color: '#EA580C' },
  complete_run:        { Icon: Check,  color: '#059669' },
  beat_pace:           { Icon: Timer,  color: '#D93518' },
};

interface MissionCardProps {
  mission: Mission;
  onClaim: (id: string) => void;
}

export function MissionCard({ mission, onClaim }: MissionCardProps) {
  const pct = Math.min(1, mission.current / mission.target);
  const diff = (mission.difficulty ?? 'medium') as 'easy' | 'medium' | 'hard';
  const typeIcon = TYPE_ICON[mission.type] ?? { Icon: Target, color: '#D93518' };
  const { Icon: MissionIcon, color: iconColor } = typeIcon;

  return (
    <View style={[ss.card, mission.claimed && ss.cardClaimed]}>
      <View style={ss.cardRow}>
        <View style={ss.iconBox}>
          <MissionIcon size={18} color={iconColor} strokeWidth={1.5} />
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
          {mission.rewards.coins > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[ss.rewardText, { color: C.amber }]}> +{mission.rewards.coins} </Text>
              <Coins size={11} color={C.amber} strokeWidth={1.5} />
            </View>
          )}
        </View>
      </View>

      {mission.completed && !mission.claimed && (
        <Pressable style={ss.claimBtn} onPress={() => onClaim(mission.id)}>
          <Text style={ss.claimBtnLabel}>Claim reward →</Text>
        </Pressable>
      )}
      {mission.claimed && (
        <View style={[ss.claimedBanner, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
          <Check size={12} color={C.green} strokeWidth={2} />
          <Text style={ss.claimedText}>Reward claimed</Text>
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
