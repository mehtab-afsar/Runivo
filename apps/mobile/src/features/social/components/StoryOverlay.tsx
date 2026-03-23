import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { avatarColor } from '@shared/lib/avatarUtils';
import type { StoryGroup } from '@features/social/services/storyService';

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface Props {
  group: StoryGroup;
  storyIndex: number;
  topOffset: number;
}

export function StoryOverlay({ group, storyIndex, topOffset }: Props) {
  const bg = avatarColor(group.userName);
  const initials = group.userName.slice(0, 2).toUpperCase();
  const story = group.stories[storyIndex] as any;

  return (
    <>
      <View style={[s.header, { top: topOffset + 24 }]}>
        <View style={[s.avatar, { backgroundColor: bg }]}>
          <Text style={s.avatarText}>{initials}</Text>
        </View>
        <Text style={s.userName}>{group.userName}</Text>
        {story?.createdAt && <Text style={s.time}>{timeAgo(story.createdAt)}</Text>}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  header: {
    position: 'absolute', left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 10,
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  avatarText: { fontFamily: 'Barlow_700Bold', fontSize: 13, color: '#fff' },
  userName: { flex: 1, fontFamily: 'Barlow_600SemiBold', fontSize: 13, color: '#fff' },
  time: { fontFamily: 'Barlow_300Light', fontSize: 11, color: 'rgba(255,255,255,0.7)' },
});
