import { ErrorState } from '@mobile/shared/components/ErrorState';
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { UserPlus, Check, MapPin, ArrowLeft, DotsThree, Prohibit } from 'phosphor-react-native';
import RunnerSafetySheet from '@features/social/components/RunnerSafetySheet';
import { fetchRelation, unblockUser } from '@mobile/shared/services/safetyService';
import { supabase } from '@shared/services/supabase';
import { Avatar } from '@mobile/shared/components/Avatar';
import { toggleFollowService } from '@features/social/services/feedService';
import { avatarColor } from '@shared/lib/avatarUtils';
import { RunnerRankBadge } from '@mobile/shared/components/RunnerRankBadge';
import { fetchAwards } from '../services/profileService';
import { fetchRunnerActivities } from '../services/runnerActivitiesService';
import { ThisWeekCard, StatsCard, RecentActivities } from '../components/ProfileActivity';
import { SportChip } from '../components/SportPicker';
import type { SportFilter } from '../utils/profileStats';
import type { StoredRun } from '@shared/services/store';
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

  const [activities, setActivities] = useState<StoredRun[] | null>(null);
  // The run they pinned to the top of their profile (P4), when you can see it.
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  useEffect(() => {
    supabase.from('profiles_public').select('pinned_run_id').eq('id', userId).maybeSingle()
      .then(({ data }) => setPinnedId((data as { pinned_run_id: string | null } | null)?.pinned_run_id ?? null), () => {});
  }, [userId]);
  const [sport, setSport] = useState<SportFilter>('all');
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [awards, setAwards] = useState<{ awardId: string; unlockedAt: string }[]>([]);
  // Block / mute state and the "…" menu.
  const [relation, setRelation] = useState({ blocked: false, muted: false });
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { fetchRelation(userId).then(setRelation).catch(() => {}); }, [userId]);
  useEffect(() => { fetchRunnerActivities(userId).then(setActivities).catch(() => setActivities([])); }, [userId]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(false);
      try {
      // Goes through get_user_profile_for_viewer rather than the profiles_public
      // view directly — that view has no row-level restriction at all, so the
      // Profile Visibility setting (Public/Friends/Private) did nothing before
      // this. The RPC withholds bio/stats/rank when the viewer isn't allowed to
      // see them and returns `restricted: true` instead.
      const { data, error } = await supabase.rpc('get_user_profile_for_viewer', { p_target_id: userId });
      if (error) throw error;
      if (cancelled) return;
      const row = Array.isArray(data) ? data[0] : null;
      setUser(row ?? null);

      // Awards are a separate public-read table (user_awards RLS: USING (true))
      // and not covered by profile_visibility — skip fetching them at all for a
      // restricted profile so a private account doesn't leak activity through
      // the one field the visibility check doesn't touch.
      if (!row?.restricted) {
        fetchAwards(userId).then(a => { if (!cancelled) setAwards(a); }).catch(() => {});
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
      } catch {
        // A failed RPC used to render an empty profile reading "0 runs".
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId, reloadKey]);

  const handleFollow = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || session.user.id === userId || followLoading) return;
    setFollowLoading(true);
    try {
      await toggleFollowService(userId);
      const next = !isFollowing;
      setIsFollowing(next); // don't flip UI on a failed write
      // Keep the visible follower count in step with the button.
      setUser(u => (u ? { ...u, follower_count: Math.max(0, (u.follower_count ?? 0) + (next ? 1 : -1)) } : u));
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
        <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }} onPress={() => navigation.goBack()} style={s.backBtn}>
          <ArrowLeft size={16} color={C.t1} weight="regular" />
        </Pressable>
        <Text style={s.title}>{resolvedUsername}</Text>
        {isOwnProfile ? <View style={{ width: 32 }} /> : (
          <Pressable onPress={() => setMenuOpen(true)} style={s.backBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel="More options">
            <DotsThree size={20} color={C.t1} weight="bold" />
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={C.red} /></View>
      ) : loadError ? (
        <ErrorState title="Couldn't load this profile" onRetry={() => setReloadKey(k => k + 1)} />
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
            {!isOwnProfile && relation.blocked && (
              <View style={s.blockedBox}>
                <Prohibit size={16} color={C.t2} weight="regular" />
                <Text style={s.blockedTxt}>You blocked {resolvedUsername}. Neither of you sees the other.</Text>
                <Pressable
                  onPress={() => unblockUser(userId).then(() => setRelation(r => ({ ...r, blocked: false }))).catch(() => {})}
                  hitSlop={8}
                  accessibilityRole="button"
                >
                  <Text style={s.blockedAction}>Unblock</Text>
                </Pressable>
              </View>
            )}
            {!isOwnProfile && !relation.blocked && (
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

              {/* The same sections as your own profile, built from what they let you see. */}
              {activities && activities.length > 0 && (
                <View style={s.sections}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={s.awardsHeading}>Activity</Text>
                    <SportChip value={sport} onChange={setSport} />
                  </View>
                  <ThisWeekCard runs={activities} sport={sport} />
                  <StatsCard runs={activities} sport={sport} />
                  <RecentActivities runs={activities} sport={sport} pinnedId={pinnedId} emptyText="Nothing to show for this sport." />
                </View>
              )}

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
      {!isOwnProfile && (
        <RunnerSafetySheet
          visible={menuOpen}
          userId={userId}
          username={resolvedUsername}
          blocked={relation.blocked}
          muted={relation.muted}
          onClose={() => setMenuOpen(false)}
          onChange={next => { setRelation(next); if (next.blocked) setIsFollowing(false); }}
        />
      )}
    </SafeAreaView>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:         { flex: 1, backgroundColor: C.bg },
    center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 12 },
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
    blockedBox:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: C.surface, alignSelf: 'stretch' },
    blockedTxt:  { flex: 1, fontFamily: Fonts.regular, fontSize: 12.5, color: C.t2 },
    blockedAction: { fontFamily: Fonts.semiBold, fontSize: 13, color: C.t1 },
    followBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.alwaysDark, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 10 },
    followingBtn: { backgroundColor: C.stone, borderWidth: 0.5, borderColor: C.border },
    followBtnLabel:   { fontFamily: Fonts.medium, fontSize: 13, color: C.alwaysLight },
    followingBtnLabel:{ color: C.black },
    statsGrid:    { flexDirection: 'row', marginHorizontal: 18, backgroundColor: C.card, borderRadius: 22, borderWidth: 0.5, borderColor: C.border, overflow: 'hidden' },
    statCell:     { flex: 1, alignItems: 'center', paddingVertical: 16, borderRightWidth: 0.5, borderRightColor: C.border },
    statValue:    { fontFamily: Fonts.semiBold, fontSize: 20, color: C.black, letterSpacing: -0.5 },
    statLabel:    { fontFamily: Fonts.regular, fontSize: 11, color: C.t3, marginTop: 2 },
    sections:     { marginHorizontal: 18, marginTop: 16, gap: 12 },
    awardsSection:{ marginHorizontal: 18, marginTop: 20, marginBottom: 24 },
    awardsHeading:{ fontFamily: Fonts.semiBold, fontSize: 12, color: C.black,  marginBottom: 10 },
    awardsEmpty:  { fontFamily: Fonts.regular, fontSize: 12, color: C.t3 },
    awardsGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    awardChip:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.card, borderRadius: 20, borderWidth: 0.5, borderColor: C.border, paddingHorizontal: 10, paddingVertical: 7, maxWidth: 160 },
    awardIcon:    { fontSize: 16 },
    awardTitle:   { fontFamily: Fonts.medium, fontSize: 11, color: C.black, flexShrink: 1 },
    privateNotice:     { marginHorizontal: 18, alignItems: 'center', backgroundColor: C.card, borderRadius: 22, borderWidth: 0.5, borderColor: C.border, paddingVertical: 32, paddingHorizontal: 20 },
    privateNoticeTitle:{ fontFamily: Fonts.semiBold, fontSize: 14, color: C.black, marginBottom: 4 },
    privateNoticeText: { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, textAlign: 'center' },
  });
}
