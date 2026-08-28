import React, { useEffect, useState, useCallback, useMemo, type RefObject } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useTheme, Type, Fonts, type AppColors } from '@theme';
import { useCoachNav } from '@navigation/CoachNavContext';

const SEEN_KEY = 'runivo:dashboardTourSeen';
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PAD = 10; // breathing room around the highlighted element

interface Rect { x: number; y: number; width: number; height: number }

interface Step {
  ref: RefObject<View | null>;
  title: string;
  body: string;
}

interface DashboardTourProps {
  targets: { paceStore: RefObject<View | null>; bento: RefObject<View | null>; map: RefObject<View | null> };
  /** Only run for genuinely new accounts — a returning user doesn't need this again. */
  active: boolean;
}

/**
 * A 3-stop spotlight tour, shown once, for accounts with nothing logged yet.
 * Not a full app walkthrough — just "here's where the money, the week, and
 * the map live" — dismissible at any point, never shown again after.
 */
export function DashboardTour({ targets, active }: DashboardTourProps) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const { setTourActive } = useCoachNav();
  const [checked, setChecked] = useState(false);
  const [visible, setVisible] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  // Keep the tab bar out of the way for the whole time the tour is up, and
  // guarantee it comes back — both on normal finish and if this component
  // unmounts mid-tour (e.g. the user navigates away some other way).
  useEffect(() => {
    setTourActive(visible);
    return () => setTourActive(false);
  }, [visible, setTourActive]);

  const steps: Step[] = useMemo(() => [
    { ref: targets.paceStore, title: 'Earn as you run', body: 'Every km earns PACE — spend it on real rewards in the store.' },
    { ref: targets.bento,     title: 'Your week, at a glance', body: 'Track weekly distance, log nutrition, and start a run from here.' },
    { ref: targets.map,       title: 'Claim your territory',  body: 'Every run claims streets on the map — defend them to keep them.' },
  ], [targets.paceStore, targets.bento, targets.map]);

  useEffect(() => {
    if (!active || checked) return;
    AsyncStorage.getItem(SEEN_KEY).then(seen => {
      setChecked(true);
      if (!seen) {
        // Let the first layout pass settle before measuring targets.
        setTimeout(() => setVisible(true), 400);
      }
    }).catch(() => setChecked(true));
  }, [active, checked]);

  const measure = useCallback((idx: number) => {
    const target = steps[idx]?.ref.current;
    if (!target) return;
    target.measureInWindow((x, y, width, height) => setRect({ x, y, width, height }));
  }, [steps]);

  useEffect(() => {
    if (visible) measure(stepIdx);
  }, [visible, stepIdx, measure]);

  const finish = useCallback(() => {
    setVisible(false);
    AsyncStorage.setItem(SEEN_KEY, '1').catch(() => {});
  }, []);

  const next = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (stepIdx >= steps.length - 1) { finish(); return; }
    setStepIdx(i => i + 1);
  }, [stepIdx, steps.length, finish]);

  if (!visible || !rect) return null;

  const step = steps[stepIdx];
  const placeBelow = rect.y < SCREEN_H * 0.58;
  const cardTop = placeBelow ? rect.y + rect.height + PAD + 10 : undefined;
  const cardBottom = !placeBelow ? SCREEN_H - rect.y + PAD + 10 : undefined;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Dimmed backdrop as four bands around the cutout — avoids a mask/blend dependency */}
      <View style={[ss.dim, { top: 0, left: 0, right: 0, height: Math.max(0, rect.y - PAD) }]} />
      <View style={[ss.dim, { top: rect.y + rect.height + PAD, left: 0, right: 0, bottom: 0 }]} />
      <View style={[ss.dim, { top: rect.y - PAD, left: 0, width: Math.max(0, rect.x - PAD), height: rect.height + PAD * 2 }]} />
      <View style={[ss.dim, { top: rect.y - PAD, left: rect.x + rect.width + PAD, right: 0, height: rect.height + PAD * 2 }]} />

      {/* Highlight ring around the target */}
      <View
        pointerEvents="none"
        style={[ss.ring, { top: rect.y - PAD, left: rect.x - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }]}
      />

      <View style={[ss.card, cardTop !== undefined ? { top: cardTop } : { bottom: cardBottom }]}>
        <Text style={ss.title}>{step.title}</Text>
        <Text style={ss.body}>{step.body}</Text>

        <View style={ss.footer}>
          <View style={ss.dots}>
            {steps.map((_, i) => (
              <View key={i} style={[ss.dot, i === stepIdx && ss.dotActive]} />
            ))}
          </View>
          <View style={ss.actions}>
            <Pressable onPress={finish} hitSlop={8}>
              <Text style={ss.skip}>Skip</Text>
            </Pressable>
            <Pressable style={ss.nextBtn} onPress={next}>
              <Text style={ss.nextLabel}>{stepIdx === steps.length - 1 ? 'Got it' : 'Next'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    dim:   { position: 'absolute', backgroundColor: 'rgba(13,13,13,0.82)' },
    ring:  {
      position: 'absolute', borderRadius: 22, borderWidth: 2, borderColor: C.red,
    },
    card:  {
      position: 'absolute', left: 20, right: 20, maxWidth: SCREEN_W - 40,
      backgroundColor: C.alwaysDark, borderRadius: 18, padding: 18,
      shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 10,
    },
    title: { fontFamily: Fonts.semiBold, fontSize: 17, color: C.alwaysLight, marginBottom: 6 },
    body:  { fontFamily: Fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 19, marginBottom: 16 },
    footer:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    dots:  { flexDirection: 'row', gap: 5 },
    dot:   { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(255,255,255,0.25)' },
    dotActive: { backgroundColor: C.red, width: 14 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
    skip:  { ...Type.label, color: 'rgba(255,255,255,0.5)' },
    nextBtn: {
      backgroundColor: C.red, borderRadius: 10, paddingVertical: Platform.OS === 'ios' ? 8 : 6, paddingHorizontal: 16,
    },
    nextLabel: { fontFamily: Fonts.semiBold, fontSize: 13, color: C.alwaysLight },
  });
}
