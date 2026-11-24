import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Share, Image, ScrollView } from 'react-native';
import { Heart, MessageCircle, MoreHorizontal, Share2 } from '@mobile/shared/icons/lucideCompat';
import Svg, { Polyline, Polygon, Circle } from 'react-native-svg';
import { CityBackdrop } from '@mobile/shared/components/CityBackdrop';
import { Avatar } from '@mobile/shared/components/Avatar';
import { avatarColor } from '@shared/lib/avatarUtils';
import { fmtDistShort, fmtClock } from '@mobile/shared/lib/formatters';
import { buildRunCardSvg, RUN_CARD_W, RUN_CARD_H } from '@mobile/shared/lib/runCard';
import { shareSvgAsImage } from '@mobile/shared/components/CaptureHost';
import { TIER_CONFIG, formatArea } from '@shared/constants/territory';
import { fetchPostLikers, reportPost } from '@features/social/services/feedService';
import type { FeedPost, PostLiker } from '@features/social/types';
import { useTheme, useIsDark, Fonts, type AppColors } from '@theme';
import { territoryPalette } from '@theme/territory';
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
  return `${m}m ${Math.floor(sec % 60)}s`;
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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A run post as the shared run card (route, distance, pace, time). */
function runCardFor(post: FeedPost): string {
  const d = new Date(post.createdAt);
  const h = d.getHours();
  const part = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
  const sport = post.activityType === 'cycle' ? 'ride' : post.activityType === 'walk' ? 'walk' : post.activityType === 'hike' ? 'hike' : 'run';
  return buildRunCardSvg({
    name: post.username,
    sub: `${part} ${sport} · ${d.getDate()} ${MONTHS[d.getMonth()]}`,
    title: post.title || `${part} ${sport}`,
    stats: [
      { value: fmtDistShort(post.distanceM), label: 'km' },
      ...(post.avgPace ? [{ value: post.avgPace, label: 'pace /km' }] : []),
      { value: fmtClock(post.durationSec), label: 'time' },
    ],
    route: post.routePoints,
  });
}

const MAP_W = 375;
const MAP_H = 170;
const STEAL_MAP_H = 170;
const PAD   = 22;

type HeroKind = 'run' | 'claim' | 'steal';

