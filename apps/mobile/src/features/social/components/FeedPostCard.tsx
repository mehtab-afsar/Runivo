import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Share } from 'react-native';
import {
  Heart, ChatCircle, Sparkle, DotsThree, ShareNetwork,
  Trophy, Sword, ShieldWarning,
} from 'phosphor-react-native';
import Svg, { Polyline, Circle, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { Avatar } from '@mobile/shared/components/Avatar';
import { fmtDistShort } from '@mobile/shared/lib/formatters';
import { TIER_CONFIG, formatArea } from '@shared/constants/territory';
import { fetchPostLikers, reportPost } from '@features/social/services/feedService';
import type { FeedPost, PostLiker } from '@features/social/types';
import { useTheme, Fonts, Type, type AppColors } from '@theme';
import PostActionsSheet from './PostActionsSheet';

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}m`;
}

function buildShareMessage(post: FeedPost): string {
  const tierLabel = post.territoryTier ? (TIER_CONFIG[post.territoryTier]?.label ?? post.territoryTier) : null;
  switch (post.postType) {
    case 'milestone':
      return `${post.username} just claimed their biggest zone yet on Runivo${tierLabel ? ` — ${tierLabel}` : ''}!`;
    case 'conquest':
      return `${post.username} captured ${post.stolenFromUsername ?? 'a rival'}'s territory on Runivo.`;
    case 'attack':
      return `${post.username}'s territory is under attack on Runivo — ${post.stolenFromUsername ?? 'a rival'} just struck.`;
    default:
      return `${post.username} ran ${fmtDistShort(post.distanceM)} km${post.avgPace ? ` at ${post.avgPace}/km` : ''} on Runivo.`;
  }
}

const MAP_W = 375;
const MAP_H = 140;
const PAD   = 16;

