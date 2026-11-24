import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { AWARD_DEFINITIONS } from '@shared/constants/awards';
import type { AwardId } from '@shared/types/game';
import { X } from 'phosphor-react-native';
import { GlyphBadge } from '@mobile/shared/icons';
import { useTheme, Type, Fonts, type AppColors } from '@theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = NativeStackScreenProps<RootStackParamList, 'AwardDetail'>['route'];

export default function AwardDetailScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { awardId, unlockedAt } = route.params;

  const def = AWARD_DEFINITIONS[awardId as AwardId];
  const isEarned = !!unlockedAt;

  if (!def) {
    return (
      <SafeAreaView style={s.root}>
        <Pressable hitSlop={8} style={s.closeBtn} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Close"><X size={18} color={C.t2} /></Pressable>
        <Text style={s.errorText}>Unknown award</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <Pressable style={s.closeBtn} onPress={() => navigation.goBack()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
        <X size={18} color={C.t2} weight="regular" />
      </Pressable>

      <View style={s.content}>
        <View style={s.icon}><GlyphBadge glyph={isEarned ? def.icon : '🔒'} size={96} muted={!isEarned} /></View>
        <Text style={s.title}>{def.title}</Text>
        <View style={[s.categoryBadge, isEarned && s.categoryBadgeEarned]}>
          <Text style={[s.categoryText, isEarned && s.categoryTextEarned]}>
            {def.category.toUpperCase()}
          </Text>
        </View>
        <Text style={s.description}>{def.description}</Text>
        {isEarned && unlockedAt ? (
          <Text style={s.date}>
            Unlocked {new Date(unlockedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </Text>
        ) : (
          <Text style={s.locked}>Keep running to unlock this award</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:            { flex: 1, backgroundColor: C.bg },
    closeBtn:        { position: 'absolute', top: 52, right: 20, width: 32, height: 32, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
    content:         { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
    icon:            { marginBottom: 16 },
    title:           { fontFamily: Fonts.semiBold, fontSize: 28, color: C.black, textAlign: 'center', marginBottom: 12 },
    categoryBadge:   { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6, backgroundColor: C.stone, borderWidth: 0.5, borderColor: C.border, marginBottom: 16 },
    categoryBadgeEarned: { backgroundColor: C.amberBg, borderColor: C.gold },
    categoryText:    { ...Type.overline, color: C.t2 },
    categoryTextEarned: { color: C.gold },
    description:     { ...Type.body, color: C.t2, textAlign: 'center', marginBottom: 20 },
    date:            { fontFamily: Fonts.regular, fontSize: 13, color: C.t3 },
    locked:          { fontFamily: Fonts.regular, fontSize: 13, color: C.t3, fontStyle: 'italic' },
    errorText:       { fontFamily: Fonts.regular, fontSize: 14, color: C.t2, textAlign: 'center', marginTop: 100 },
  });
}
