import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, SafeAreaView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { AWARD_DEFINITIONS } from '@shared/constants/awards';
import type { AwardId } from '@shared/types/game';
import { X } from 'lucide-react-native';
import { useTheme, type AppColors } from '@theme';

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
        <Pressable style={s.closeBtn} onPress={() => navigation.goBack()}><X size={18} color={C.t2} /></Pressable>
        <Text style={s.errorText}>Unknown award</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <Pressable style={s.closeBtn} onPress={() => navigation.goBack()} hitSlop={8}>
        <X size={18} color={C.t2} strokeWidth={2} />
      </Pressable>

      <View style={s.content}>
        <Text style={[s.icon, !isEarned && s.iconLocked]}>{isEarned ? def.icon : '🔒'}</Text>
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
    icon:            { fontSize: 72, marginBottom: 16 },
    iconLocked:      { opacity: 0.35 },
    title:           { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 28, color: C.black, textAlign: 'center', marginBottom: 12 },
    categoryBadge:   { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6, backgroundColor: C.stone, borderWidth: 0.5, borderColor: C.border, marginBottom: 16 },
    categoryBadgeEarned: { backgroundColor: '#FFFBF2', borderColor: '#D97706' },
    categoryText:    { fontFamily: 'Barlow_500Medium', fontSize: 10, color: C.t2, letterSpacing: 1, textTransform: 'uppercase' },
    categoryTextEarned: { color: '#D97706' },
    description:     { fontFamily: 'Barlow_300Light', fontSize: 15, color: C.t2, textAlign: 'center', lineHeight: 22, marginBottom: 20 },
    date:            { fontFamily: 'Barlow_400Regular', fontSize: 13, color: C.t3 },
    locked:          { fontFamily: 'Barlow_300Light', fontSize: 13, color: C.t3, fontStyle: 'italic' },
    errorText:       { fontFamily: 'Barlow_400Regular', fontSize: 14, color: C.t2, textAlign: 'center', marginTop: 100 },
  });
}
