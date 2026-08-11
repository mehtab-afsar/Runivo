import React, { useRef, useState, useMemo, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Dimensions, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Calendar, Users, Trophy } from 'phosphor-react-native';
import { WeeklyRing } from './WeeklyRing';
import { DayArcRing } from './DayArcRing';
import { useTheme, Fonts, Spacing, type AppColors } from '@theme';
import { FEATURES } from '../../../config/features';

const { width: SW } = Dimensions.get('window');
const HERO_W = (SW - Spacing.gutter * 2 - 10) * (1.15 / 2.15);

const QUICK_ACTIONS = [
  { icon: Calendar, name: 'Events',      screen: 'Events' },
  { icon: Users,    name: 'Clubs',       screen: 'Club' },
  { icon: Trophy,   name: 'Leaderboard', screen: 'Leaderboard' },
] as const;

interface Props {
  weeklyKm:         number;
  goalKm:           number;
  runDays:          boolean[];
  ownedCount:       number;
  avgFreshness:     number;
  caloriesConsumed: number;
  calorieGoal:      number;
  netCaloriesToday: number;
  onNavigate:       (screen: string) => void;
  onStartRun:       () => void;
  onNutritionPress: () => void;
}

function nutritionCaption(consumed: number, goal: number, remaining: number): string {
  if (goal <= 0) return 'Set up your targets';
  if (remaining === 0) return 'Right on target';
  if (consumed === 0) return 'Nothing logged yet today';
  return `${remaining.toLocaleString()} kcal left today`;
}

function NutritionTile({
  caloriesConsumed,
  calorieGoal,
  runDays,
  onPress,
}: {
  caloriesConsumed: number;
  calorieGoal: number;
  netCaloriesToday: number;
  runDays: boolean[];
  onPress: () => void;
}) {
  const remaining = Math.max(0, calorieGoal - caloriesConsumed);
  const todayIdx  = (new Date().getDay() + 6) % 7;

  return (
    <View style={ns.content}>
      <DayArcRing
        dayDone={runDays} todayIdx={todayIdx}
        accentColor="#FF5326" gradientFrom="#E8B400" gradientTo="#FF5326" gradientId="nutritionRing"
        onPress={onPress}
      >
        <View style={ns.kcalRow}>
          <Text style={ns.kcal}>{caloriesConsumed.toLocaleString()}</Text>
          <Text style={ns.kcalUnit}>kcal</Text>
        </View>
        <Text style={ns.kcalSub}>
          {remaining > 0 ? `${remaining.toLocaleString()} left` : 'goal hit'}
        </Text>
      </DayArcRing>
      <Text style={ns.caption}>{nutritionCaption(caloriesConsumed, calorieGoal, remaining)}</Text>
    </View>
  );
}

const ns = StyleSheet.create({
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 10 },
  kcalRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  kcal:    { fontFamily: Fonts.light, fontSize: 34, color: '#fff', letterSpacing: -1.2, lineHeight: 36, fontVariant: ['tabular-nums'] },
  kcalUnit:{ fontFamily: Fonts.light, fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 3 },
  kcalSub: { fontFamily: Fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 3 },
  caption: { fontFamily: Fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center', paddingHorizontal: 20 },
});

