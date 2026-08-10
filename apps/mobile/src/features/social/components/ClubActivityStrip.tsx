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
    section:  { backgroundColor: C.bg, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: C.border },
    label:    { color: C.t3, paddingHorizontal: Spacing.gutter, marginBottom: 10 },
    scroll:   { paddingHorizontal: 20, gap: 10 },
    chip:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.stone, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, width: 190, borderWidth: 0.5, borderColor: C.border },
    badge:    { fontSize: 18 },
    text:     { fontFamily: Fonts.regular, fontSize: 12, color: C.black },
    username: { fontFamily: Fonts.semiBold },
    clubName: { fontFamily: Fonts.regular, fontSize: 10, color: C.t3, marginTop: 1 },
  });
}
