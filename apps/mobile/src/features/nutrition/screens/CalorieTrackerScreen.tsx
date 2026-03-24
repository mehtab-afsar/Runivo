import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { Zap } from 'lucide-react-native';
import { useCalorieTracker } from '@features/nutrition/hooks/useCalorieTracker';
import { useNutritionContext } from '@features/nutrition/hooks/useNutritionContext';
import { useNutritionInsights } from '@features/nutrition/hooks/useNutritionInsights';
import { TrackerBody } from '@features/nutrition/components/TrackerBody';
import { AddFoodModal } from '@features/nutrition/components/AddFoodModal';

const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const C = { bg: '#EDEAE5', white: '#fff', black: '#0A0A0A', red: '#D93518', t3: '#ADADAD', t2: '#6B6B6B', border: '#DDD9D4', green: '#1A6B40', greenBg: '#EDF7F2', amber: '#9E6800', amberBg: '#FDF6E8', orange: '#C25A00', orangeBg: '#FEF0E6' };

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'CalorieTracker'>;

/** Weekly 7-bar calorie chart */
function WeeklyChart({ weekKcals, weekAvg, goal, weekDates }: {
  weekKcals: number[]; weekAvg: number; goal: number; weekDates: string[];
}) {
  const maxKcal = Math.max(goal, ...weekKcals, 1);
  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <View style={wc.card}>
      <View style={wc.cardHead}>
        <Text style={wc.cardTitle}>THIS WEEK</Text>
        {weekAvg > 0 && <Text style={wc.avg}>avg {weekAvg} kcal</Text>}
      </View>
      {/* Goal line label */}
      <View style={wc.chartWrap}>
        <View style={wc.bars}>
          {weekKcals.map((kcal, i) => {
            const pct = Math.min(kcal / maxKcal, 1);
            const isToday = weekDates[i] === todayStr;
            const overGoal = kcal > goal && kcal > 0;
            const barColor = overGoal ? C.orange : isToday ? C.red : C.green;
            return (
              <View key={i} style={wc.barCol}>
                <View style={wc.barTrack}>
                  {/* Goal line */}
                  <View style={[wc.goalLine, { bottom: `${(goal / maxKcal) * 100}%` as `${number}%` }]} />
                  {kcal > 0 && (
                    <View style={[wc.bar, { height: `${pct * 100}%` as `${number}%`, backgroundColor: barColor }]} />
                  )}
                </View>
                <Text style={[wc.dayLabel, isToday && wc.dayLabelActive]}>{DAY_LABELS[i]}</Text>
              </View>
            );
          })}
        </View>
      </View>
      <View style={wc.legend}>
        <View style={wc.legendItem}><View style={[wc.legendDot, { backgroundColor: C.green }]} /><Text style={wc.legendText}>Under goal</Text></View>
        <View style={wc.legendItem}><View style={[wc.legendDot, { backgroundColor: C.orange }]} /><Text style={wc.legendText}>Over goal</Text></View>
        <View style={wc.legendItem}><View style={[wc.legendDot, { backgroundColor: C.red }]} /><Text style={wc.legendText}>Today</Text></View>
      </View>
    </View>
  );
}

