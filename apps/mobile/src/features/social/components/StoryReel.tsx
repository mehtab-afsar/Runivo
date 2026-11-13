import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import type { StoryGroup } from '@features/social/services/storyService';
import { useTheme, Fonts, type AppColors } from '@theme';
import { RunnerFace } from '@mobile/shared/components/RunnerFace';

interface Props {
  groups:   StoryGroup[];
  onPress:  (group: StoryGroup, index: number) => void;
}

export function StoryReel({ groups, onPress }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  if (groups.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.list}
      style={s.root}
    >
      {groups.map((g, i) => {
        return (
          <Pressable key={g.userId} style={s.item} onPress={() => onPress(g, i)}>
            <View style={s.ring}>
              <View style={[s.avatar, { overflow: 'hidden' }]}>
                <RunnerFace seed={g.userName} size={54} />
              </View>
            </View>
            <Text style={s.name} numberOfLines={1}>{g.userName}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:    { marginBottom: 4 },
    // 54pt faces ringed in red with a 2pt gap, as in the mock.
    list:    { paddingHorizontal: 18, paddingVertical: 6, gap: 12 },
    item:    { alignItems: 'center', gap: 4, width: 62 },
    ring:    { width: 62, height: 62, borderRadius: 31, borderWidth: 2, borderColor: C.red, padding: 2 },
    avatar:  { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
    initial: { fontFamily: Fonts.semiBold, fontSize: 18, color: C.white },
    name:    { fontFamily: Fonts.regular, fontSize: 11, color: C.t1, width: 62, textAlign: 'center' },
  });
}