export function BentoCard({
  weeklyKm, goalKm, runDays,
  caloriesConsumed, calorieGoal, netCaloriesToday,
  onNavigate, onStartRun, onNutritionPress,
}: Props) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const [slide, setSlide] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const userScrollingRef = useRef(false);

  useEffect(() => {
    if (!FEATURES.NUTRITION_TRACKER) return;
    const id = setInterval(() => {
      if (userScrollingRef.current) return;
      setSlide(prev => {
        const next = (prev + 1) % 2;
        scrollRef.current?.scrollTo({ x: next * HERO_W, animated: true });
        return next;
      });
    }, 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={ss.bento}>
      <View style={ss.bentoRow}>

        <View style={ss.hero}>
          {FEATURES.NUTRITION_TRACKER ? (
            <>
              <ScrollView
                ref={scrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                onScrollBeginDrag={() => { userScrollingRef.current = true; }}
                onScrollEndDrag={() => { userScrollingRef.current = false; }}
                onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / HERO_W);
                  setSlide(idx);
                }}
                style={{ flex: 1 }}
              >
                {/* Slide 0 — Weekly Goal: pure black */}
                <View style={[ss.slide, { width: HERO_W }]}>
                  <WeeklyRing
                    weeklyKm={weeklyKm} goalKm={goalKm} runDays={runDays}
                    onPress={() => onNavigate('History')}
                  />
                </View>

                {/* Slide 1 — Nutrition: warm near-black, distinct from slide 0's pure dark.
                    The ring itself is the tap target (DayArcRing) — no outer Pressable,
                    so its own press-bounce animation isn't fighting a nested one. */}
                <View style={[ss.slide, { width: HERO_W, backgroundColor: '#1A120C' }]}>
                  <NutritionTile
                    caloriesConsumed={caloriesConsumed}
                    calorieGoal={calorieGoal}
                    netCaloriesToday={netCaloriesToday}
                    runDays={runDays}
                    onPress={onNutritionPress}
                  />
                </View>
              </ScrollView>

              <View style={ss.dots}>
                {[0, 1].map(i => (
                  <View key={i} style={[ss.dot, slide === i && ss.dotActive]} />
                ))}
              </View>
            </>
          ) : (
            // Nutrition tracking is off — no carousel, no fake calorie card to tap
            // through to a ComingSoon screen. Just the weekly-goal ring, full width.
            <View style={[ss.slide, { width: HERO_W }]}>
              <WeeklyRing
                weeklyKm={weeklyKm} goalKm={goalKm} runDays={runDays}
                onPress={() => onNavigate('History')}
              />
            </View>
          )}
        </View>

        {/* Right column */}
        <View style={{ flex: 1, gap: 8 }}>
          {QUICK_ACTIONS.map(({ icon: Icon, name, screen }) => (
            <Pressable
              key={name}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onNavigate(screen); }}
              style={ss.qa}
            >
              <View style={ss.qaIcon}><Icon size={16} color={C.alwaysDark} weight="light" /></View>
              <Text style={ss.qaLabel}>{name}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable onPress={onStartRun} style={ss.startBtn}>
        <View style={ss.startLeft}>
          <View style={ss.startCircle}><Text style={ss.startPlay}>&#x25B6;</Text></View>
          <View><Text style={ss.startHint}>TAP TO BEGIN</Text><Text style={ss.startLabel}>Start run</Text></View>
        </View>
      </Pressable>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    bento:     { paddingHorizontal: Spacing.gutter, marginBottom: 28 },
    bentoRow:  { flexDirection: 'row', gap: 10, marginBottom: 10 },
    // Intentionally-dark hero (holds white-on-dark ring/nutrition content) — fixed in
    // both themes via the alwaysDark token.
    hero:      { flex: 1.15, height: 224, borderRadius: 16, backgroundColor: C.alwaysDark, overflow: 'hidden' },
    slide:     { height: '100%', flex: 1 },
    dots:      { position: 'absolute', bottom: 10, alignSelf: 'center', flexDirection: 'row', gap: 4 },
    dot:       { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },
    dotActive: { backgroundColor: '#fff', width: 14 },
    // Quick-action tiles are elevated surfaces that must invert with the theme —
    // C.surface (light gray → dark gray), C.t1 label, white icon badge with a fixed
    // dark glyph (set in JSX above).
    qa:        { flex: 1, padding: 15, borderRadius: 14, backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.border, flexDirection: 'row', alignItems: 'center', gap: 10 },
    qaIcon:    { width: 32, height: 32, borderRadius: 8, backgroundColor: C.alwaysLight, borderWidth: 0.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    qaLabel:   { fontFamily: Fonts.medium, fontSize: 13, color: C.t1, flex: 1 },
    startBtn:  { backgroundColor: C.alwaysDark, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
    startLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    startCircle:{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' },
    startPlay: { fontSize: 14, color: '#fff', marginLeft: 2 },
    startHint: { fontFamily: Fonts.medium, fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: 1 },
    startLabel:{ fontFamily: Fonts.medium, fontSize: 17, color: '#fff', lineHeight: 22 },
  });
}
