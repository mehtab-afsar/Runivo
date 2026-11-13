import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts } from '@theme';
import type { StoryGroup } from '@features/social/services/storyService';
import { RunnerFace } from '@mobile/shared/components/RunnerFace';

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
  const story = group.stories[storyIndex] as any;

  return (
    <>
      <View style={[s.header, { top: topOffset + 24 }]}>
        <View style={[s.avatar, { overflow: 'hidden' }]}>
          <RunnerFace seed={group.userName} size={36} />
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
    borderWidth: 2, borderColor: Colors.alwaysLight,
  },
  avatarText: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.alwaysLight },
  userName: { flex: 1, fontFamily: Fonts.semiBold, fontSize: 13, color: Colors.alwaysLight },
  time: { fontFamily: Fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.7)' },
});
