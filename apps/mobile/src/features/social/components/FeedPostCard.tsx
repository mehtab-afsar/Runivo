import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { TrendingUp, MapPin, Zap, Navigation, MessageSquare, ThumbsUp, Star } from 'lucide-react-native';
import Svg, { Polyline, Circle, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { avatarColor } from '@shared/lib/avatarUtils';
import { fmtDistShort } from '@mobile/shared/lib/formatters';
import type { FeedPost, ActivityType } from '@features/social/types';

const C = {
  white: '#FFFFFF', stone: '#F0EDE8', mid: '#E8E4DF', border: '#DDD9D4',
  black: '#0A0A0A', t2: '#6B6B6B', t3: '#ADADAD', red: '#D93518',
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}m`;
}

const ACT_CONFIG: Record<ActivityType, { label: string; Icon: typeof TrendingUp }> = {
  run:      { label: 'Run',      Icon: TrendingUp },
  trail:    { label: 'Trail',    Icon: MapPin },
  interval: { label: 'Interval', Icon: Zap },
  long_run: { label: 'Long Run', Icon: Navigation },
};

const MAP_W = 375;
const MAP_H = 110;
const PAD = 16;

function RouteMapHero({ points }: { points: { lat: number; lng: number }[] }) {
  if (points.length < 2) return null;

  const lats = points.map(p => p.lat);
  const lngs = points.map(p => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const rangeW = maxLng - minLng || 0.0001;
  const rangeH = maxLat - minLat || 0.0001;
  const scale = Math.min((MAP_W - PAD * 2) / rangeW, (MAP_H - PAD * 2) / rangeH);

  const pts = points.map(p => ({
    x: PAD + (p.lng - minLng) * scale,
    y: MAP_H - PAD - (p.lat - minLat) * scale,
  }));

  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ');
  const start = pts[0];
  const end = pts[pts.length - 1];

  return (
    <View style={rm.wrap}>
      <Svg width="100%" height={MAP_H} viewBox={`0 0 ${MAP_W} ${MAP_H}`} preserveAspectRatio="xMidYMid meet">
        <Defs>
          <LinearGradient id="fadeBottom" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.6" stopColor="#F0EDE8" stopOpacity="0" />
            <Stop offset="1" stopColor="#F0EDE8" stopOpacity="1" />
          </LinearGradient>
        </Defs>
        {/* Route glow */}
        <Polyline points={polyline} fill="none" stroke="#D93518" strokeWidth="6" strokeOpacity="0.2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Route line */}
        <Polyline points={polyline} fill="none" stroke="#D93518" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Start dot */}
        <Circle cx={start.x} cy={start.y} r="5" fill="#1A6B40" stroke="#fff" strokeWidth="1.5" />
        {/* End dot */}
        <Circle cx={end.x} cy={end.y} r="5" fill="#D93518" stroke="#fff" strokeWidth="1.5" />
        {/* Bottom fade overlay */}
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
  onPress: () => void;
  onUserPress?: () => void;
}

export function FeedPostCard({ post, onKudos, onPress, onUserPress }: Props) {
  const color = avatarColor(post.username);
  const initial = post.username.slice(0, 1).toUpperCase();
  const [fireActive, setFireActive] = useState(false);
  const [crownActive, setCrownActive] = useState(false);

  const actType = post.activityType ?? 'run';
  const ActIcon = ACT_CONFIG[actType]?.Icon ?? TrendingUp;
  const actLabel = ACT_CONFIG[actType]?.label ?? 'Run';

  // Badges
  const badges: { bg: string; fg: string; text: string }[] = [];
  if (post.territoriesClaimed > 0) badges.push({ bg: '#FEF0EE', fg: C.red, text: `⚡ ${post.territoriesClaimed} Zone${post.territoriesClaimed !== 1 ? 's' : ''}` });
  if (post.xpEarned > 0) badges.push({ bg: '#EDF7F2', fg: '#1A6B40', text: `✨ ${post.xpEarned} XP` });
  if (post.isPR) badges.push({ bg: '#FDF6E8', fg: '#9E6800', text: '⭐ PR' });
  if ((post.streakDays ?? 0) > 0) badges.push({ bg: '#FEF0E6', fg: '#C25A00', text: `🔥 ${post.streakDays} day streak` });

  return (
    <Pressable style={s.card} onPress={onPress}>

      {/* A — Header */}
      <View style={s.header}>
        <Pressable onPress={onUserPress} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <View style={[s.avatar, { backgroundColor: color }]}>
            <Text style={s.avatarText}>{initial}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={s.username}>{post.username}</Text>
            <Text style={s.time}>{timeAgo(post.createdAt)}</Text>
          </View>
        </Pressable>
        {/* Activity chip */}
        <View style={s.actChip}>
          <ActIcon size={10} color={C.t2} strokeWidth={2} />
          <Text style={s.actChipText}>{actLabel.toUpperCase()}</Text>
        </View>
      </View>

      {/* B — Stats row */}
      <View style={s.statsRow}>
        <View style={s.statItem}>
          <Text style={s.statVal}>{fmtDistShort(post.distanceM)}</Text>
          <Text style={s.statLbl}>DISTANCE</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <Text style={s.statVal}>{post.durationSec > 0 ? fmtTime(post.durationSec) : '–'}</Text>
          <Text style={s.statLbl}>TIME</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <Text style={s.statVal}>{post.avgPace || '–'}</Text>
          <Text style={s.statLbl}>PACE</Text>
        </View>
      </View>

      {/* B.5 — Route map hero */}
      {(post.routePoints?.length ?? 0) >= 2 && (
        <RouteMapHero points={post.routePoints!} />
      )}

      {/* C — Badges strip */}
      {badges.length > 0 && (
        <View style={s.badgesRow}>
          {badges.map((b, i) => (
            <View key={i} style={[s.badge, { backgroundColor: b.bg }]}>
              <Text style={[s.badgeText, { color: b.fg }]}>{b.text}</Text>
            </View>
          ))}
        </View>
      )}

      {/* D — Reactions bar */}
      <View style={s.reactBar}>
        {/* Left: kudos count + comment count */}
        <View style={s.reactLeft}>
          {post.kudosCount > 0 && (
            <Text style={s.reactCount}>{post.kudosCount + (post.hasKudos ? 0 : 0)}</Text>
          )}
          {(post.commentCount ?? 0) > 0 && (
            <View style={s.commentRow}>
              <MessageSquare size={12} color={C.t3} strokeWidth={1.5} />
              <Text style={s.commentCount}>{post.commentCount}</Text>
            </View>
          )}
        </View>

        {/* Right: 3 reaction chips */}
        <View style={s.reactChips}>
          <Pressable
            style={[s.chip, post.hasKudos && s.chipActive]}
            onPress={onKudos}
          >
            <ThumbsUp size={12} color={post.hasKudos ? C.white : C.t2} strokeWidth={2} />
          </Pressable>
          <Pressable
            style={[s.chip, fireActive && s.chipActive]}
            onPress={() => setFireActive(v => !v)}
          >
            <Star size={12} color={fireActive ? C.white : C.t2} strokeWidth={2} />
          </Pressable>
          <Pressable
            style={[s.chip, crownActive && s.chipActive]}
            onPress={() => setCrownActive(v => !v)}
          >
            <Zap size={12} color={crownActive ? C.white : C.t2} strokeWidth={2} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card:        { backgroundColor: C.white, borderBottomWidth: 0.5, borderBottomColor: C.border },
  // Header
  header:      { flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 14 },
  avatar:      { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText:  { fontFamily: 'Barlow_600SemiBold', fontSize: 14, color: C.white },
  username:    { fontFamily: 'Barlow_500Medium', fontSize: 13, color: C.black },
  time:        { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t3, marginTop: 2 },
  actChip:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 3, backgroundColor: C.stone },
  actChipText: { fontFamily: 'Barlow_500Medium', fontSize: 10, color: C.t2, letterSpacing: 0.4 },
  // Stats
  statsRow:    { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: C.mid, paddingVertical: 12, paddingHorizontal: 20, borderBottomWidth: 0.5, borderBottomColor: C.mid },
  statItem:    { flex: 1 },
  statVal:     { fontFamily: 'Barlow_300Light', fontSize: 15, color: C.black, letterSpacing: -0.3 },
  statLbl:     { fontFamily: 'Barlow_400Regular', fontSize: 9, color: C.t3, letterSpacing: 0.8, marginTop: 2 },
  statDivider: { width: 0.5, height: 32, backgroundColor: C.mid, alignSelf: 'center', marginHorizontal: 4 },
  // Badges
  badgesRow:   { flexDirection: 'row', gap: 5, paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: C.mid, flexWrap: 'wrap' },
  badge:       { borderRadius: 2, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:   { fontFamily: 'Barlow_500Medium', fontSize: 10, letterSpacing: 0.4 },
  // Reactions
  reactBar:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 11, paddingBottom: 14 },
  reactLeft:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reactCount:  { fontFamily: 'Barlow_400Regular', fontSize: 12, color: C.t2 },
  commentRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  commentCount:{ fontFamily: 'Barlow_400Regular', fontSize: 12, color: C.t3 },
  reactChips:  { flexDirection: 'row', gap: 6 },
  chip:        { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 2, borderWidth: 0.5, borderColor: C.border, backgroundColor: C.stone },
  chipActive:  { backgroundColor: C.black, borderColor: C.black },
});
