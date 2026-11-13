import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { GAME_CONFIG } from '@shared/services/config';
import { Avatar } from '@mobile/shared/components/Avatar';
import { useTheme, Fonts, Type, type AppColors } from '@theme';

interface ProfileHeaderProps {
  displayName: string;
  username?: string;
  bio: string;
  avatarColor: string;
  avatarUri?: string | null;
  runnerRank: string;
  rankPct: number;
  /** e.g. "Strider → Chaser · 340 / 600 PACE" — computed by the caller from
   *  the existing rank ladder (GAME_CONFIG.RUNNER_RANK_THRESHOLDS), not here. */
  rankCaption: string;
  // kept for compat but not rendered in header
  totalKm: number;
  totalRuns: number;
  totalTerritories: number;
  totalAreaM2: number;
  /** Lifetime PACE, shown in the stat row. */
  paceTotalEarned?: number;
  thisWeekKm: number;
  weeklyGoalKm: number;
  followers: number;
  following: number;
  isOwnProfile?: boolean;
  onEditPress: () => void;
  onNotificationsPress: () => void;
  onSettingsPress: () => void;
  onFollowersPress?: () => void;
  onFollowingPress?: () => void;
  onTerritoryPress?: () => void;
  // unused below but kept for compat
  location?: string;
  instagram?: string;
  strava?: string;
}

const RANK_ORDER = ['pacer', 'strider', 'chaser', 'hunter', 'sovereign'] as const;
const RANK_THRESHOLDS = GAME_CONFIG.RUNNER_RANK_THRESHOLDS as Record<string, number>;

function fmtNum(n: number): string {
  return Math.round(n).toLocaleString();
}

