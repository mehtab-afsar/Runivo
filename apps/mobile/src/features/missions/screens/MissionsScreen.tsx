import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, FlatList,
  SafeAreaView, Platform, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { TrendingUp, Map, Flame, Target, Check, Shield, Zap, type LucideIcon } from 'lucide-react-native';
import {
  MISSION_TEMPLATES,
  generateBlueprint,
  GOAL_TO_CATEGORY,
  type GoalCategory,
  type MissionType,
} from '@shared/services/missions';
import { setDailyMissions, getTodaysMissions } from '@shared/services/missionStore';
import { getProfile } from '@shared/services/profile';
import type { PlayerProfile } from '@shared/services/profile';

import { Colors } from '@theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const T = {
  pageBg:  Colors.stone,
  stone:   Colors.surface,
  mid:     Colors.mid,
  border:  Colors.border,
  surface: Colors.bg,
  black:   Colors.black,
  white:   Colors.white,
  t2:      Colors.t2,
  t3:      Colors.t3,
} as const;

// Mission type → Lucide icon
const TYPE_ICON: Record<string, { Icon: LucideIcon; color: string }> = {
  run_distance:        { Icon: TrendingUp, color: '#D93518' },
  claim_territories:   { Icon: Zap,        color: '#EAB308' },
  fortify_territories: { Icon: Shield,     color: '#059669' },
  explore_new_hexes:   { Icon: Map,        color: '#0284C7' },
  run_in_enemy_zone:   { Icon: Zap,        color: '#DC2626' },
  capture_enemy:       { Icon: Shield,     color: '#059669' },
  speed_run:           { Icon: TrendingUp, color: '#D93518' },
  run_streak:          { Icon: Flame,      color: '#EA580C' },
};

// Difficulty styles on white card
const DIFF_CARD = {
  easy:   { bg: '#EDF7F2', fg: '#1A6B40' },
  medium: { bg: '#FDF6E8', fg: '#9E6800' },
  hard:   { bg: '#FEF0EE', fg: '#D93518' },
} as const;

// Difficulty styles on black (blueprint card)
const DIFF_BP = {
  easy:   { bg: 'rgba(26,107,64,0.3)',  fg: '#6DE8A8' },
  medium: { bg: 'rgba(158,104,0,0.3)',  fg: '#FAC75A' },
  hard:   { bg: 'rgba(217,53,24,0.35)', fg: '#FF8B72' },
} as const;

// Category tab definitions
type TabId = 'recommended' | GoalCategory;
const TABS: { id: TabId; label: string }[] = [
  { id: 'recommended', label: 'For You' },
  { id: 'weight_loss', label: 'Weight Loss' },
  { id: 'endurance',   label: 'Endurance' },
  { id: 'speed',       label: 'Speed' },
  { id: 'territory',   label: 'Territory' },
  { id: 'explorer',    label: 'Explorer' },
  { id: 'all',         label: 'All' },
];

const CAT_LABELS: Record<string, string> = {
  weight_loss: 'Weight Loss',
  endurance:   'Endurance',
  speed:       'Speed',
  territory:   'Territory',
  explorer:    'Explorer',
};

const GOAL_LABELS: Record<PlayerProfile['primaryGoal'], string> = {
  get_fit:     'Get Fit',
  lose_weight: 'Lose Weight',
  run_faster:  'Run Faster',
  explore:     'Explore',
  compete:     'Compete',
};