export default function CalorieTrackerScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const burnKcalParam = (route.params as { burnKcal?: number } | undefined)?.burnKcal;
  const {
    profile, entries, weekKcals, weekAvg, weekDates, runBurnKcal,
    loading, refreshing,
    showAddModal, setShowAddModal, defaultMeal, expandedMeal, setExpandedMeal,
    consumed, pct, proteinConsumed, carbsConsumed, fatConsumed,
    addEntry, deleteEntry, refresh, openAdd,
  } = useCalorieTracker();

  const [activeTab, setActiveTab] = useState<'today' | 'insights'>('today');
  const { insights: aiInsights, loading: aiLoading } = useNutritionInsights();

  // Pre-open add modal when navigated from RunSummary with a burn kcal value
  useEffect(() => {
    if (burnKcalParam) openAdd('dinner');
  }, [burnKcalParam]);

  const ctx = useNutritionContext({
    proteinConsumed, proteinGoal: profile?.proteinGoalG ?? 150,
    carbsConsumed,   carbsGoal:   profile?.carbsGoalG ?? 250,
    fatConsumed,     fatGoal:     profile?.fatGoalG ?? 65,
  });

  if (loading) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.center}><ActivityIndicator color={C.red} /></View>
      </SafeAreaView>
    );
  }

  if (!profile) { navigation.replace('NutritionSetup'); return null; }

  // Macro totals for insights
  const proteinPct = Math.min(proteinConsumed / Math.max(profile.proteinGoalG, 1), 1);
  const carbsPct   = Math.min(carbsConsumed   / Math.max(profile.carbsGoalG, 1), 1);
  const fatPct     = Math.min(fatConsumed     / Math.max(profile.fatGoalG, 1), 1);

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.back}><Text style={s.backText}>←</Text></Pressable>
        <Text style={s.title}>Calorie Tracker</Text>
        <Pressable onPress={() => navigation.navigate('NutritionSetup')} style={s.settingsBtn}>
          <Text style={s.settingsLabel}>⚙</Text>
        </Pressable>
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        {(['today', 'insights'] as const).map(tab => (
          <Pressable key={tab} style={[s.tabBtn, activeTab === tab && s.tabBtnActive]} onPress={() => setActiveTab(tab)}>
            <Text style={[s.tabLabel, activeTab === tab && s.tabLabelActive]}>
              {tab === 'today' ? 'Today' : 'Insights'}
            </Text>
          </Pressable>
        ))}
      </View>

      {ctx.headerMessage && activeTab === 'today' && (
        <View style={s.contextBanner}>
          <Text style={s.contextText}>{ctx.headerMessage}</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={s.content} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.red} />}
      >
        {activeTab === 'today' && (
          <>
            {/* Run burn chip */}
            {runBurnKcal > 0 && (
              <View style={s.burnChip}>
                <Zap size={12} color="#7A3800" strokeWidth={1.5} />
                <Text style={s.burnText}>Run activity · +{runBurnKcal} kcal burned today</Text>
              </View>
            )}
            <TrackerBody
              profile={profile} entries={entries}
              consumed={consumed} pct={pct}
              proteinConsumed={proteinConsumed} carbsConsumed={carbsConsumed} fatConsumed={fatConsumed}
              expandedMeal={expandedMeal} setExpandedMeal={setExpandedMeal}
              deleteEntry={deleteEntry} openAdd={openAdd}
              onLogFood={() => setShowAddModal(true)}
            />
          </>
        )}

        {activeTab === 'insights' && (
          <View style={{ gap: 10 }}>
            {/* Weekly bar chart */}
            <WeeklyChart
              weekKcals={weekKcals} weekAvg={weekAvg}
              goal={profile.dailyGoalKcal} weekDates={weekDates}
            />

            {/* Macro summary card */}
            <View style={s.macroCard}>
              <Text style={s.cardTitle}>TODAY'S MACROS</Text>
              {[
                { label: 'Protein', consumed: proteinConsumed, goal: profile.proteinGoalG, pct: proteinPct, color: C.red, unit: 'g' },
                { label: 'Carbs',   consumed: carbsConsumed,   goal: profile.carbsGoalG,   pct: carbsPct,   color: C.amber, unit: 'g' },
                { label: 'Fat',     consumed: fatConsumed,     goal: profile.fatGoalG,     pct: fatPct,     color: C.green, unit: 'g' },
              ].map(m => (
                <View key={m.label} style={s.macroRow}>
                  <View style={s.macroMeta}>
                    <Text style={s.macroLabel}>{m.label}</Text>
                    <Text style={s.macroValue}>{m.consumed.toFixed(0)}<Text style={s.macroGoal}>/{m.goal}{m.unit}</Text></Text>
                  </View>
                  <View style={s.macroTrack}>
                    <View style={[s.macroFill, { width: `${m.pct * 100}%` as `${number}%`, backgroundColor: m.color }]} />
                  </View>
                </View>
              ))}
            </View>

            {/* Weekly stats card */}
            {weekAvg > 0 && (
              <View style={s.statsCard}>
                <Text style={s.cardTitle}>WEEKLY STATS</Text>
                <View style={s.statsRow}>
                  <View style={s.statItem}>
                    <Text style={s.statValue}>{weekAvg.toLocaleString()}</Text>
                    <Text style={s.statLabel}>avg kcal/day</Text>
                  </View>
                  <View style={s.statDivider} />
                  <View style={s.statItem}>
                    <Text style={s.statValue}>{weekKcals.filter(k => k > 0).length}</Text>
                    <Text style={s.statLabel}>days logged</Text>
                  </View>
                  <View style={s.statDivider} />
                  <View style={s.statItem}>
                    <Text style={[s.statValue, { color: weekAvg > profile.dailyGoalKcal ? C.orange : C.green }]}>
                      {weekAvg > profile.dailyGoalKcal ? `+${weekAvg - profile.dailyGoalKcal}` : `-${profile.dailyGoalKcal - weekAvg}`}
                    </Text>
                    <Text style={s.statLabel}>vs goal</Text>
                  </View>
                </View>
              </View>
            )}

            {/* AI Nutrition Insights */}
            {(aiLoading || aiInsights) && (
              <View style={s.aiCard}>
                <Text style={s.cardTitle}>AI INSIGHTS</Text>
                {aiLoading && !aiInsights ? (
                  <ActivityIndicator color={C.red} style={{ marginVertical: 8 }} />
                ) : aiInsights?.cards.map((card, i) => (
                  <View key={i} style={s.aiRow}>
                    <Text style={s.aiIcon}>{card.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.aiTitle}>{card.title}</Text>
                      <Text style={s.aiBody}>{card.body}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Ask Coach CTA */}
            <Pressable style={s.coachBtn} onPress={() => navigation.navigate('Coach')}>
              <Text style={s.coachBtnText}>✨  Ask Coach for deeper insights →</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <AddFoodModal
        visible={showAddModal} defaultMeal={defaultMeal}
        onAdd={addEntry} onClose={() => setShowAddModal(false)}
      />
    </SafeAreaView>
  );
}

const wc = StyleSheet.create({
  card:       { backgroundColor: C.white, borderRadius: 14, borderWidth: 0.5, borderColor: C.border, padding: 14 },
  cardHead:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  cardTitle:  { fontFamily: 'Barlow_500Medium', fontSize: 10, letterSpacing: 1, color: C.t3 },
  avg:        { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t2 },
  chartWrap:  { height: 90 },
  bars:       { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  barCol:     { flex: 1, alignItems: 'center', gap: 4 },
  barTrack:   { flex: 1, width: '100%', position: 'relative', justifyContent: 'flex-end' },
  bar:        { width: '100%', borderRadius: 2, minHeight: 2 },
  goalLine:   { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(173,173,173,0.4)' },
  dayLabel:   { fontFamily: 'Barlow_400Regular', fontSize: 9, color: C.t3, textTransform: 'uppercase' },
  dayLabelActive: { color: C.red, fontFamily: 'Barlow_600SemiBold' },
  legend:     { flexDirection: 'row', gap: 12, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:  { width: 6, height: 6, borderRadius: 3 },
  legendText: { fontFamily: 'Barlow_300Light', fontSize: 9, color: C.t3 },
});

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.bg },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 12, backgroundColor: C.white, borderBottomWidth: 0.5, borderBottomColor: C.border },
  back:         { width: 32 },
  backText:     { fontFamily: 'Barlow_400Regular', fontSize: 18, color: C.t2 },
  title:        { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 20, color: C.black },
  settingsBtn:  { width: 32, alignItems: 'flex-end' },
  settingsLabel:{ fontFamily: 'Barlow_400Regular', fontSize: 16, color: C.t2 },
  tabBar:       { flexDirection: 'row', backgroundColor: C.white, borderBottomWidth: 0.5, borderBottomColor: C.border },
  tabBtn:       { flex: 1, paddingVertical: 9, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: C.red },
  tabLabel:     { fontFamily: 'Barlow_400Regular', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: C.t3 },
  tabLabelActive:{ fontFamily: 'Barlow_600SemiBold', color: C.red },
  content:      { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100, gap: 10 },
  contextBanner:{ marginHorizontal: 16, marginTop: 4, padding: 12, backgroundColor: C.greenBg, borderRadius: 10, borderWidth: 0.5, borderColor: '#B7E1CC' },
  contextText:  { fontFamily: 'Barlow_400Regular', fontSize: 12, color: C.green, lineHeight: 18 },
  burnChip:     { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, backgroundColor: C.orangeBg, borderRadius: 8, borderWidth: 0.5, borderColor: 'rgba(194,90,0,0.20)' },
  burnText:     { fontFamily: 'Barlow_500Medium', fontSize: 11, color: '#7A3800' },
  macroCard:    { backgroundColor: C.white, borderRadius: 14, borderWidth: 0.5, borderColor: C.border, padding: 14, gap: 12 },
  cardTitle:    { fontFamily: 'Barlow_500Medium', fontSize: 10, letterSpacing: 1, color: C.t3, marginBottom: 4 },
  macroRow:     { gap: 4 },
  macroMeta:    { flexDirection: 'row', justifyContent: 'space-between' },
  macroLabel:   { fontFamily: 'Barlow_400Regular', fontSize: 12, color: C.black },
  macroValue:   { fontFamily: 'Barlow_600SemiBold', fontSize: 12, color: C.black },
  macroGoal:    { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t3 },
  macroTrack:   { height: 4, backgroundColor: '#E8E4DF', borderRadius: 2, overflow: 'hidden' },
  macroFill:    { height: '100%', borderRadius: 2 },
  statsCard:    { backgroundColor: C.white, borderRadius: 14, borderWidth: 0.5, borderColor: C.border, padding: 14 },
  statsRow:     { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  statItem:     { flex: 1, alignItems: 'center' },
  statDivider:  { width: 0.5, height: 32, backgroundColor: C.border },
  statValue:    { fontFamily: 'Barlow_600SemiBold', fontSize: 18, color: C.black },
  statLabel:    { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.t3, marginTop: 2 },
  aiCard:       { backgroundColor: C.white, borderRadius: 14, borderWidth: 0.5, borderColor: C.border, padding: 14, gap: 10 },
  aiRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  aiIcon:       { fontSize: 20, lineHeight: 24 },
  aiTitle:      { fontFamily: 'Barlow_500Medium', fontSize: 12, color: C.black, marginBottom: 2 },
  aiBody:       { fontFamily: 'Barlow_300Light', fontSize: 12, color: C.t2, lineHeight: 17 },
  coachBtn:     { backgroundColor: C.black, borderRadius: 10, padding: 14, alignItems: 'center' },
  coachBtnText: { fontFamily: 'Barlow_500Medium', fontSize: 13, color: C.white },
});
