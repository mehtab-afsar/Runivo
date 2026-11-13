import React, { useRef, useState, useMemo, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Dimensions, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Calendar, Users, Trophy } from 'lucide-react-native';
import { WeeklyRing } from './WeeklyRing';
import { HeroRing } from './HeroRing';
import { useTheme, Fonts, Spacing, type AppColors } from '@theme';
import { FEATURES } from '../../../config/features';

const { width: SW } = Dimensions.get('window');
// Full-width paging slide — the hero card no longer shares its row with the
// quick-action column (that's now a chip row below), so the slide just fills
// the card's own width (bento's gutter padding minus nothing else).
const SLIDE_W = SW - Spacing.gutter * 2;

const QUICK_ACTIONS = [
  { icon: Calendar, name: 'Events',      screen: 'Events' },
  { icon: Users,    name: 'Clubs',       screen: 'Club' },
  { icon: Trophy,   name: 'Leaderboard', screen: 'Leaderboard' },
] as const;

interface Props {
  weeklyKm:         number;
  goalKm:           number;
  /** Lifetime run count — distinguishes "never run" from "slow week" in the
   *  ring's empty state. Presentation-only; goal/streak logic is untouched. */
  totalRuns:        number;
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
  onPress,
}: {
  caloriesConsumed: number;
  calorieGoal: number;
  netCaloriesToday: number;
  onPress: () => void;
}) {
  const remaining = Math.max(0, calorieGoal - caloriesConsumed);
  const pct = calorieGoal > 0 ? Math.min(caloriesConsumed / calorieGoal, 1) : 0;

  return (
    <View style={ns.content}>
      <Pressable onPress={onPress}>
        <HeroRing
          size={76}
          trackColor="rgba(255,255,255,0.15)"
          pct={pct}
          arcColor={caloriesConsumed > 0 ? '#000000' : undefined}
        >
          <View style={ns.kcalRow}>
            <Text style={ns.kcal}>{caloriesConsumed.toLocaleString()}</Text>
          </View>
          <Text style={ns.kcalUnit}>kcal</Text>
        </HeroRing>
      </Pressable>
      <Text style={ns.caption}>{nutritionCaption(caloriesConsumed, calorieGoal, remaining)}</Text>
    </View>
  );
}

const ns = StyleSheet.create({
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 10 },
  kcalRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  kcal:    { fontFamily: Fonts.numeric, fontSize: 22, color: '#fff', letterSpacing: -0.8, lineHeight: 24, fontVariant: ['tabular-nums'] },
  kcalUnit:{ fontFamily: Fonts.light, fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  caption: { fontFamily: Fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center', paddingHorizontal: 20 },
});

export function BentoCard({
  weeklyKm, goalKm, totalRuns,
  caloriesConsumed, calorieGoal, netCaloriesToday,
  onNavigate, onStartRun, onNutritionPress,
}: Props) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const [slide, setSlide] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const userScrollingRef = useRef(false);
  const hasRunHistory = totalRuns > 0;

  useEffect(() => {
    if (!FEATURES.NUTRITION_TRACKER) return;
    const id = setInterval(() => {
      if (userScrollingRef.current) return;
      setSlide(prev => {
        const next = (prev + 1) % 2;
        scrollRef.current?.scrollTo({ x: next * SLIDE_W, animated: true });
        return next;
      });
    }, 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={ss.bento}>
      {/* Ring/nutrition carousel card — its own card, visually separate from
          Start Run below (a gap + the Start Run card's own background, not a
          shared container with an internal divider). */}
      <View style={ss.ringCard}>
        <View style={ss.carouselWrap}>
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
                  const idx = Math.round(e.nativeEvent.contentOffset.x / SLIDE_W);
                  setSlide(idx);
                }}
                style={{ flex: 1 }}
              >
                {/* Slide 0 — Weekly Goal: pure black */}
                <View style={[ss.slide, { width: SLIDE_W }]}>
                  <WeeklyRing
                    weeklyKm={weeklyKm} goalKm={goalKm}
                    hasRunHistory={hasRunHistory}
                    onPress={() => onNavigate('History')}
                  />
                </View>

                {/* Slide 1 — Nutrition: warm near-black, distinct from slide 0's pure dark. */}
                <View style={[ss.slide, { width: SLIDE_W, backgroundColor: '#1A120C' }]}>
                  <NutritionTile
                    caloriesConsumed={caloriesConsumed}
                    calorieGoal={calorieGoal}
                    netCaloriesToday={netCaloriesToday}
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
            <View style={[ss.slide, { width: SLIDE_W }]}>
              <WeeklyRing
                weeklyKm={weeklyKm} goalKm={goalKm}
                hasRunHistory={hasRunHistory}
                onPress={() => onNavigate('History')}
              />
            </View>
          )}
        </View>
      </View>

      <Pressable onPress={onStartRun} style={ss.startCard}>
        <View style={ss.startLeft}>
          <View style={ss.startCircle}><Text style={ss.startPlay}>&#x25B6;</Text></View>
          <View><Text style={ss.startHint}>Tap to begin</Text><Text style={ss.startLabel}>Start run</Text></View>
        </View>
      </Pressable>

      {/* Quick actions — one horizontal row of equal-width chips */}
      <View style={ss.chipRow}>
        {QUICK_ACTIONS.map(({ icon: Icon, name, screen }) => (
          <Pressable
            key={name}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onNavigate(screen); }}
            style={ss.chip}
          >
            <View style={ss.chipIcon}><Icon size={16} color={C.alwaysDark} strokeWidth={2} /></View>
            <Text style={ss.chipLabel}>{name}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    bento:        { paddingHorizontal: Spacing.gutter, marginBottom: 28 },
    // Intentionally-dark cards (hold white-on-dark content) — fixed in both
    // themes via the alwaysDark token. Two separate cards with a real gap
    // between them, not one container with an internal divider.
    ringCard:     { borderRadius: 24, backgroundColor: C.alwaysDark, overflow: 'hidden', marginBottom: 10 },
    carouselWrap: { height: 210 },
    slide:        { height: '100%', flex: 1 },
    dots:         { position: 'absolute', bottom: 10, alignSelf: 'center', flexDirection: 'row', gap: 4 },
    dot:          { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },
    dotActive:    { backgroundColor: '#fff', width: 14 },

    startCard:    { borderRadius: 16, backgroundColor: C.alwaysDark, paddingVertical: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    startLeft:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
    startCircle:  { width: 40, height: 40, borderRadius: 20, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' },
    startPlay:    { fontSize: 14, color: C.alwaysLight, marginLeft: 2 },
    startHint:    { fontFamily: Fonts.medium, fontSize: 11, color: 'rgba(255,255,255,0.45)' },
    startLabel:   { fontFamily: Fonts.medium, fontSize: 17, color: C.alwaysLight, lineHeight: 22 },

    // Quick-action chips are elevated surfaces that must invert with the theme —
    // C.surface (light gray → dark gray), C.t1 label, white icon badge with a fixed
    // dark glyph (set in JSX above).
    chipRow:      { flexDirection: 'row', gap: 8 },
    chip:         { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.border, gap: 8 },
    chipIcon:     { width: 32, height: 32, borderRadius: 8, backgroundColor: C.alwaysLight, borderWidth: 0.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    chipLabel:    { fontFamily: Fonts.medium, fontSize: 11.5, color: C.t1 },
  });
}