// ── Component ──────────────────────────────────────────────────────────────────
export default function MissionsScreen() {
  const navigation = useNavigation<Nav>();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('recommended');
  const [blueprintMissions, setBlueprintMissions] = useState<ReturnType<typeof generateBlueprint>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getTodaysMissions(),
      getProfile(),
    ]).then(([missions, p]) => {
      if (missions.length > 0) setSelected(new Set(missions.map(m => m.title)));
      if (p) {
        setProfile(p);
        setBlueprintMissions(generateBlueprint(p.primaryGoal, p.missionDifficulty));
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const toggle = useCallback((title: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else if (next.size < 3) {
        next.add(title);
      }
      return next;
    });
  }, []);

  const applyBlueprint = useCallback(async () => {
    const titles = blueprintMissions.map(m => m.title);
    setSelected(new Set(titles));
    setSaving(true);
    await setDailyMissions(titles);
    setSaving(false);
    navigation.goBack();
  }, [blueprintMissions, navigation]);

  const handleSave = useCallback(async () => {
    if (selected.size === 0 || saving) return;
    setSaving(true);
    await setDailyMissions(Array.from(selected));
    setSaving(false);
    navigation.goBack();
  }, [selected, saving, navigation]);

  // Filtered + sorted (selected first)
  const filteredTemplates = useMemo(() => {
    let list: typeof MISSION_TEMPLATES;
    if (activeTab === 'all') {
      list = MISSION_TEMPLATES;
    } else if (activeTab === 'recommended') {
      const goalCat = profile?.primaryGoal ? GOAL_TO_CATEGORY[profile.primaryGoal] : null;
      list = [...MISSION_TEMPLATES].sort((a, b) => {
        if (!goalCat) return 0;
        return (b.goalCategory === goalCat ? 1 : 0) - (a.goalCategory === goalCat ? 1 : 0);
      });
    } else {
      list = MISSION_TEMPLATES.filter(t => t.goalCategory === activeTab);
    }
    const sel   = list.filter(t => selected.has(t.title));
    const unsel = list.filter(t => !selected.has(t.title));
    return [...sel, ...unsel];
  }, [activeTab, profile, selected]);

  // Date label "Mon · Mar 17"
  const today = new Date();
  const weekday  = today.toLocaleDateString('en-US', { weekday: 'short' });
  const monthDay = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const dateLabel = `${weekday} · ${monthDay}`;

  const selectedMissions = Array.from(selected)
    .map(title => MISSION_TEMPLATES.find(t => t.title === title))
    .filter(Boolean) as (typeof MISSION_TEMPLATES)[0][];

  if (loading) {
    return (
      <SafeAreaView style={ss.root}>
        <View style={ss.loader}>
          <ActivityIndicator color={T.black} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={ss.root}>
      {/* ── Header ── */}
      <View style={ss.header}>
        <Pressable onPress={() => navigation.goBack()} style={ss.backBtn}>
          <Text style={ss.backText}>←</Text>
        </Pressable>
        <Text style={ss.headerTitle}>Missions</Text>
        <Text style={ss.dateLabel}>{dateLabel}</Text>
      </View>

      {/* ── Category Tabs ── */}
      <View style={ss.tabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={ss.tabsScroll}
        >
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={[ss.tab, isActive && ss.tabActive]}
              >
                <Text style={[ss.tabText, isActive && ss.tabTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={filteredTemplates}
        keyExtractor={item => item.title}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: selected.size > 0 ? 100 : 40 }}
        ListHeaderComponent={
          <>
            {/* ── Daily Blueprint Card ── */}
            <View style={ss.blueprintOuter}>
              <Text style={ss.blueprintEyebrow}>Daily blueprint</Text>
              <View style={ss.blueprintCard}>
                <Text style={ss.blueprintKicker}>
                  Curated for your {profile ? GOAL_LABELS[profile.primaryGoal] : 'Running'} goal
                </Text>
                <Text style={ss.blueprintTitle}>Today's optimal mission set</Text>

                {/* 3 mission preview rows */}
                <View style={ss.blueprintRows}>
                  {blueprintMissions.length > 0
                    ? blueprintMissions.slice(0, 3).map((m, i) => {
                        const { Icon: BPIcon, color: bpColor } = TYPE_ICON[m.type as MissionType] ?? { Icon: Target, color: '#D93518' };
                        const dStyle = DIFF_BP[m.difficulty];
                        return (
                          <View key={i} style={ss.blueprintRow}>
                            <View style={ss.blueprintIconBox}>
                              <BPIcon size={14} color={bpColor} strokeWidth={1.5} />
                            </View>
                            <View style={ss.blueprintMeta}>
                              <Text style={ss.blueprintMissionTitle}>{m.title}</Text>
                              <Text style={ss.blueprintMissionXp}>+{m.rewards.xp} XP</Text>
                            </View>
                            <View style={[ss.diffPill, { backgroundColor: dStyle.bg }]}>
                              <Text style={[ss.diffPillText, { color: dStyle.fg }]}>{m.difficulty}</Text>
                            </View>
                          </View>
                        );
                      })
                    : [0, 1, 2].map(i => <View key={i} style={ss.blueprintSkeleton} />)}
                </View>

                {/* Apply button */}
                <Pressable
                  onPress={applyBlueprint}
                  style={({ pressed }) => [ss.applyBtn, pressed && { opacity: 0.85 }]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Check size={12} color={T.black} strokeWidth={2} />
                    <Text style={ss.applyBtnText}>Apply Blueprint</Text>
                  </View>
                </Pressable>
              </View>
            </View>

            {/* ── Section Divider ── */}
            <View style={ss.divider}>
              <Text style={ss.dividerLabel}>All missions</Text>
              <Text style={ss.dividerCount}>{selected.size} / 3 selected</Text>
            </View>
          </>
        }
        renderItem={({ item: template }) => {
          const isSelected  = selected.has(template.title);
          const isDisabled  = !isSelected && selected.size >= 3;
          const { Icon: CardIcon, color: cardIconColor } = TYPE_ICON[template.type as MissionType] ?? { Icon: Target, color: '#D93518' };
          const diffStyle   = DIFF_CARD[template.difficulty];
          const catLabel    = template.goalCategory ? CAT_LABELS[template.goalCategory] : null;
          return (
            <Pressable
              onPress={() => !isDisabled && toggle(template.title)}
              style={[ss.missionCard, isSelected && ss.missionCardSelected, isDisabled && ss.missionCardDisabled]}
            >
              {/* Top row */}
              <View style={ss.cardTopRow}>
                <View style={[ss.cardIconBox, isSelected && ss.cardIconBoxSelected]}>
                  <CardIcon size={16} color={isSelected ? T.white : cardIconColor} strokeWidth={1.5} />
                </View>
                <View style={ss.cardMeta}>
                  <Text style={ss.cardTitle}>{template.title}</Text>
                  <View style={ss.badgeRow}>
                    <View style={[ss.diffBadge, { backgroundColor: diffStyle.bg }]}>
                      <Text style={[ss.diffBadgeText, { color: diffStyle.fg }]}>{template.difficulty}</Text>
                    </View>
                    {catLabel && (
                      <View style={ss.catBadge}>
                        <Text style={ss.catBadgeText}>{catLabel}</Text>
                      </View>
                    )}
                  </View>
                </View>
                {isSelected && (
                  <View style={ss.checkCircle}>
                    <Check size={11} color={T.white} strokeWidth={2} />
                  </View>
                )}
              </View>

              {/* Description */}
              <Text style={ss.cardDesc}>{template.description}</Text>

              {/* Rewards row */}
              <View style={ss.rewardsRow}>
                <Text style={ss.rewardValue}>+{template.rewards.xp}</Text>
                <Text style={ss.rewardUnit}> XP</Text>
                <View style={ss.rewardDivider} />
                <Text style={ss.rewardValue}>+{template.rewards.coins}</Text>
                <Text style={ss.rewardUnit}> coins</Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={ss.emptyWrap}>
            <Text style={ss.emptyText}>No missions in this category</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: T.mid }} />}
      />

      {/* ── Sticky Save Bar ── */}
      {selected.size > 0 && (
        <View style={ss.saveBar}>
          {/* 3 slot icons */}
          <View style={ss.slotRow}>
            {[0, 1, 2].map(i => {
              const mission = selectedMissions[i];
              const filled  = !!mission;
              const entry: { Icon: LucideIcon; color: string } = mission ? (TYPE_ICON[mission.type as MissionType] ?? { Icon: Target, color: '#D93518' }) : { Icon: Target, color: T.t3 };
              const { Icon: SlotIcon } = entry;
              return (
                <View
                  key={i}
                  style={[ss.slot, filled && ss.slotFilled, i > 0 && { marginLeft: -6 }]}
                >
                  {filled
                    ? <SlotIcon size={14} color={T.white} strokeWidth={1.5} />
                    : <Text style={{ fontSize: 16, color: T.t3 }}>+</Text>
                  }
                </View>
              );
            })}
          </View>

          {/* Save button */}
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={[ss.saveBtn, saving && { opacity: 0.6 }]}
          >
            <Text style={ss.saveBtnText}>
              {saving
                ? 'Saving…'
                : selected.size === 3
                ? 'Set 3 missions for today'
                : `Set ${selected.size} mission${selected.size !== 1 ? 's' : ''}`}
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const ss = StyleSheet.create({
  root:            { flex: 1, backgroundColor: T.pageBg },
  loader:          { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 12, backgroundColor: T.white, borderBottomWidth: 0.5, borderBottomColor: T.border },
  backBtn:         { width: 30, height: 30, borderRadius: 15, backgroundColor: T.surface, borderWidth: 0.5, borderColor: T.border, alignItems: 'center', justifyContent: 'center' },
  backText:        { fontFamily: 'Barlow_400Regular', fontSize: 16, color: T.black, lineHeight: 18 },
  headerTitle:     { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 22, color: T.black },
  dateLabel:       { fontFamily: 'Barlow_300Light', fontSize: 11, color: T.t3 },

  // Tabs
  tabsContainer:   { backgroundColor: T.white, borderBottomWidth: 0.5, borderBottomColor: T.border },
  tabsScroll:      { paddingHorizontal: 16, paddingVertical: 10, gap: 6, flexDirection: 'row' },
  tab:             { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 2, backgroundColor: T.surface, borderWidth: 0.5, borderColor: T.border },
  tabActive:       { backgroundColor: T.black, borderColor: T.black },
  tabText:         { fontFamily: 'Barlow_500Medium', fontSize: 11, color: T.t3, textTransform: 'uppercase', letterSpacing: 0.6 },
  tabTextActive:   { color: T.white },

  // Blueprint
  blueprintOuter:  { backgroundColor: T.white, padding: 18, marginBottom: 1 },
  blueprintEyebrow:{ fontFamily: 'Barlow_300Light', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.8, color: T.t3, marginBottom: 8 },
  blueprintCard:   { backgroundColor: T.black, borderRadius: 12, padding: 16 },
  blueprintKicker: { fontFamily: 'Barlow_300Light', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.8, color: 'rgba(255,255,255,0.45)', marginBottom: 6 },
  blueprintTitle:  { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 17, color: T.white, lineHeight: 22, marginBottom: 14 },
  blueprintRows:   { gap: 8, marginBottom: 14 },
  blueprintRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  blueprintIconBox:{ width: 28, height: 28, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  blueprintMeta:   { flex: 1 },
  blueprintMissionTitle: { fontFamily: 'Barlow_400Regular', fontSize: 12, color: T.white, lineHeight: 16 },
  blueprintMissionXp:    { fontFamily: 'Barlow_300Light', fontSize: 10, color: 'rgba(255,255,255,0.5)' },
  blueprintSkeleton:     { height: 40, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.08)' },
  diffPill:        { borderRadius: 2, paddingHorizontal: 6, paddingVertical: 2 },
  diffPillText:    { fontFamily: 'Barlow_500Medium', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6 },
  applyBtn:        { backgroundColor: T.white, borderRadius: 6, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  applyBtnText:    { fontFamily: 'Barlow_500Medium', fontSize: 12, color: T.black, textTransform: 'uppercase', letterSpacing: 0.6 },

  // Section divider
  divider:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, backgroundColor: T.stone },
  dividerLabel:    { fontFamily: 'Barlow_300Light', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.8, color: T.t3 },
  dividerCount:    { fontFamily: 'Barlow_300Light', fontSize: 10, color: T.t3 },

  // Mission cards
  missionCard:     { backgroundColor: T.white, padding: 14, paddingHorizontal: 18 },
  missionCardSelected: { backgroundColor: T.surface },
  missionCardDisabled: { opacity: 0.4 },
  cardTopRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  cardIconBox:     { width: 36, height: 36, borderRadius: 8, backgroundColor: T.stone, borderWidth: 0.5, borderColor: T.mid, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardIconBoxSelected: { backgroundColor: T.black, borderColor: T.black },
  cardMeta:        { flex: 1 },
  cardTitle:       { fontFamily: 'Barlow_500Medium', fontSize: 13, color: T.black, marginBottom: 5, lineHeight: 16 },
  badgeRow:        { flexDirection: 'row', gap: 5, flexWrap: 'wrap' },
  diffBadge:       { borderRadius: 2, paddingHorizontal: 7, paddingVertical: 2 },
  diffBadgeText:   { fontFamily: 'Barlow_500Medium', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6 },
  catBadge:        { borderRadius: 2, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: T.stone },
  catBadgeText:    { fontFamily: 'Barlow_300Light', fontSize: 9, color: T.t3 },
  checkCircle:     { width: 20, height: 20, borderRadius: 10, backgroundColor: T.black, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  checkText:       { fontFamily: 'Barlow_600SemiBold', fontSize: 11, color: T.white },
  cardDesc:        { fontFamily: 'Barlow_300Light', fontSize: 11, color: T.t2, lineHeight: 17, marginBottom: 10 },
  rewardsRow:      { flexDirection: 'row', alignItems: 'baseline' },
  rewardValue:     { fontFamily: 'Barlow_400Regular', fontSize: 12, color: T.black },
  rewardUnit:      { fontFamily: 'Barlow_300Light', fontSize: 10, color: T.t3 },
  rewardDivider:   { width: 1, height: 12, backgroundColor: T.mid, marginHorizontal: 10 },

  // Empty
  emptyWrap:       { padding: 48, alignItems: 'center' },
  emptyText:       { fontFamily: 'Barlow_300Light', fontSize: 13, color: T.t3 },

  // Save bar
  saveBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: T.white,
    borderTopWidth: 0.5, borderTopColor: T.border,
    paddingHorizontal: 20, paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  slotRow:    { flexDirection: 'row', alignItems: 'center' },
  slot:       { width: 32, height: 32, borderRadius: 8, borderWidth: 2, borderColor: T.white, backgroundColor: T.stone, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  slotFilled: { backgroundColor: T.black, zIndex: 3 },
  saveBtn:    { flex: 1, backgroundColor: T.black, borderRadius: 3, paddingVertical: 13, alignItems: 'center' },
  saveBtnText:{ fontFamily: 'Barlow_500Medium', fontSize: 12, color: T.white, textTransform: 'uppercase', letterSpacing: 0.6 },
});
