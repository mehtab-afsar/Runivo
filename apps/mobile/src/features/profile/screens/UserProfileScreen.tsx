import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, SafeAreaView, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { UserPlus, Check, MapPin, ArrowLeft } from 'phosphor-react-native';
import { supabase } from '@shared/services/supabase';
import { Avatar } from '@mobile/shared/components/Avatar';
import { toggleFollowService } from '@features/social/services/feedService';
import { avatarColor } from '@shared/lib/avatarUtils';
import { RunnerRankBadge } from '@mobile/shared/components/RunnerRankBadge';
import { fetchAwards } from '../services/profileService';
import { AWARD_DEFINITIONS } from '@shared/constants/awards';
import type { RunnerRank } from '@shared/types/game';
import { useTheme, Fonts, type AppColors } from '@theme';

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'UserProfile'>;

interface UserData {
  username: string | null;
  display_name: string | null;
  bio: string | null;
  location: string | null;
  avatar_color: string | null;
  avatar_url: string | null;
  total_runs?: number;
  total_distance_km?: number;
  total_territories_claimed?: number;
  runner_rank?: RunnerRank;
  follower_count?: number;
  following_count?: number;
  restricted?: boolean;
}

export default function UserProfileScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { userId, username } = route.params;

  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [awards, setAwards] = useState<{ awardId: string; unlockedAt: string }[]>([]);

  useEffect(() => {
    async function load() {
      // Goes through get_user_profile_for_viewer rather than the profiles_public
      // view directly — that view has no row-level restriction at all, so the
      // Profile Visibility setting (Public/Friends/Private) did nothing before
      // this. The RPC withholds bio/stats/rank when the viewer isn't allowed to
      // see them and returns `restricted: true` instead.
      const { data } = await supabase.rpc('get_user_profile_for_viewer', { p_target_id: userId });
      const row = Array.isArray(data) ? data[0] : null;
      setUser(row ?? null);

      // Awards are a separate public-read table (user_awards RLS: USING (true))
      // and not covered by profile_visibility — skip fetching them at all for a
      // restricted profile so a private account doesn't leak activity through
      // the one field the visibility check doesn't touch.
      if (!row?.restricted) {
        fetchAwards(userId).then(setAwards);
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsOwnProfile(session.user.id === userId);
        // followers has no `id` column (composite PK on follower_id/following_id) —
        // selecting 'id' always errored, so this always resolved undefined and
        // isFollowing was permanently stuck false regardless of real state.
        const { data: follow } = await supabase
          .from('followers')
          .select('follower_id')
          .eq('follower_id', session.user.id)
          .eq('following_id', userId)
          .maybeSingle();
        setIsFollowing(!!follow);
      }
      setLoading(false);
    }
    load();
  }, [userId]);

  const handleFollow = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || session.user.id === userId) return;
    setFollowLoading(true);
    try {
      await toggleFollowService(userId);
      setIsFollowing(!isFollowing); // don't flip UI on a failed write
    } catch {
      // leave state as-is on failure
    }
    setFollowLoading(false);
  };

  // Deep links from push notifications (e.g. a new-follower push) only carry
  // userId, not username — fetched from profiles_public in that case instead.
  const resolvedUsername = username ?? user?.username ?? '';
  const displayName = user?.display_name || resolvedUsername;
  const color = user?.avatar_color || avatarColor(resolvedUsername);

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
          <ArrowLeft size={18} color={C.t2} weight="regular" />
        </Pressable>
        <Text style={s.title}>{resolvedUsername}</Text>
        <View style={{ width: 32 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={C.red} /></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={s.profileSection}>
            <Avatar name={displayName} color={color} size={64} uri={user?.avatar_url} />
            <Text style={s.displayName}>{displayName}</Text>
            {!user?.restricted && (
              <>
                {user?.bio ? <Text style={s.bio}>{user.bio}</Text> : null}
                {user?.location ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <MapPin size={11} color={C.t3} weight="light" />
                    <Text style={s.location}>{user.location}</Text>
                  </View>
                ) : null}
                {user?.runner_rank ? (
                  <View style={{ marginTop: 2 }}>
                    <RunnerRankBadge rank={user.runner_rank} size="sm" />
                  </View>
                ) : null}

                {/* Follower / following counts */}
                <View style={s.socialLine}>
                  <Pressable onPress={() => navigation.navigate('Following', { userId })} hitSlop={8}>
                    <Text style={s.socialText}>
                      <Text style={s.socialNum}>{user?.following_count ?? 0}</Text>
                      <Text style={s.socialLabel}> following</Text>
                    </Text>
                  </Pressable>
                  <Text style={s.socialDot}> · </Text>
                  <Pressable onPress={() => navigation.navigate('Followers', { userId })} hitSlop={8}>
                    <Text style={s.socialText}>
                      <Text style={s.socialNum}>{user?.follower_count ?? 0}</Text>
                      <Text style={s.socialLabel}> followers</Text>
                    </Text>
                  </Pressable>
                </View>
              </>
            )}

            {/* Follow action — Message removed until messaging actually ships;
                a permanently-disabled button was worse than no button. */}
            {!isOwnProfile && (
              <View style={s.actions}>
                <Pressable
                  style={[s.followBtn, isFollowing && s.followingBtn]}
                  onPress={handleFollow}
                  disabled={followLoading}
                >
                  {isFollowing ? (
                    <Check size={14} color={C.black} weight="regular" />
                  ) : (
                    <UserPlus size={14} color={C.alwaysLight} weight="regular" />
                  )}
                  <Text style={[s.followBtnLabel, isFollowing && s.followingBtnLabel]}>
                    {isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          {user?.restricted ? (
            <View style={s.privateNotice}>
              <Text style={s.privateNoticeTitle}>This profile is private</Text>
              <Text style={s.privateNoticeText}>
                {resolvedUsername} limits who can see their stats and activity.
              </Text>
            </View>
          ) : (
            <>
              {/* Stats grid */}
              <View style={s.statsGrid}>
                {[
                  { label: 'Runs', value: String(user?.total_runs ?? 0) },
                  { label: 'km', value: (user?.total_distance_km ?? 0).toFixed(0) },
                  { label: 'Zones', value: String(user?.total_territories_claimed ?? 0) },
                ].map(stat => (
                  <View key={stat.label} style={s.statCell}>
                    <Text style={s.statValue}>{stat.value}</Text>
                    <Text style={s.statLabel}>{stat.label}</Text>
                  </View>
                ))}
              </View>

              {/* Awards — public read (unlike runs/GPS, which stay owner-only) */}
              <View style={s.awardsSection}>
                <Text style={s.awardsHeading}>Awards</Text>
                {awards.length === 0 ? (
                  <Text style={s.awardsEmpty}>No awards earned yet.</Text>
                ) : (
                  <View style={s.awardsGrid}>
                    {awards.map(a => {
                      const def = AWARD_DEFINITIONS[a.awardId as keyof typeof AWARD_DEFINITIONS];
                      if (!def) return null;
                      return (
                        <View key={a.awardId} style={s.awardChip}>
                          <Text style={s.awardIcon}>{def.icon}</Text>
                          <Text style={s.awardTitle} numberOfLines={1}>{def.title}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:         { flex: 1, backgroundColor: C.bg },
    center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
    backBtn:      { width: 32 },
    title:        { fontFamily: Fonts.semiBold, fontSize: 20, color: C.black },
    profileSection:{ alignItems: 'center', padding: 24, gap: 6 },
    displayName:  { fontFamily: Fonts.semiBold, fontSize: 20, color: C.black, marginTop: 8 },
    bio:          { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, textAlign: 'center', lineHeight: 18, maxWidth: 280 },
    location:     { fontFamily: Fonts.regular, fontSize: 11, color: C.t3 },
    socialLine:   { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    socialText:   {},
    socialNum:    { fontFamily: Fonts.semiBold, fontSize: 13, color: C.black },
    socialLabel:  { fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
    socialDot:    { fontFamily: Fonts.regular, fontSize: 13, color: C.t3 },
    actions:      { flexDirection: 'row', gap: 10, marginTop: 16 },
    followBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.alwaysDark, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 10 },
    followingBtn: { backgroundColor: C.stone, borderWidth: 0.5, borderColor: C.border },
    followBtnLabel:   { fontFamily: Fonts.medium, fontSize: 13, color: C.alwaysLight },
    followingBtnLabel:{ color: C.black },
    statsGrid:    { flexDirection: 'row', marginHorizontal: 20, backgroundColor: C.card, borderRadius: 14, borderWidth: 0.5, borderColor: C.border, overflow: 'hidden' },
    statCell:     { flex: 1, alignItems: 'center', paddingVertical: 16, borderRightWidth: 0.5, borderRightColor: C.border },
    statValue:    { fontFamily: Fonts.semiBold, fontSize: 20, color: C.black, letterSpacing: -0.5 },
    statLabel:    { fontFamily: Fonts.regular, fontSize: 10, color: C.t3, marginTop: 2 },
    awardsSection:{ marginHorizontal: 20, marginTop: 20, marginBottom: 24 },
    awardsHeading:{ fontFamily: Fonts.semiBold, fontSize: 12, color: C.black, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 },
    awardsEmpty:  { fontFamily: Fonts.regular, fontSize: 12, color: C.t3 },
    awardsGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    awardChip:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.card, borderRadius: 20, borderWidth: 0.5, borderColor: C.border, paddingHorizontal: 10, paddingVertical: 7, maxWidth: 160 },
    awardIcon:    { fontSize: 16 },
    awardTitle:   { fontFamily: Fonts.medium, fontSize: 11, color: C.black, flexShrink: 1 },
    privateNotice:     { marginHorizontal: 20, alignItems: 'center', backgroundColor: C.card, borderRadius: 14, borderWidth: 0.5, borderColor: C.border, paddingVertical: 32, paddingHorizontal: 20 },
    privateNoticeTitle:{ fontFamily: Fonts.semiBold, fontSize: 14, color: C.black, marginBottom: 4 },
    privateNoticeText: { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, textAlign: 'center' },
  });
}