export function ProfileHeader({
  displayName, username, bio, avatarColor, avatarUri,
  runnerRank, rankPct, rankCaption,
  totalKm, totalRuns, totalTerritories, paceTotalEarned,
  followers, following, location,
  isOwnProfile = true,
  onEditPress, onFollowersPress, onFollowingPress, onTerritoryPress,
}: ProfileHeaderProps) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const displayRank = runnerRank.charAt(0).toUpperCase() + runnerRank.slice(1);
  const rankIdx = Math.max(0, RANK_ORDER.indexOf(runnerRank as typeof RANK_ORDER[number]));
  const nextRankKey = RANK_ORDER[rankIdx + 1];
  const nextRank = nextRankKey ? nextRankKey.charAt(0).toUpperCase() + nextRankKey.slice(1) : null;
  const toNext = nextRankKey ? Math.max(0, (RANK_THRESHOLDS[nextRankKey] ?? 0) - (paceTotalEarned ?? 0)) : 0;

  return (
    <View style={ss.header}>
      {/* Top actions */}
      {isOwnProfile && (
        <View style={ss.topBar}>
          <Pressable style={ss.pill} onPress={onEditPress} hitSlop={6}>
            <Text style={ss.pillText}>Edit profile</Text>
          </Pressable>
        </View>
      )}

      {/* Avatar + name */}
      <View style={ss.row}>
        <Pressable onPress={isOwnProfile ? onEditPress : undefined} style={ss.avatarRing}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={ss.avatarImg} />
          ) : (
            <Avatar name={displayName} seed={username} color={avatarColor} size={76} />
          )}
        </Pressable>

        <View style={ss.infoBlock}>
          <Text style={ss.displayName} numberOfLines={1}>{displayName}</Text>
          <Text style={ss.meta} numberOfLines={1}>
            {[username ? `@${username}` : null, location || null].filter(Boolean).join(' · ')}
          </Text>
          {/* Following / Followers, each opening its list — as on Strava. */}
          <View style={ss.follows}>
            <Pressable onPress={onFollowingPress} hitSlop={6} disabled={!onFollowingPress} accessibilityRole="button">
              <Text style={ss.followTxt}><Text style={ss.followNum}>{following}</Text> Following</Text>
            </Pressable>
            <Pressable onPress={onFollowersPress} hitSlop={6} disabled={!onFollowersPress} accessibilityRole="button">
              <Text style={ss.followTxt}><Text style={ss.followNum}>{followers}</Text> {followers === 1 ? 'Follower' : 'Followers'}</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {!!bio && <Text style={ss.bio} numberOfLines={3} maxFontSizeMultiplier={1.2}>{bio}</Text>}

      {/* Rank card */}
      <View style={ss.card}>
        <View style={ss.rankTop}>
          <View style={ss.rankChip}>
            <Text style={ss.rankChipText}>{displayRank}</Text>
          </View>
          <Text style={ss.rankCaption} numberOfLines={1}>
            {nextRank ? <>{toNext.toLocaleString()} PACE to <Text style={ss.rankCaptionStrong}>{nextRank}</Text></> : rankCaption}
          </Text>
        </View>
        <View style={ss.barBg}>
          <View style={[ss.barFill, { width: `${Math.round(Math.max(0.02, Math.min(1, rankPct)) * 100)}%` }]} />
        </View>
        <View style={ss.ladder}>
          {RANK_ORDER.map((r, i) => (
            <Text key={r} style={[ss.ladderStep, i === rankIdx && ss.ladderStepOn]}>
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </Text>
          ))}
        </View>
      </View>

      {/* Numbers */}
      <View style={[ss.card, ss.statRow]}>
        <View style={ss.stat}>
          <Text style={ss.statNum}>{totalKm > 0 && totalKm < 10 ? totalKm.toFixed(1) : fmtNum(totalKm)}</Text>
          <Text style={ss.statLabel}>km</Text>
        </View>
        <View style={[ss.stat, ss.statDivider]}>
          <Text style={ss.statNum}>{fmtNum(totalRuns)}</Text>
          <Text style={ss.statLabel}>Activities</Text>
        </View>
        <Pressable style={[ss.stat, ss.statDivider]} onPress={onTerritoryPress} disabled={!onTerritoryPress}>
          <Text style={[ss.statNum, { color: C.red }]}>{fmtNum(totalTerritories)}</Text>
          <Text style={ss.statLabel}>Zones</Text>
        </Pressable>
        <View style={[ss.stat, ss.statDivider]}>
          <Text style={ss.statNum}>{fmtNum(paceTotalEarned ?? 0)}</Text>
          <Text style={ss.statLabel}>PACE</Text>
        </View>
      </View>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    header:       { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 0, gap: 12 },
    topBar:       { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8 },
    pill:         {
      flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 12,
      borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
    },
    pillText:     { fontFamily: Fonts.semiBold, fontSize: 12.5, color: C.t1 },
    iconBtn:      {
      width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
    },
    row:          { flexDirection: 'row', alignItems: 'center', gap: 14 },
    avatarRing:   { padding: 3, borderRadius: 43, borderWidth: 2, borderColor: C.red },
    avatarImg:    { width: 76, height: 76, borderRadius: 38 },
    infoBlock:    { flex: 1 },
    displayName:  { fontFamily: Fonts.bold, fontSize: 24, lineHeight: 26, letterSpacing: -0.6, color: C.t1 },
    meta:         { fontFamily: Fonts.regular, fontSize: 13, lineHeight: 17, color: C.t2, marginTop: 5 },
    follows:      { flexDirection: 'row', gap: 16, marginTop: 6 },
    followTxt:    { fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
    followNum:    { fontFamily: Fonts.semiBold, color: C.t1 },
    socialLine:   { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 2 },
    socialNum:    { fontFamily: Fonts.semiBold, fontSize: 13, color: C.t1 },
    socialLabel:  { fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
    bio:          { ...Type.bodySm, color: C.t2 },
    card:         {
      backgroundColor: C.card, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 18,
      shadowColor: '#14120F', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1,
    },
    rankTop:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    rankChip:     { backgroundColor: C.t1, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    rankCaptionStrong: { fontFamily: Fonts.bold, color: C.t1 },
    rankChipText: { fontFamily: Fonts.semiBold, fontSize: 11.5, color: C.bg },
    rankCaption:  { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, flexShrink: 1, textAlign: 'right' },
    barBg:        { height: 8, backgroundColor: '#ECEAE5', borderRadius: 9, overflow: 'hidden', marginTop: 12 },
    barFill:      { height: 8, backgroundColor: C.red, borderRadius: 9 },
    ladder:       { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
    ladderStep:   { fontFamily: Fonts.medium, fontSize: 12, color: C.t2 },
    ladderStepOn: { color: C.t1 },
    statRow:      { flexDirection: 'row', paddingHorizontal: 4, paddingVertical: 14 },
    stat:         { flex: 1, alignItems: 'center' },
    statDivider:  { borderLeftWidth: 1, borderLeftColor: C.border },
    statNum:      { fontFamily: Fonts.numeric, fontSize: 28, lineHeight: 26, color: C.t1, fontVariant: ['tabular-nums'] },
    statLabel:    { fontFamily: Fonts.medium, fontSize: 12, color: C.t2, marginTop: 4 },
  });
}
