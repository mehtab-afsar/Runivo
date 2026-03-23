import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Avatar } from './Avatar';

const C = {
  bg: '#F8F6F3', white: '#FFFFFF', stone: '#F0EDE8',
  mid: '#E8E4DF', border: '#DDD9D4', black: '#0A0A0A',
  t2: '#6B6B6B', t3: '#ADADAD', red: '#D93518',
};

interface StatPillProps {
  label: string;
  value: string;
}

function StatPill({ label, value }: StatPillProps) {
  return (
    <View style={ss.statPill}>
      <Text style={ss.statPillValue}>{value}</Text>
      <Text style={ss.statPillLabel}>{label}</Text>
    </View>
  );
}

interface ProfileHeaderProps {
  displayName: string;
  bio: string;
  avatarColor: string;
  level: number;
  xpPercent: number;
  totalKm: number;
  totalRuns: number;
  totalTerritories: number;
  thisWeekKm: number;
  weeklyGoalKm: number;
  onEditPress: () => void;
  onNotificationsPress: () => void;
  onSettingsPress: () => void;
}

export function ProfileHeader({
  displayName,
  bio,
  avatarColor,
  level,
  xpPercent,
  totalKm,
  totalRuns,
  totalTerritories,
  thisWeekKm,
  weeklyGoalKm,
  onEditPress,
  onNotificationsPress,
  onSettingsPress,
}: ProfileHeaderProps) {
  const goalPct = Math.min(1, weeklyGoalKm > 0 ? thisWeekKm / weeklyGoalKm : 0);
  const r = xpPercent / 100;

  return (
    <View style={ss.header}>
      <View style={ss.headerTop}>
        <Pressable onPress={onEditPress}>
          <Avatar name={displayName} color={avatarColor} size={60} />
        </Pressable>
        <View style={ss.headerActions}>
          <Pressable style={ss.headerBtn} onPress={onNotificationsPress}>
            <Text style={ss.headerBtnText}>🔔</Text>
          </Pressable>
          <Pressable style={ss.headerBtn} onPress={onSettingsPress}>
            <Text style={ss.headerBtnText}>⚙️</Text>
          </Pressable>
        </View>
      </View>

      <Text style={ss.displayName}>{displayName}</Text>
      {bio ? <Text style={ss.bioText}>{bio}</Text> : null}
      <Text style={ss.levelLabel}>Level {level}</Text>

      <View style={ss.xpBarWrap}>
        <View style={ss.xpBarTrack}>
          <View style={[ss.xpBarFill, { flex: r }]} />
          <View style={{ flex: Math.max(0, 1 - r) }} />
        </View>
      </View>

      <View style={ss.statsRow}>
        <StatPill label="Total km" value={totalKm.toFixed(0)} />
        <StatPill label="Total runs" value={String(totalRuns)} />
        <StatPill label="Territories" value={String(totalTerritories)} />
      </View>

      <View style={ss.weekCard}>
        <View style={ss.weekCardHeader}>
          <Text style={ss.weekCardTitle}>This week</Text>
          <Text style={ss.weekCardGoal}>{thisWeekKm.toFixed(1)} / {weeklyGoalKm} km</Text>
        </View>
        <View style={ss.weekBarBg}>
          <View style={[ss.weekBarFill, { flex: goalPct }]} />
          <View style={{ flex: 1 - goalPct }} />
        </View>
      </View>
    </View>
  );
}

const ss = StyleSheet.create({
  header: { padding: 20, paddingBottom: 0 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.stone, alignItems: 'center', justifyContent: 'center' },
  headerBtnText: { fontSize: 16 },
  displayName: { fontFamily: 'Barlow_600SemiBold', fontSize: 18, color: C.black, marginBottom: 2 },
  bioText: { fontFamily: 'Barlow_300Light', fontSize: 12, color: C.t2, marginBottom: 4, lineHeight: 17 },
  levelLabel: { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.red, marginBottom: 8 },
  xpBarWrap: { height: 3, backgroundColor: C.mid, borderRadius: 2, marginBottom: 16, overflow: 'hidden' },
  xpBarTrack: { flexDirection: 'row', flex: 1 },
  xpBarFill: { height: 3, backgroundColor: C.red },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statPill: {
    flex: 1, backgroundColor: C.white, borderRadius: 10,
    borderWidth: 0.5, borderColor: C.border, padding: 10, alignItems: 'center',
  },
  statPillValue: { fontFamily: 'Barlow_600SemiBold', fontSize: 17, color: C.black, letterSpacing: -0.5 },
  statPillLabel: { fontFamily: 'Barlow_300Light', fontSize: 9, color: C.t3, marginTop: 2 },
  weekCard: {
    backgroundColor: C.white, borderRadius: 12, borderWidth: 0.5, borderColor: C.border,
    padding: 14, marginBottom: 20,
  },
  weekCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  weekCardTitle: { fontFamily: 'Barlow_400Regular', fontSize: 12, color: C.black },
  weekCardGoal: { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t2 },
  weekBarBg: { height: 4, backgroundColor: C.mid, borderRadius: 2, overflow: 'hidden', flexDirection: 'row' },
  weekBarFill: { height: 4, backgroundColor: C.red },
});
