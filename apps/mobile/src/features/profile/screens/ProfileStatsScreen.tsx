/** Statistics: year and all-time totals, best efforts, for one sport. */
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { CaretLeft } from 'phosphor-react-native';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useTheme, Fonts, type AppColors } from '@theme';
import { useProfile } from '../hooks/useProfile';
import { StatsCard, BestEfforts } from '../components/ProfileActivity';
import { SportChip } from '../components/SportPicker';
import type { SportFilter } from '../utils/profileStats';

export default function ProfileStatsScreen() {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'ProfileStats'>>();
  const [sport, setSport] = useState<SportFilter>(route.params?.sport ?? 'all');
  const { runs, personalRecords } = useProfile();
  return (
    <View style={s.root}>
      <View style={[s.top, { paddingTop: insets.top + 6 }]}>
        <Pressable style={s.back} hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }} onPress={() => navigation.goBack()} accessibilityLabel="Back"><CaretLeft size={20} color={C.t1} weight="bold" /></Pressable>
        <Text style={s.title}>Statistics</Text>
        <SportChip value={sport} onChange={setSport} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, gap: 12, paddingBottom: 40 }}>
        <StatsCard runs={runs} sport={sport} />
        {(sport === 'all' || sport === 'run') && <BestEfforts records={personalRecords} />}
      </ScrollView>
    </View>
  );
}

function mk(C: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    top: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 10 },
    back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    title: { flex: 1, fontFamily: Fonts.bold, fontSize: 20, color: C.t1 },
  });
}
