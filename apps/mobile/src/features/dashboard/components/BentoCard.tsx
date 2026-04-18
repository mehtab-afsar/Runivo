import React, { useRef, useState, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Dimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Calendar, Users, Trophy } from 'lucide-react-native';
import { WeeklyRing } from './WeeklyRing';
import { useTheme, type AppColors } from '@theme';

const { width: SW } = Dimensions.get('window');
// hero card width = screen - 2 * paddingHorizontal(16) - gap(10) - right column flex
// keep it simple: fixed at hero flex 1.15 of bentoRow width
// We'll use a fixed pixel width computed from screen
const HERO_W = (SW - 32 - 10) * (1.15 / 2.15); // ≈ left col proportion

const QUICK_ACTIONS = [
  { icon: Calendar, name: 'Events',      screen: 'Events' },
  { icon: Users,    name: 'Clubs',       screen: 'Club' },
  { icon: Trophy,   name: 'Leaderboard', screen: 'Leaderboard' },
] as const;

interface Props {
  weeklyKm:         number;
  goalKm:           number;
  runDays:          boolean[];
  caloriesConsumed: number;
  calorieGoal:      number;
  onNavigate:       (screen: string) => void;
  onStartRun:       () => void;
  onOpenCalories:   () => void;
}

const CAL_CIRC = 263.9; // 2 * π * 42

function CalorieRing({ consumed, goal, onPress }: { consumed: number; goal: number; onPress: () => void }) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const pct      = Math.min(consumed / Math.max(goal, 1), 1);
  const remaining = Math.max(goal - consumed, 0);
  const ringColor = pct > 1.0 ? '#C25A00' : pct >= 0.9 ? '#F97316' : '#F97316';

  return (
    <Pressable style={ss.slideInner} onPress={onPress}>
      <Text style={ss.slideLabel}>CALORIES</Text>
      <View style={ss.calCenter}>
        <View style={ss.ringWrap}>
          <Svg width={100} height={100}>
            <Circle cx={50} cy={50} r={42} stroke="rgba(255,255,255,0.12)" strokeWidth={5} fill="none" />
            <Circle
              cx={50} cy={50} r={42} stroke={ringColor} strokeWidth={5}
              strokeLinecap="round" fill="none"
              strokeDasharray={CAL_CIRC}
              strokeDashoffset={CAL_CIRC * (1 - pct)}
              transform="rotate(-90, 50, 50)"
            />
          </Svg>
          <View style={ss.ringCenter}>
            <Text style={ss.calNum}>{consumed >= 1000 ? `${(consumed / 1000).toFixed(1)}k` : consumed.toString()}</Text>
            <Text style={ss.calUnit}>KCAL</Text>
          </View>
        </View>
        <Text style={ss.calPct}>{Math.round(pct * 100)}% of {goal} kcal</Text>
        <Text style={ss.calRemain}>{remaining > 0 ? `${remaining} remaining` : 'Goal reached!'}</Text>
        <Text style={ss.calTap}>Tap to log food →</Text>
      </View>
    </Pressable>
  );
}

