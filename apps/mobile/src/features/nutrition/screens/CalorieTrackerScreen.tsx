import React from 'react';
import { View, Text, StyleSheet, Pressable, SafeAreaView, ScrollView, Platform, ActivityIndicator, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useCalorieTracker } from '@features/nutrition/hooks/useCalorieTracker';
import { useNutritionContext } from '@features/nutrition/hooks/useNutritionContext';
import { TrackerBody } from '@features/nutrition/components/TrackerBody';
import { AddFoodModal } from '@features/nutrition/components/AddFoodModal';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function CalorieTrackerScreen() {
  const navigation = useNavigation<Nav>();
  const {
    profile, entries, loading, refreshing,
    showAddModal, setShowAddModal, defaultMeal, expandedMeal, setExpandedMeal,
    consumed, pct, proteinConsumed, carbsConsumed, fatConsumed,
    addEntry, deleteEntry, refresh, openAdd,
  } = useCalorieTracker();

  if (loading) {
    return <SafeAreaView style={s.root}><View style={s.center}><ActivityIndicator color="#D93518" /></View></SafeAreaView>;
  }

  if (!profile) { navigation.replace('NutritionSetup'); return null; }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const ctx = useNutritionContext({
    proteinConsumed, proteinGoal: profile.proteinGoalG,
    carbsConsumed,   carbsGoal:   profile.carbsGoalG,
    fatConsumed,     fatGoal:     profile.fatGoalG,
  });

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.back}><Text style={s.backText}>←</Text></Pressable>
        <Text style={s.title}>Calorie Tracker</Text>
        <View style={{ width: 32 }} />
      </View>

      {ctx.headerMessage && (
        <View style={s.contextBanner}>
          <Text style={s.contextText}>{ctx.headerMessage}</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={s.content} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#D93518" />}
      >
        <TrackerBody
          profile={profile} entries={entries}
          consumed={consumed} pct={pct}
          proteinConsumed={proteinConsumed} carbsConsumed={carbsConsumed} fatConsumed={fatConsumed}
          expandedMeal={expandedMeal} setExpandedMeal={setExpandedMeal}
          deleteEntry={deleteEntry} openAdd={openAdd}
          onLogFood={() => setShowAddModal(true)}
        />
      </ScrollView>

      <AddFoodModal
        visible={showAddModal} defaultMeal={defaultMeal}
        onAdd={addEntry} onClose={() => setShowAddModal(false)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EDEAE5' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 12 },
  back: { width: 32 }, backText: { fontFamily: 'Barlow_400Regular', fontSize: 18, color: '#6B6B6B' },
  title: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 20, color: '#0A0A0A' },
  content: { paddingHorizontal: 16, paddingBottom: 100, gap: 10 },
  contextBanner: { marginHorizontal: 16, marginBottom: 4, padding: 12, backgroundColor: '#EDF7F2', borderRadius: 10, borderWidth: 0.5, borderColor: '#B7E1CC' },
  contextText: { fontFamily: 'Barlow_400Regular', fontSize: 12, color: '#1A6B40', lineHeight: 18 },
});
