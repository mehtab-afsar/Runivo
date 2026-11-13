import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import type { ClubFeedActivityItem } from '@features/clubs/types';
import { useTheme, Fonts, Type, Spacing, type AppColors } from '@theme';

const ACTION_LABELS: Record<string, string> = {
  captured:   'captured a territory',
  lost:       'lost a territory',
  defended:   'defended a territory',
  joined:     'joined',
  leveled_up: 'leveled up',
};

interface Props {
  items: ClubFeedActivityItem[];
  onPress: (item: ClubFeedActivityItem) => void;
}

/** Cross-club activity strip above the Following feed — the only place club
 *  membership has any visible payoff on the main Feed today. */
export function ClubActivityStrip({ items, onPress }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  if (items.length === 0) return null;

  return (
    <View style={s.section}>
      <Text style={[Type.overline, s.label]}>From your clubs</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {items.map(item => (
          <Pressable key={item.id} style={s.chip} onPress={() => onPress(item)}>
            <Text style={s.badge}>{item.badgeEmoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.text} numberOfLines={1}>
                <Text style={s.username}>{item.username}</Text> {ACTION_LABELS[item.action] ?? item.action}
              </Text>
              <Text style={s.clubName} numberOfLines={1}>{item.clubName}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    section:  { backgroundColor: C.bg, paddingTop: 6, paddingBottom: 14 },
    label:    { color: C.t2, paddingHorizontal: Spacing.gutter, marginBottom: 10 },
    scroll:   { paddingHorizontal: 12, gap: 10 },
    chip:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, width: 210 },
    badge:    { fontSize: 18 },
    text:     { fontFamily: Fonts.regular, fontSize: 13, color: C.t1 },
    username: { fontFamily: Fonts.semiBold },
    clubName: { fontFamily: Fonts.regular, fontSize: 11, color: C.t2, marginTop: 2 },
  });
}
