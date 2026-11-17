import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft } from '@mobile/shared/icons/lucideCompat';
import { PaceXOrb } from '@mobile/shared/components/PaceXOrb';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useSubscription } from '@features/subscription/hooks/useSubscription';
import { useTheme, Fonts, Type, Spacing, type AppColors } from '@theme';
import { PrimaryButton } from '@mobile/shared/components/PrimaryButton';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const POINTS = [
  'A full debrief after every run: pace, effort and the ground you took',
  'A weekly brief with what to run next and which zones need you',
  'Chat with PaceX, and training plans that adapt as you go',
];

/**
 * PaceX (the AI coach) is part of Runivo Plus. Free runners see what it does
 * and a way in; the server refuses AI calls for them anyway (ai-coach → 402).
 */
export function PlusOnlyCoach({ children }: { children: React.ReactNode }) {
  const { isPremium, loading } = useSubscription();
  const C = useTheme();
  if (loading) {
    return <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.t2} /></View>;
  }
  return isPremium ? <>{children}</> : <PaceXLocked />;
}

export default function PaceXLocked() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();

  return (
    <View style={[s.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 }]}>
      <Pressable onPress={() => navigation.goBack()} style={s.back} hitSlop={10} accessibilityLabel="Back">
        <ChevronLeft size={20} color={C.t1} />
      </Pressable>
      <View style={s.body}>
        <PaceXOrb size={56} />
        <Text style={s.eyebrow}>PaceX · Runivo Plus</Text>
        <Text style={s.hero}>Meet your <Text style={{ color: C.red }}>coach.</Text></Text>
        <Text style={s.sub}>PaceX reads every run you log and tells you exactly what to do next.</Text>
        <View style={s.list}>
          {POINTS.map(p => (
            <View key={p} style={s.item}>
              <View style={s.dot} />
              <Text style={s.itemText}>{p}</Text>
            </View>
          ))}
        </View>
        <Text style={s.note}>Free runners get a summary after every run, built from their own numbers.</Text>
      </View>
      <PrimaryButton label="Try Runivo Plus" onPress={() => navigation.navigate('Subscription', { reason: 'debrief' })} size="lg" fullWidth />
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:     { flex: 1, backgroundColor: C.bg, paddingHorizontal: Spacing.gutter + 4 },
    back:     { width: 36, height: 36, borderRadius: 18, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
    body:     { flex: 1, justifyContent: 'center' },
    icon:     { width: 44, height: 44, borderRadius: 12, backgroundColor: C.redLo, alignItems: 'center', justifyContent: 'center' },
    eyebrow:  { fontFamily: Fonts.semiBold, fontSize: 13, color: C.red, marginTop: 18 },
    hero:     { ...Type.hero, color: C.t1, marginTop: 8 },
    sub:      { fontFamily: Fonts.regular, fontSize: 15.5, lineHeight: 22.5, color: C.t2, marginTop: 12 },
    list:     { marginTop: 22, gap: 12 },
    item:     { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    dot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: C.red, marginTop: 8 },
    itemText: { flex: 1, fontFamily: Fonts.regular, fontSize: 15, lineHeight: 21, color: C.t1 },
    note:     { fontFamily: Fonts.regular, fontSize: 13, lineHeight: 18, color: C.t2, marginTop: 22 },
  });
}
