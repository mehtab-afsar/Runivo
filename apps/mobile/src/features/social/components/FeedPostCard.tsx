import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { avatarColor } from '@shared/lib/avatarUtils';
import { fmtDistShort } from '@mobile/shared/lib/formatters';
import type { FeedPost } from '@features/social/types';

const C = {
  white: '#FFFFFF', stone: '#F0EDE8', border: '#DDD9D4',
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

interface Props {
  post: FeedPost;
  onKudos: () => void;
  onPress: () => void;
}

export function FeedPostCard({ post, onKudos, onPress }: Props) {
  const color = avatarColor(post.username);
  const initial = post.username.slice(0, 1).toUpperCase();

  return (
    <Pressable style={s.card} onPress={onPress}>
      <View style={s.header}>
        <View style={[s.avatar, { backgroundColor: color }]}>
          <Text style={s.avatarText}>{initial}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={s.username}>{post.username}</Text>
          <Text style={s.time}>{timeAgo(post.createdAt)}</Text>
        </View>
      </View>

      <View style={s.chipsRow}>
        <View style={s.chip}>
          <Text style={s.chipText}>📍 {fmtDistShort(post.distanceM)}</Text>
        </View>
        {post.territoriesClaimed > 0 && (
          <View style={[s.chip, s.chipRed]}>
            <Text style={[s.chipText, { color: C.red }]}>⚡ {post.territoriesClaimed} zones</Text>
          </View>
        )}
        {post.xpEarned > 0 && (
          <View style={s.chip}>
            <Text style={s.chipText}>✨ {post.xpEarned} XP</Text>
          </View>
        )}
      </View>

      <View style={s.actions}>
        <Pressable style={s.actionBtn} onPress={onKudos}>
          <Text style={[s.actionText, post.hasKudos && { color: C.red }]}>
            {post.hasKudos ? '❤️' : '🤍'} {post.kudosCount}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: C.white, borderRadius: 14, borderWidth: 0.5, borderColor: C.border, padding: 14 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'Barlow_600SemiBold', fontSize: 14, color: '#fff' },
  username: { fontFamily: 'Barlow_500Medium', fontSize: 13, color: C.black },
  time: { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t3, marginTop: 1 },
  chipsRow: { flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  chip: { backgroundColor: C.stone, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  chipRed: { backgroundColor: '#FEF0EE' },
  chipText: { fontFamily: 'Barlow_400Regular', fontSize: 11, color: C.t2 },
  actions: { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: C.border, paddingTop: 10, marginTop: 2 },
  actionBtn: { flexDirection: 'row', alignItems: 'center' },
  actionText: { fontFamily: 'Barlow_400Regular', fontSize: 12, color: C.t2 },
});