/** Route thumbnail over a drawn city, as on the mock's feed cards. */
function RouteMapHero({ points, seed, kind }: { points: { lat: number; lng: number }[]; seed: string; kind: HeroKind }) {
  const H = kind === 'steal' ? STEAL_MAP_H : MAP_H;
  const C  = useTheme();
  const zone = territoryPalette(useIsDark());
  const rm = useMemo(() => mkRmStyles(C), [C]);

  const geo = useMemo(() => {
    const lats  = points.map(p => p.lat);
    const lngs  = points.map(p => p.lng);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    // Longitude degrees shrink with latitude; correct so loops aren't stretched.
    const kx = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
    const rangeW = (maxLng - minLng) * kx || 0.0001;
    const rangeH = maxLat - minLat || 0.0001;
    const scale  = Math.min((MAP_W - PAD * 2) / rangeW, (H - PAD * 2) / rangeH);
    const offX = (MAP_W - rangeW * scale) / 2, offY = (H - rangeH * scale) / 2;
    const pts = points.map(p => ({
      x: offX + (p.lng - minLng) * kx * scale,
      y: H - offY - (p.lat - minLat) * scale,
    }));
    const first = pts[0], last = pts[pts.length - 1];
    const diag = Math.hypot(rangeW * scale, rangeH * scale);
    const closed = Math.hypot(first.x - last.x, first.y - last.y) < Math.max(18, diag * 0.15);
    return { poly: pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '), start: first, closed };
  }, [points, H]);

  const stroke = kind === 'run' ? C.t1 : zone.trail;
  const fill   = kind === 'run' ? '#FFFFFF' : zone.trail;
  const fillOpacity = kind === 'run' ? 0.55 : 0.18;

  return (
    <View style={rm.wrap}>
      <Svg width="100%" height={H} viewBox={`0 0 ${MAP_W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <CityBackdrop width={MAP_W} height={H} seed={seed} />
        {geo.closed
          ? <Polygon points={geo.poly} fill={fill} fillOpacity={fillOpacity} stroke={stroke} strokeWidth={kind === 'steal' ? 2.5 : 3}
              strokeDasharray={kind === 'steal' ? '6 4' : undefined} strokeLinejoin="round" />
          : <Polyline points={geo.poly} fill="none" stroke={stroke} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />}
        <Circle cx={geo.start.x} cy={geo.start.y} r="5" fill="#FFFFFF" stroke={stroke} strokeWidth="2.5" />
      </Svg>
    </View>
  );
}

function mkRmStyles(C: AppColors) {
  return StyleSheet.create({
    wrap: { backgroundColor: C.bg, overflow: 'hidden' },
  });
}

/** Mock: small grey label above a 17 pt value, four to a row. */
function StatBlock({ value, label, color }: { value: string; label: string; color?: string }) {
  const C = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontFamily: Fonts.regular, fontSize: 12, color: C.t2 }}>{label}</Text>
      <Text style={{ fontFamily: Fonts.semiBold, fontSize: 17, color: color ?? C.t1, fontVariant: ['tabular-nums'] }} numberOfLines={1}>{value}</Text>
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
        .then(l => { if (alive) setLikers(l.filter((x, i) => l.findIndex(y => y.id === x.id) === i)); })
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
  /** Mute this post's author. */
  onMuteAuthor?: () => void;
  /** Block this post's author (asks first). */
  onBlockAuthor?: () => void;
  onDefend?: () => void;
}

// Memoised: the heaviest row in the app (renders a route polyline per post).
// FeedScreen already uses a useCallback renderItem — without memo here that win
// was cancelled, and every keystroke in the search box re-rendered every card.
export const FeedPostCard = React.memo(function FeedPostCard({
  post, currentUserId, onKudos, onComment, onUserPress, onDelete, onDefend, onMuteAuthor, onBlockAuthor,
}: Props) {
  const C = useTheme();
  const zone = territoryPalette(useIsDark());
  const s = useMemo(() => mkStyles(C), [C]);
  const [sheetOpen, setSheetOpen] = useState(false);

  const showRank = post.runnerRank && post.runnerRank !== 'pacer';
  const isOwnPost = currentUserId != null && post.userId === currentUserId;
  const activitySuffix = post.postType === 'run' && post.activityType !== 'run'
    ? ` · ${post.activityType === 'long_run' ? 'Long run' : post.activityType === 'cycle' ? 'Ride' : post.activityType === 'trail_run' ? 'Trail run' : post.activityType[0].toUpperCase() + post.activityType.slice(1)}`
    : '';

  // Runs share as a picture (the run card); battle posts, and any run the picture
  // can't be made for, share as a line of text.
  const handleShare = useCallback(() => {
    const text = () => Share.share({ message: buildShareMessage(post) }).catch(() => {});
    if (post.postType !== 'run' || post.distanceM <= 0) { text(); return; }
    shareSvgAsImage(runCardFor(post), { w: RUN_CARD_W, h: RUN_CARD_H, outW: 1080 }, `runivo_run_${post.id.slice(0, 8)}.png`, 'Share this run')
      .catch(text);
  }, [post]);

  // Errors propagate so the sheet only says "Reported" when the report actually went through.
  const handleReport = useCallback(() => reportPost(post.id, 'inappropriate'), [post.id]);

  const tier = post.territoryTier ? (TIER_CONFIG[post.territoryTier] ?? TIER_CONFIG.patch) : null;
  const zoneTier = post.zoneTier ? (TIER_CONFIG[post.zoneTier] ?? null) : tier;
  const rankLabel = post.runnerRank ? post.runnerRank[0].toUpperCase() + post.runnerRank.slice(1) : null;
  const othersLine = post.hasKudos
    ? (post.kudosCount > 1 ? `You and ${post.kudosCount - 1} other${post.kudosCount - 1 === 1 ? '' : 's'}` : 'You')
    : null;

  // ── Steal ("kofi.k stole a zone from you") and conquest cards ─────────────
  if (post.postType === 'attack' || post.postType === 'conquest') {
    const attack = post.postType === 'attack';
    // On an attack post the author is you; the rival is stolen_from.
    const who = attack ? (post.stolenFromUsername ?? 'A rival') : post.username;
    const line = attack
      ? 'stole a zone from you'
      : `took a zone from ${post.stolenFromUsername ?? 'a rival'}`;
    return (
      <View style={s.card}>
        <View style={s.header}>
          <Pressable style={s.headerTap} onPress={attack ? undefined : onUserPress}>
            {attack
              ? <Avatar name={who} color={avatarColor(who)} size={36} uri={null} />
              : <Avatar name={post.username} color={post.avatarColor} size={36} uri={post.avatarUrl} />}
            <View style={s.userInfo}>
              <Text style={s.headline} numberOfLines={2}><Text style={s.username}>{who}</Text> {line}</Text>
              <Text style={s.subtitle}>{timeAgo(post.createdAt)}{zoneTier ? ` · ${zoneTier.label}` : ''}</Text>
            </View>
          </Pressable>
          <Pressable style={s.kebab} onPress={() => setSheetOpen(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel="More options for this post">
            <MoreHorizontal size={18} color={C.t3} strokeWidth={2} />
          </Pressable>
        </View>
        {(post.routePoints?.length ?? 0) >= 5 && (
          <RouteMapHero points={post.routePoints!} seed={post.id} kind="steal" />
        )}
        <View style={s.stealFoot}>
          {post.stolenAreaM2 != null ? (
            <Text style={s.stealText}>
              <Text style={[s.stealArea, { color: attack ? zone.rival : zone.own }]}>
                {attack ? '' : '+'}{formatArea(post.stolenAreaM2)}
              </Text>
              {attack ? ' taken' : ' captured'}
            </Text>
          ) : <View />}
          {attack && onDefend && (
            <Pressable hitSlop={8} style={[s.takeBack, { backgroundColor: zone.own }]} onPress={onDefend} accessibilityRole="button">
              <Text style={s.takeBackText}>Take it back</Text>
            </Pressable>
          )}
        </View>
        <PostActionsSheet visible={sheetOpen} isOwnPost={isOwnPost} onClose={() => setSheetOpen(false)} onShare={handleShare} onDelete={onDelete} onReport={handleReport} onMute={onMuteAuthor} onBlock={onBlockAuthor} authorName={post.username} />
      </View>
    );
  }

  // ── Milestone ("ana_runs claimed a District", black tier chip) ────────────
  if (post.postType === 'milestone') {
    return (
      <View style={s.card}>
        <View style={[s.header, s.headerCompact]}>
          <Pressable style={s.headerTap} onPress={onUserPress}>
            <Avatar name={post.username} color={post.avatarColor} size={36} uri={post.avatarUrl} />
            <View style={s.userInfo}>
              <Text style={s.headline} numberOfLines={2}>
                <Text style={s.username}>{post.username}</Text> claimed {tier ? `a ${tier.label}` : 'a new zone'}
              </Text>
              <Text style={s.subtitle}>
                {timeAgo(post.createdAt)}{post.territoryAreaM2 != null ? ` · ${formatArea(post.territoryAreaM2)}, biggest yet` : ''}
              </Text>
            </View>
          </Pressable>
          {tier && <View style={s.darkChip}><Text style={s.darkChipText}>{tier.label}</Text></View>}
        </View>
        {(post.routePoints?.length ?? 0) >= 5 && (
          <RouteMapHero points={post.routePoints!} seed={post.id} kind="claim" />
        )}
        <PostActionsSheet visible={sheetOpen} isOwnPost={isOwnPost} onClose={() => setSheetOpen(false)} onShare={handleShare} onDelete={onDelete} onReport={handleReport} onMute={onMuteAuthor} onBlock={onBlockAuthor} authorName={post.username} />
      </View>
    );
  }

  // ── Run ───────────────────────────────────────────────────────────────────
  return (
    <View style={s.card}>
      <View style={s.header}>
        <Pressable style={s.headerTap} onPress={onUserPress}>
          <Avatar name={post.username} color={post.avatarColor} size={42} uri={post.avatarUrl} />
          <View style={s.userInfo}>
            <Text style={[s.username, { fontSize: 16, lineHeight: 21 }]}>{post.username}</Text>
            <Text style={[s.subtitle, { fontSize: 13 }]}>
              {timeAgo(post.createdAt)}{activitySuffix}
              {post.visibility === 'followers' ? ' · Followers' : post.visibility === 'only_me' ? ' · Only you' : ''}
            </Text>
            {!!post.companions?.length && (
              <Text style={s.subtitle} numberOfLines={1}>
                with {post.companions[0].username}{post.companions.length > 1 ? ` and ${post.companions.length - 1} other${post.companions.length > 2 ? 's' : ''}` : ''}
              </Text>
            )}
          </View>
        </Pressable>
        {showRank && rankLabel && <View style={s.lightChip}><Text style={s.lightChipText}>{rankLabel}</Text></View>}
        <Pressable style={s.kebab} onPress={() => setSheetOpen(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel="More options for this post">
          <MoreHorizontal size={18} color={C.t3} strokeWidth={2} />
        </Pressable>
      </View>

      {(!!post.title || !!post.description) && (
        <View style={s.textBlock}>
          {!!post.title && <Text style={s.postTitle} numberOfLines={2}>{post.title}</Text>}
          {!!post.description && <Text style={s.postBody} numberOfLines={4}>{post.description}</Text>}
        </View>
      )}

      {post.photos.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.photoRow}
          accessibilityLabel={`${post.photos.length} photo${post.photos.length > 1 ? 's' : ''}`}
        >
          {post.photos.map(uri => (
            <Image
              key={uri}
              source={{ uri }}
              style={[s.photo, post.photos.length === 1 && s.photoSolo]}
              accessibilityIgnoresInvertColors
            />
          ))}
        </ScrollView>
      )}

      <View style={s.statsRow}>
        <StatBlock value={`${fmtDistShort(post.distanceM)} km`} label="Distance" />
        {post.avgPace ? <StatBlock value={`${post.avgPace} /km`} label="Pace" /> : null}
        {post.durationSec > 0 ? <StatBlock value={fmtTime(post.durationSec)} label="Time" /> : null}
        {post.paceEarned > 0
          ? <StatBlock value={`+${post.paceEarned}`} label="PACE" color={C.amber} />
          : tier ? <StatBlock value="+1" label="Zones" color={zone.own} /> : null}
      </View>

      {(post.routePoints?.length ?? 0) >= 5 && (
        <View>
          <RouteMapHero
            points={post.routePoints!}
            seed={post.id}
            kind={post.territoryAreaM2 ? 'claim' : 'run'}
          />
          <View style={s.mapChip}><Text style={s.mapChipTxt}>Start and end hidden</Text></View>
        </View>
      )}

      <View style={s.actions}>
        <Pressable style={s.actionBtn} onPress={onKudos} testID="feed-like-btn" accessibilityLabel="Kudos">
          <Heart size={20} color={post.hasKudos ? C.red : C.t1} fill={post.hasKudos ? C.red : 'none'} strokeWidth={1.8} />
          {post.kudosCount > 0 && <Text style={[s.actionCount, post.hasKudos && { color: C.red, fontFamily: Fonts.semiBold }]}>{post.kudosCount}</Text>}
        </Pressable>
        <Pressable style={s.actionBtn} onPress={onComment} testID="feed-comment-btn" accessibilityLabel="Comments">
          <MessageCircle size={20} color={C.t1} strokeWidth={1.8} />
          {post.commentCount > 0 && <Text style={s.actionCount}>{post.commentCount}</Text>}
        </Pressable>
        <Pressable style={s.actionBtn} onPress={handleShare} accessibilityLabel="Share">
          <Share2 size={18} color={C.t1} strokeWidth={1.8} />
        </Pressable>
      </View>
      {othersLine
        ? <Text style={[s.othersText, { paddingHorizontal: 16, paddingBottom: 12 }]} numberOfLines={1}>{othersLine}</Text>
        : <KudosStack postId={post.id} kudosCount={post.kudosCount} />}

      <PostActionsSheet
        visible={sheetOpen}
        isOwnPost={isOwnPost}
        onClose={() => setSheetOpen(false)}
        onShare={handleShare}
        onDelete={onDelete}
        onReport={handleReport}
        onMute={onMuteAuthor}
        onBlock={onBlockAuthor}
        authorName={post.username}
      />
    </View>
  );
});

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card:         { backgroundColor: C.card, marginHorizontal: 18, marginBottom: 12, borderRadius: 28, overflow: 'hidden' },
    header:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
    headerCompact:{ paddingBottom: 14 },
    headerTap:    { flex: 1, flexDirection: 'row', alignItems: 'center' },
    kebab:        { padding: 4 },
    userInfo:     { flex: 1, marginLeft: 10 },
    headline:     { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 18, color: C.t1 },
    username:     { fontFamily: Fonts.semiBold, fontSize: 14, lineHeight: 18, color: C.t1 },
    photoRow:     { gap: 6, paddingHorizontal: 16, paddingBottom: 12 },
    photo:        { width: 220, height: 165, borderRadius: 12, backgroundColor: C.surface },
    photoSolo:    { width: 320, height: 220 },
    subtitle:     { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, marginTop: 2 },
    textBlock:    { paddingHorizontal: 16, paddingBottom: 12, gap: 4 },
    postTitle:    { fontFamily: Fonts.semiBold, fontSize: 20, lineHeight: 25, letterSpacing: -0.3, color: C.t1 },
    postBody:     { fontFamily: Fonts.regular, fontSize: 13.5, lineHeight: 19, color: C.t2 },
    lightChip:    { backgroundColor: C.stone, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
    lightChipText:{ fontFamily: Fonts.semiBold, fontSize: 11.5, color: C.t1 },
    darkChip:     { backgroundColor: C.alwaysDark, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
    darkChipText: { fontFamily: Fonts.semiBold, fontSize: 11.5, color: C.alwaysLight },
    statsRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingHorizontal: 16, paddingBottom: 12 },
    mapChip:      { position: 'absolute', top: 12, left: 12, height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: '#FFFFFF', justifyContent: 'center' },
    mapChipTxt:   { fontFamily: Fonts.semiBold, fontSize: 12, color: '#17181A' },
    stealFoot:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
    stealText:    { fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
    stealArea:    { fontFamily: Fonts.semiBold },
    takeBack:     { borderRadius: 999, paddingHorizontal: 12, height: 34, justifyContent: 'center' },
    takeBackText: { fontFamily: Fonts.semiBold, fontSize: 12.5, color: C.alwaysLight },
    actions:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 6 },
    actionBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, width: 64, height: 48 },
    actionCount:  { fontFamily: Fonts.regular, fontSize: 14, color: C.t1, fontVariant: ['tabular-nums'] },
    othersText:   { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, flexShrink: 1 },
  });
}
