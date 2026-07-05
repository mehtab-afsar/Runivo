import React, { useRef, useState, useMemo, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Dimensions, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Calendar, Users, Trophy } from 'phosphor-react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { WeeklyRing } from './WeeklyRing';
import { useTheme, type AppColors } from '@theme';

const { width: SW } = Dimensions.get('window');
const HERO_W = (SW - 32 - 10) * (1.15 / 2.15);

const QUICK_ACTIONS = [
  { icon: Calendar, name: 'Events',      screen: 'Events' },
  { icon: Users,    name: 'Clubs',       screen: 'Club' },
  { icon: Trophy,   name: 'Leaderboard', screen: 'Leaderboard' },
] as const;

const R_NUT  = 68;
const CIRC   = 2 * Math.PI * R_NUT;

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

function NutritionTile({
  caloriesConsumed,
  calorieGoal,
  runDays,
}: {
  caloriesConsumed: number;
  calorieGoal: number;
  netCaloriesToday: number;
  runDays: boolean[];
  onPress: () => void;
}) {
  const pct       = calorieGoal > 0 ? Math.min(1, caloriesConsumed / calorieGoal) : 0;
  const offset    = CIRC * (1 - pct);
  const remaining = Math.max(0, calorieGoal - caloriesConsumed);
  const todayIdx  = (new Date().getDay() + 6) % 7;

  return (
    <View style={ns.content}>
      <View style={ns.ringWrap}>
        <Svg width={148} height={148}>
          <Defs>
            <LinearGradient id="nutGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0"   stopColor="#F59E0B" />
              <Stop offset="0.5" stopColor="#EF4444" />
              <Stop offset="1"   stopColor="#8B5CF6" />
            </LinearGradient>
          </Defs>
          {/* Track */}
          <Circle cx={74} cy={74} r={R_NUT} stroke="rgba(255,255,255,0.07)" strokeWidth={5} fill="none" />
          {/* Glow bloom */}
          {pct > 0 && (
            <Circle
              cx={74} cy={74} r={R_NUT}
              stroke="#EF4444" strokeWidth={16} strokeOpacity={0.12}
              strokeLinecap="round" fill="none"
              strokeDasharray={CIRC}
              strokeDashoffset={offset}
              transform="rotate(-90, 74, 74)"
            />
          )}
          {/* Main arc */}
          <Circle
            cx={74} cy={74} r={R_NUT}
            stroke="url(#nutGrad)" strokeWidth={5}
            strokeLinecap="round" fill="none"
            strokeDasharray={CIRC}
            strokeDashoffset={offset}
            transform="rotate(-90, 74, 74)"
          />
        </Svg>
        <View style={ns.center}>
          <View style={ns.kcalRow}>
            <Text style={ns.kcal}>{caloriesConsumed.toLocaleString()}</Text>
            <Text style={ns.kcalUnit}>kcal</Text>
          </View>
          <Text style={ns.kcalSub}>
            {remaining > 0 ? `${remaining.toLocaleString()} left` : 'goal hit'}
          </Text>
        </View>
      </View>

      <View style={ns.dayDots}>
        {runDays.map((active, i) => (
          <View
            key={i}
            style={[
              ns.dot,
              i === todayIdx
                ? { backgroundColor: active ? '#EF4444' : 'rgba(255,255,255,0.22)', height: 5 }
                : active
                  ? { backgroundColor: '#F59E0B', opacity: 0.8 }
                  : { backgroundColor: 'rgba(255,255,255,0.1)' },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const ns = StyleSheet.create({
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  ringWrap:{ position: 'relative', width: 148, height: 148, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  center:  { position: 'absolute', alignItems: 'center' },
  kcalRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  kcal:    { fontSize: 34, color: '#fff', letterSpacing: -1.2, lineHeight: 36 },
  kcalUnit:{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 3 },
  kcalSub: { fontSize: 10, color: 'rgba(255,255,255,0.28)', marginTop: 3 },
  dayDots: { flexDirection: 'row', gap: 4, paddingHorizontal: 18 },
  dot:     { flex: 1, height: 3, borderRadius: 2 },
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
              <WeeklyRing weeklyKm={weeklyKm} goalKm={goalKm} runDays={runDays} />
            </View>

            {/* Slide 1 — Nutrition: dark wine background, distinct from slide 0 */}
            <Pressable
              style={[ss.slide, { width: HERO_W, backgroundColor: '#120814' }]}
              onPress={onNutritionPress}
            >
              <NutritionTile
                caloriesConsumed={caloriesConsumed}
                calorieGoal={calorieGoal}
                netCaloriesToday={netCaloriesToday}
                runDays={runDays}
                onPress={onNutritionPress}
              />
            </Pressable>
          </ScrollView>

          <View style={ss.dots}>
            {[0, 1].map(i => (
              <View key={i} style={[ss.dot, slide === i && ss.dotActive]} />
            ))}
          </View>
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
    bento:     { paddingHorizontal: 16, marginBottom: 28 },
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
    qaIcon:    { width: 32, height: 32, borderRadius: 8, backgroundColor: C.white, borderWidth: 0.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    qaLabel:   { fontWeight: '500', fontSize: 13, color: C.t1, flex: 1 },
    startBtn:  { backgroundColor: C.alwaysDark, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
    startLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    startCircle:{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' },
    startPlay: { fontSize: 14, color: '#fff', marginLeft: 2 },
    startHint: { fontSize: 9, color: 'rgba(255,255,255,0.38)', letterSpacing: 1 },
    startLabel:{ fontWeight: '500', fontSize: 17, color: '#fff', lineHeight: 22 },
  });
}
