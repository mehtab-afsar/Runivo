import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { avatarColor } from '@shared/lib/avatarUtils';
import type { StoryGroup } from '@features/social/services/storyService';
import { useTheme, Fonts, type AppColors } from '@theme';

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
        const bg      = avatarColor(g.userName);
        const initial = g.userName.slice(0, 1).toUpperCase();
        return (
          <Pressable key={g.userId} style={s.item} onPress={() => onPress(g, i)}>
            <View style={[s.ring, { borderColor: bg }]}>
              <View style={[s.avatar, { backgroundColor: bg }]}>
                <Text style={s.initial}>{initial}</Text>
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
    root:    { borderBottomWidth: 0.5, borderBottomColor: C.border },
    list:    { paddingHorizontal: 16, paddingVertical: 12, gap: 14 },
    item:    { alignItems: 'center', gap: 5, width: 58 },
    ring:    { width: 54, height: 54, borderRadius: 27, borderWidth: 2, padding: 2 },
    avatar:  { flex: 1, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
    initial: { fontFamily: Fonts.semiBold, fontSize: 18, color: C.white },
    name:    { fontFamily: Fonts.regular, fontSize: 10, color: C.t2, width: 58, textAlign: 'center' },
  });
}