export function BentoCard({ weeklyKm, goalKm, runDays, caloriesConsumed, calorieGoal, onNavigate, onStartRun, onOpenCalories }: Props) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const [slide, setSlide] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  return (
    <View style={ss.bento}>
      <View style={ss.bentoRow}>

        {/* Black hero card — swipeable */}
        <View style={ss.hero}>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={e => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / HERO_W);
              setSlide(idx);
            }}
            style={{ flex: 1 }}
          >
            {/* Slide 0 — Weekly Goal */}
            <View style={[ss.slide, ss.slideFlex, { width: HERO_W }]}>
              <WeeklyRing weeklyKm={weeklyKm} goalKm={goalKm} runDays={runDays} />
            </View>
            {/* Slide 1 — Calories */}
            <View style={[ss.slide, ss.slideFlex, { width: HERO_W }]}>
              <CalorieRing consumed={caloriesConsumed} goal={calorieGoal} onPress={onOpenCalories} />
            </View>
          </ScrollView>

          {/* Dot indicators */}
          <View style={ss.dots}>
            {[0, 1].map(i => (
              <View key={i} style={[ss.dot, slide === i && ss.dotActive]} />
            ))}
          </View>
        </View>

        {/* Right column — quick actions */}
        <View style={{ flex: 1, gap: 8 }}>
          {QUICK_ACTIONS.map(({ icon: Icon, name, screen }) => (
            <Pressable
              key={name}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onNavigate(screen); }}
              style={ss.qa}
            >
              <View style={ss.qaIcon}><Icon size={16} color="#0A0A0A" strokeWidth={1.5} /></View>
              <Text style={ss.qaLabel}>{name}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Start run button */}
      <Pressable onPress={onStartRun} style={ss.startBtn}>
        <View style={ss.startLeft}>
          <View style={ss.startCircle}><Text style={ss.startPlay}>&#x25B6;</Text></View>
          <View><Text style={ss.startHint}>TAP TO BEGIN</Text><Text style={ss.startLabel}>Start run</Text></View>
        </View>
        <View style={ss.energy}>
          <Text style={ss.energyText}>1 energy</Text>
        </View>
      </Pressable>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    bento:      { paddingHorizontal: 16, marginBottom: 28 },
    bentoRow:   { flexDirection: 'row', gap: 10, marginBottom: 10 },
    hero:       { flex: 1.15, height: 224, borderRadius: 16, backgroundColor: '#0A0A0A', overflow: 'hidden' },
    slide:      { height: '100%' },
    slideFlex:  { flex: 1 },
    slideInner: { flex: 1, position: 'relative' },
    slideLabel: { position: 'absolute', top: 18, left: 18, fontFamily: 'Barlow_500Medium', fontSize: 10, letterSpacing: 1, color: '#fff' },
    calCenter:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 28, paddingBottom: 14 },
    ringWrap:   { position: 'relative', width: 100, height: 100, alignItems: 'center', justifyContent: 'center' },
    ringCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
    calNum:     { fontFamily: 'Barlow_300Light', fontSize: 20, color: '#fff', letterSpacing: -0.6, lineHeight: 22 },
    calUnit:    { fontFamily: 'Barlow_400Regular', fontSize: 8, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.6, marginTop: 2 },
    calPct:     { fontFamily: 'Barlow_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 10, marginBottom: 4 },
    calRemain:  { fontFamily: 'Barlow_400Regular', fontSize: 10, color: 'rgba(255,255,255,0.55)', marginBottom: 6, textAlign: 'center' },
    calTap:     { fontFamily: 'Barlow_300Light', fontSize: 9, color: 'rgba(255,255,255,0.28)', textAlign: 'center' },
    dots:       { position: 'absolute', bottom: 10, alignSelf: 'center', flexDirection: 'row', gap: 4 },
    dot:        { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },
    dotActive:  { backgroundColor: '#fff', width: 14 },
    qa:         { flex: 1, padding: 15, borderRadius: 14, backgroundColor: '#F0EDE8', borderWidth: 0.5, borderColor: C.border, flexDirection: 'row', alignItems: 'center', gap: 10 },
    qaIcon:     { width: 32, height: 32, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    qaLabel:    { fontFamily: 'Barlow_500Medium', fontSize: 13, color: '#0A0A0A', flex: 1 },
    startBtn:   { backgroundColor: '#0A0A0A', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    startLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
    startCircle:{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' },
    startPlay:  { fontSize: 14, color: '#fff', marginLeft: 2 },
    startHint:  { fontFamily: 'Barlow_400Regular', fontSize: 9, color: 'rgba(255,255,255,0.38)', letterSpacing: 1 },
    startLabel: { fontFamily: 'Barlow_500Medium', fontSize: 17, color: '#fff', lineHeight: 22 },
    energy:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.14)', borderRadius: 10, paddingVertical: 5, paddingHorizontal: 11 },
    energyText: { fontFamily: 'Barlow_400Regular', fontSize: 10, color: 'rgba(255,255,255,0.5)' },
  });
}