function RouteMapHero({ points }: { points: { lat: number; lng: number }[] }) {
  const C  = useTheme();
  const rm = useMemo(() => mkRmStyles(C), [C]);

  const lats  = points.map(p => p.lat);
  const lngs  = points.map(p => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const rangeW = maxLng - minLng || 0.0001;
  const rangeH = maxLat - minLat || 0.0001;
  const scale  = Math.min((MAP_W - PAD * 2) / rangeW, (MAP_H - PAD * 2) / rangeH);

  const pts = points.map(p => ({
    x: PAD + (p.lng - minLng) * scale,
    y: MAP_H - PAD - (p.lat - minLat) * scale,
  }));
  const poly  = pts.map(p => `${p.x},${p.y}`).join(' ');
  const start = pts[0];
  const end   = pts[pts.length - 1];

  return (
    <View style={rm.wrap}>
      <Svg width="100%" height={MAP_H} viewBox={`0 0 ${MAP_W} ${MAP_H}`} preserveAspectRatio="xMidYMid meet">
        <Defs>
          <LinearGradient id="routeStroke" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0"   stopColor={C.orange} />
            <Stop offset="1"   stopColor={C.red} />
          </LinearGradient>
          <LinearGradient id="fadeBottom" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.55" stopColor={C.surface} stopOpacity="0" />
            <Stop offset="1"    stopColor={C.surface} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Polyline points={poly} fill="none" stroke="url(#routeStroke)" strokeWidth="7" strokeOpacity="0.18" strokeLinecap="round" strokeLinejoin="round" />
        <Polyline points={poly} fill="none" stroke="url(#routeStroke)" strokeWidth="3"   strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={start.x} cy={start.y} r="5" fill={C.green} stroke="#fff" strokeWidth="1.5" />
        <Circle cx={end.x}   cy={end.y}   r="5" fill={C.red}   stroke="#fff" strokeWidth="1.5" />
        <Rect x="0" y="0" width={MAP_W} height={MAP_H} fill="url(#fadeBottom)" />
      </Svg>
    </View>
  );
}

function mkRmStyles(C: AppColors) {
  return StyleSheet.create({
    wrap: { backgroundColor: C.surface, overflow: 'hidden', borderTopWidth: 0.5, borderTopColor: C.border },
  });
}

function StatBlock({ value, label }: { value: string; label: string }) {
  const C = useTheme();
  return (
    <View style={{ gap: 1 }}>
      <Text style={{ fontFamily: Fonts.semiBold, fontSize: 18, letterSpacing: -0.3, color: C.black, fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text style={[Type.overline, { color: C.t3 }]}>{label}</Text>
    </View>
  );
}

function KudosStack({ postId, kudosCount }: { postId: string; kudosCount: number }) {
  const C = useTheme();
  const s = useMemo(() => mkStackStyles(C), [C]);
  const [likers, setLikers] = useState<PostLiker[] | null>(null);

  useEffect(() => {
    let alive = true;
    if (kudosCount > 0) {
      fetchPostLikers(postId, 3)
        .then(l => { if (alive) setLikers(l); })
        .catch(() => { if (alive) setLikers([]); });
    }
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, kudosCount > 0]);

  if (kudosCount === 0 || !likers || likers.length === 0) return null;
  const extra = kudosCount - likers.length;

  return (
    <View style={s.wrap}>
      <View style={s.stack}>
        {likers.map((l, i) => (
          <View key={l.id} style={[s.ring, i > 0 && { marginLeft: -8 }]}>
            <Avatar name={l.username} color={l.avatarColor} size={17} uri={l.avatarUrl} />
          </View>
        ))}
      </View>
      <Text style={s.label} numberOfLines={1}>
        {likers.map(l => l.username).join(', ')}{extra > 0 ? ` +${extra}` : ''}
      </Text>
    </View>
  );
}

function mkStackStyles(C: AppColors) {
  return StyleSheet.create({
    wrap:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingBottom: 10, flexShrink: 1 },
    stack: { flexDirection: 'row', alignItems: 'center' },
    ring:  { borderRadius: 10, borderWidth: 1.5, borderColor: C.card },
    label: { fontFamily: Fonts.regular, fontSize: 11, color: C.t3, flexShrink: 1 },
  });
}

interface Props {
  post: FeedPost;
  currentUserId: string | null;
  onKudos: () => void;
  onComment: () => void;
  onUserPress?: () => void;
  onDelete: () => void;
  onDefend?: () => void;
}

// Memoised: the heaviest row in the app (renders a route polyline per post).
// FeedScreen already uses a useCallback renderItem — without memo here that win
// was cancelled, and every keystroke in the search box re-rendered every card.
export const FeedPostCard = React.memo(function FeedPostCard({
  post, currentUserId, onKudos, onComment, onUserPress, onDelete, onDefend,
}: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const [sheetOpen, setSheetOpen] = useState(false);

  const showRank = post.runnerRank && post.runnerRank !== 'pacer';
  const isOwnPost = currentUserId != null && post.userId === currentUserId;
  const activitySuffix = post.postType === 'run' && post.activityType !== 'run'
    ? ` · ${post.activityType === 'long_run' ? 'Long run' : post.activityType[0].toUpperCase() + post.activityType.slice(1)}`
    : '';

  const handleShare = useCallback(() => {
    Share.share({ message: buildShareMessage(post) }).catch(() => {});
  }, [post]);

  const handleReport = useCallback(() => reportPost(post.id, 'inappropriate').catch(() => {}), [post.id]);

  const tier = post.territoryTier ? (TIER_CONFIG[post.territoryTier] ?? TIER_CONFIG.patch) : null;

  return (
    <View style={s.card}>

      {/* Header */}
      <View style={s.header}>
        <Pressable style={s.headerTap} onPress={onUserPress}>
          <Avatar name={post.username} color={post.avatarColor} size={40} uri={post.avatarUrl} />
          <View style={s.userInfo}>
            <Text style={s.username}>{post.username}</Text>
            <Text style={s.subtitle}>
              {showRank ? `${post.runnerRank} · ${timeAgo(post.createdAt)}` : timeAgo(post.createdAt)}{activitySuffix}
            </Text>
          </View>
        </Pressable>
        <Pressable style={s.kebab} onPress={() => setSheetOpen(true)} hitSlop={10}>
          <DotsThree size={18} color={C.t3} weight="bold" />
        </Pressable>
      </View>

      {/* Body — differs by post type */}
      {post.postType === 'milestone' ? (
        <View style={[s.celebrate, { backgroundColor: C.greenBg }]}>
          <Trophy size={22} color={C.green} weight="fill" />
          <Text style={[Type.displaySm, { color: C.black, marginTop: 6 }]}>
            New {tier?.label ?? 'zone'} claimed
          </Text>
          {post.territoryAreaM2 != null && (
            <Text style={[s.celebrateSub, { color: C.t2 }]}>Largest territory yet · {formatArea(post.territoryAreaM2)}</Text>
          )}
        </View>
      ) : post.postType === 'conquest' ? (
        <View style={[s.celebrate, { backgroundColor: C.accentMuted }]}>
          <Sword size={22} color={C.red} weight="fill" />
          <Text style={[Type.displaySm, { color: C.black, marginTop: 6 }]}>
            Captured {post.stolenFromUsername ?? 'a rival'}'s territory
          </Text>
          {post.stolenAreaM2 != null && (
            <Text style={[s.celebrateSub, { color: C.t2 }]}>
              {formatArea(post.stolenAreaM2)}{tier ? ` · ${tier.label}` : ''}
            </Text>
          )}
        </View>
      ) : post.postType === 'attack' ? (
        <View style={[s.celebrate, s.alert]}>
          <ShieldWarning size={22} color={C.red} weight="fill" />
          <Text style={[Type.displaySm, { color: C.black, marginTop: 6 }]}>
            {post.stolenFromUsername ?? 'A rival'} attacked your {tier?.label.toLowerCase() ?? 'territory'}
          </Text>
          {post.stolenAreaM2 != null && (
            <Text style={[s.celebrateSub, { color: C.t2 }]}>{formatArea(post.stolenAreaM2)} lost</Text>
          )}
          {onDefend && (
            <Pressable style={s.defendBtn} onPress={onDefend}>
              <Text style={s.defendBtnText}>Defend now →</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <>
          {(post.routePoints?.length ?? 0) >= 5 && <RouteMapHero points={post.routePoints!} />}
          <View style={s.statsRow}>
            <StatBlock value={fmtDistShort(post.distanceM)} label="km" />
            {post.avgPace ? <StatBlock value={`${post.avgPace}`} label="/km pace" /> : null}
            {post.durationSec > 0 ? <StatBlock value={fmtTime(post.durationSec)} label="duration" /> : null}
          </View>
        </>
      )}

      {/* Badges (run posts only — other types fold their tier into the celebration copy above) */}
      {post.postType === 'run' && (post.paceEarned > 0 || !!tier) && (
        <View style={s.badges}>
          {post.paceEarned > 0 && (
            <View style={s.badgePace}>
              <Sparkle size={9} color={C.green} weight="regular" />
              <Text style={s.badgePaceText}>+{post.paceEarned} PACE</Text>
            </View>
          )}
          {tier && (
            <View style={[s.badgeTier, { backgroundColor: tier.bg }]}>
              <Text style={[s.badgeTierText, { color: tier.fg }]}>{tier.label}</Text>
            </View>
          )}
        </View>
      )}

      <KudosStack postId={post.id} kudosCount={post.kudosCount} />

      {/* Actions */}
      <View style={s.actions}>
        <Pressable style={s.actionBtn} onPress={onKudos} testID="feed-like-btn">
          <Heart
            size={16}
            color={post.hasKudos ? C.red : C.t2}
            weight={post.hasKudos ? 'fill' : 'light'}
          />
          {post.kudosCount > 0 && <Text style={s.actionCount}>{post.kudosCount}</Text>}
        </Pressable>
        <Pressable style={s.actionBtn} onPress={onComment} testID="feed-comment-btn">
          <ChatCircle size={16} color={C.t2} weight="light" />
          {post.commentCount > 0 && <Text style={s.actionCount}>{post.commentCount}</Text>}
        </Pressable>
        <Pressable style={s.actionBtn} onPress={handleShare} testID="feed-share-btn">
          <ShareNetwork size={16} color={C.t2} weight="light" />
        </Pressable>
      </View>

      <PostActionsSheet
        visible={sheetOpen}
        isOwnPost={isOwnPost}
        onClose={() => setSheetOpen(false)}
        onShare={handleShare}
        onDelete={onDelete}
        onReport={handleReport}
      />
    </View>
  );
});

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card:         { backgroundColor: C.card, borderBottomWidth: 0.5, borderBottomColor: C.border },
    header:       { flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 14 },
    headerTap:    { flex: 1, flexDirection: 'row', alignItems: 'center' },
    kebab:        { padding: 4 },
    userInfo:     { flex: 1, marginLeft: 10 },
    username:     { fontFamily: Fonts.medium, fontSize: 13, color: C.black },
    subtitle:     { fontFamily: Fonts.regular, fontSize: 11, color: C.t3, marginTop: 2 },
    statsRow:     { flexDirection: 'row', alignItems: 'center', gap: 22, paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4 },
    celebrate:    { marginHorizontal: 16, marginBottom: 12, borderRadius: 14, padding: 16, alignItems: 'flex-start' },
    celebrateSub: { fontFamily: Fonts.regular, fontSize: 12, marginTop: 4 },
    alert:        { backgroundColor: C.redLo },
    defendBtn:    { marginTop: 10, backgroundColor: C.red, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
    defendBtnText:{ fontFamily: Fonts.semiBold, fontSize: 12, color: C.white },
    badges:       { flexDirection: 'row', gap: 5, paddingHorizontal: 16, paddingBottom: 10, flexWrap: 'wrap' },
    badgePace:    { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.greenBg, borderRadius: 2, paddingHorizontal: 7, paddingVertical: 3 },
    badgePaceText:{ fontFamily: Fonts.medium, fontSize: 10, color: C.green, letterSpacing: 0.4 },
    badgeTier:    { borderRadius: 2, paddingHorizontal: 7, paddingVertical: 3 },
    badgeTierText:{ fontFamily: Fonts.medium, fontSize: 10, letterSpacing: 0.4 },
    actions:      { flexDirection: 'row', alignItems: 'center', gap: 18, paddingHorizontal: 16, paddingBottom: 14, paddingTop: 2 },
    actionBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
    actionCount:  { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, fontVariant: ['tabular-nums'] },
  });
}
