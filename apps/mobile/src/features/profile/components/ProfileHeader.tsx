import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Gear, Pencil } from 'phosphor-react-native';
import { Avatar } from './Avatar';
import { useTheme, Fonts, type AppColors } from '@theme';
import { RANK_COLORS } from '@shared/constants/territory';

const RANK_EMOJIS: Record<string, string> = {
  pacer: '🚶',
  strider: '🏃',
  chaser: '👥',
  hunter: '🎯',
  sovereign: '⭐',
};

interface ProfileHeaderProps {
  displayName: string;
  username?: string;
  bio: string;
  avatarColor: string;
  avatarUri?: string | null;
  runnerRank: string;
  rankPct: number;
  // kept for compat but not rendered in header
  totalKm: number;
  totalRuns: number;
  totalTerritories: number;
  totalAreaM2: number;
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

export function ProfileHeader({
  displayName, username, bio, avatarColor, avatarUri,
  runnerRank, rankPct,
  followers, following,
  isOwnProfile = true,
  onEditPress, onSettingsPress, onFollowersPress, onFollowingPress,
}: ProfileHeaderProps) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const rankColor = RANK_COLORS[runnerRank] ?? RANK_COLORS.pacer;
  const rankEmoji = RANK_EMOJIS[runnerRank] ?? '🚶';
  const displayRank = runnerRank.charAt(0).toUpperCase() + runnerRank.slice(1);

  return (
    <View style={ss.header}>
      {/* Avatar + Info side-by-side */}
      <View style={ss.row}>
        <Pressable onPress={isOwnProfile ? onEditPress : undefined} style={ss.avatarWrap}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={ss.avatarImg} />
          ) : (
            <Avatar name={displayName} color={avatarColor} size={72} />
          )}
          {isOwnProfile && (
            <View style={ss.avatarEditBadge}>
              <Pencil size={10} color={C.alwaysLight} weight="bold" />
            </View>
          )}
        </Pressable>

        <View style={ss.infoBlock}>
          <Text style={ss.displayName} numberOfLines={1}>{displayName}</Text>

          <Text style={ss.rankLine}>
            {username ? `@${username}  ·  ` : ''}
            <Text style={ss.rankEmoji}>{rankEmoji} </Text>
            <Text style={[ss.rankName, { color: rankColor.fg }]}>{displayRank}</Text>
          </Text>

          {/* Followers / Following */}
          <View style={ss.socialLine}>
            <Pressable onPress={onFollowingPress} hitSlop={8}>
              <Text style={ss.socialText}>
                <Text style={ss.socialNum}>{following}</Text>
                <Text style={ss.socialLabel}> following</Text>
              </Text>
            </Pressable>
            <Text style={ss.socialDot}> · </Text>
            <Pressable onPress={onFollowersPress} hitSlop={8}>
              <Text style={ss.socialText}>
                <Text style={ss.socialNum}>{followers}</Text>
                <Text style={ss.socialLabel}> followers</Text>
              </Text>
            </Pressable>
          </View>

          {!!bio && (
            <Text style={ss.bio} numberOfLines={2} maxFontSizeMultiplier={1}>{bio}</Text>
          )}
        </View>

        {/* Settings icon top-right */}
        {isOwnProfile && (
          <Pressable style={ss.settingsBtn} onPress={onSettingsPress} hitSlop={8}>
            <Gear size={20} color={C.black} weight="light" />
          </Pressable>
        )}
      </View>

      {/* Rank progress bar — full width below the row */}
      <View style={ss.rankBarBg}>
        <View style={[ss.rankBarFill, { flex: Math.max(0.01, rankPct) }]} />
        <View style={{ flex: Math.max(0, 1 - rankPct) }} />
      </View>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    header:          { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
    row:             { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 14 },
    avatarWrap:      { position: 'relative' },
    avatarImg:       { width: 72, height: 72, borderRadius: 36 },
    avatarEditBadge: {
      position: 'absolute', bottom: 0, right: 0,
      width: 22, height: 22, borderRadius: 11,
      backgroundColor: C.alwaysDark,
      borderWidth: 2, borderColor: C.bg,
      alignItems: 'center', justifyContent: 'center',
    },
    infoBlock:    { flex: 1, gap: 4 },
    displayName:  { fontFamily: Fonts.semiBold, fontSize: 17, color: C.black, letterSpacing: -0.2 },
    rankLine:     { fontFamily: Fonts.regular, fontSize: 12, color: C.t2 },
    rankEmoji:    { fontSize: 12 },
    rankName:     { fontFamily: Fonts.medium, fontSize: 12 },
    socialLine:   { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    socialText:   {},
    socialNum:    { fontFamily: Fonts.semiBold, fontSize: 12, color: C.black },
    socialLabel:  { fontFamily: Fonts.regular, fontSize: 12, color: C.t2 },
    socialDot:    { fontFamily: Fonts.regular, fontSize: 12, color: C.t3 },
    bio:          { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, lineHeight: 17, marginTop: 3 },
    settingsBtn:  { padding: 2, alignSelf: 'flex-start' },
    rankBarBg:    { height: 3, backgroundColor: C.mid, borderRadius: 2, overflow: 'hidden', flexDirection: 'row' },
    rankBarFill:  { height: 3, backgroundColor: C.red },
  });
}
