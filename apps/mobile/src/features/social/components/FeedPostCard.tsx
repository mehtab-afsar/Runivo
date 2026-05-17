import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Heart, MessageCircle, Sparkles } from 'lucide-react-native';
import Svg, { Polyline, Circle, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { avatarColor } from '@shared/lib/avatarUtils';
import { fmtDistShort } from '@mobile/shared/lib/formatters';
import { TIER_CONFIG } from '@shared/constants/territory';
import type { FeedPost } from '@features/social/types';
import { useTheme, type AppColors } from '@theme';

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

const MAP_W = 375;
const MAP_H = 110;
const PAD   = 16;

function RouteMapHero({ points }: { points: { lat: number; lng: number }[] }) {
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
          <LinearGradient id="fadeBottom" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.6" stopColor="#F0EDE8" stopOpacity="0" />
            <Stop offset="1"   stopColor="#F0EDE8" stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Polyline points={poly} fill="none" stroke="#D93518" strokeWidth="6"   strokeOpacity="0.2" strokeLinecap="round" strokeLinejoin="round" />
        <Polyline points={poly} fill="none" stroke="#D93518" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={start.x} cy={start.y} r="5" fill="#1A6B40" stroke="#fff" strokeWidth="1.5" />
        <Circle cx={end.x}   cy={end.y}   r="5" fill="#D93518" stroke="#fff" strokeWidth="1.5" />
        <Rect x="0" y="0" width={MAP_W} height={MAP_H} fill="url(#fadeBottom)" />
      </Svg>
    </View>
  );
}

const rm = StyleSheet.create({
  wrap: { backgroundColor: '#F0EDE8', overflow: 'hidden', borderTopWidth: 0.5, borderTopColor: '#E8E4DF' },
});

interface Props {
  post: FeedPost;
  onKudos: () => void;
  onComment: () => void;
  onUserPress?: () => void;
}

export function FeedPostCard({ post, onKudos, onComment, onUserPress }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);

  const color   = avatarColor(post.username);
  const initial = post.username.slice(0, 1).toUpperCase();
  const showRank = post.runnerRank && post.runnerRank !== 'pacer';

  return (
    <View style={s.card}>

      {/* Header */}
      <Pressable style={s.header} onPress={onUserPress}>
        <View style={[s.avatar, { backgroundColor: color }]}>
          <Text style={s.avatarText}>{initial}</Text>
        </View>
        <View style={s.userInfo}>
          <Text style={s.username}>{post.username}</Text>
          <Text style={s.subtitle}>
            {showRank ? `${post.runnerRank} · ${timeAgo(post.createdAt)}` : timeAgo(post.createdAt)}
          </Text>
        </View>
      </Pressable>

      {/* Route map (only if 5+ points) */}
      {(post.routePoints?.length ?? 0) >= 5 && (
        <RouteMapHero points={post.routePoints!} />
      )}

      {/* Stats inline row */}
      <View style={s.statsRow}>
        <Text style={s.statVal}>{fmtDistShort(post.distanceM)}</Text>
        {post.avgPace ? (
          <><Text style={s.statSep}> · </Text><Text style={s.statVal}>{post.avgPace}/km</Text></>
        ) : null}
        {post.durationSec > 0 ? (
          <><Text style={s.statSep}> · </Text><Text style={s.statVal}>{fmtTime(post.durationSec)}</Text></>
        ) : null}
      </View>

      {/* Badges (only if present) */}
      {(post.paceEarned > 0 || !!post.territoryTier) && (
        <View style={s.badges}>
          {post.paceEarned > 0 && (
            <View style={s.badgePace}>
              <Sparkles size={9} color="#1A6B40" strokeWidth={2} />
              <Text style={s.badgePaceText}>+{post.paceEarned} PACE</Text>
            </View>
          )}
          {post.territoryTier && (() => {
            const tc = TIER_CONFIG[post.territoryTier] ?? TIER_CONFIG.patch;
            return (
              <View style={[s.badgeTier, { backgroundColor: tc.bg }]}>
                <Text style={[s.badgeTierText, { color: tc.fg }]}>{tc.label}</Text>
              </View>
            );
          })()}
        </View>
      )}

      {/* Actions */}
      <View style={s.actions}>
        <Pressable style={s.actionBtn} onPress={onKudos}>
          <Heart
            size={15}
            color={post.hasKudos ? C.red : C.t2}
            fill={post.hasKudos ? C.red : 'none'}
            strokeWidth={1.5}
          />
          {post.kudosCount > 0 && (
            <Text style={s.actionCount}>{post.kudosCount}</Text>
          )}
        </Pressable>
        <Pressable style={s.actionBtn} onPress={onComment}>
          <MessageCircle size={15} color={C.t2} strokeWidth={1.5} />
          {post.commentCount > 0 && (
            <Text style={s.actionCount}>{post.commentCount}</Text>
          )}
        </Pressable>
      </View>

    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card:         { backgroundColor: C.white, borderBottomWidth: 0.5, borderBottomColor: C.border },
    header:       { flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 14 },
    avatar:       { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    avatarText:   { fontFamily: 'Barlow_600SemiBold', fontSize: 14, color: '#fff' },
    userInfo:     { flex: 1, marginLeft: 10 },
    username:     { fontFamily: 'Barlow_500Medium', fontSize: 13, color: C.black },
    subtitle:     { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t3, marginTop: 2 },
    statsRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, paddingTop: 2 },
    statVal:      { fontFamily: 'Barlow_300Light', fontSize: 15, color: C.black, letterSpacing: -0.3 },
    statSep:      { fontFamily: 'Barlow_300Light', fontSize: 13, color: C.t3 },
    badges:       { flexDirection: 'row', gap: 5, paddingHorizontal: 16, paddingBottom: 10, flexWrap: 'wrap' },
    badgePace:    { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#EDF7F2', borderRadius: 2, paddingHorizontal: 7, paddingVertical: 3 },
    badgePaceText:{ fontFamily: 'Barlow_500Medium', fontSize: 10, color: '#1A6B40', letterSpacing: 0.4 },
    badgeTier:    { borderRadius: 2, paddingHorizontal: 7, paddingVertical: 3 },
    badgeTierText:{ fontFamily: 'Barlow_500Medium', fontSize: 10, letterSpacing: 0.4 },
    actions:      { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingBottom: 14, paddingTop: 4 },
    actionBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
    actionCount:  { fontFamily: 'Barlow_400Regular', fontSize: 12, color: C.t2 },
  });
}
