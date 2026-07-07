import React, { useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, ScrollView, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'phosphor-react-native';
import { useTheme, Colors, Fonts } from '@theme';

const SCREEN_H = Dimensions.get('window').height;
const SHEET_H  = SCREEN_H * 0.88;

interface Capability {
  emoji: string;
  name: string;
  desc: string;
  free: boolean;
  prompt: string;
}

const CAPABILITIES: Capability[] = [
  { emoji: '☀️', name: 'Morning Brief',      desc: 'Daily readiness + territory alert',    free: true,  prompt: '' },
  { emoji: '⚡', name: 'Post-Run Debrief',   desc: 'Auto after every run',                 free: true,  prompt: 'Analyse my last run' },
  { emoji: '📊', name: 'Weekly Review',      desc: 'Auto every Sunday',                    free: true,  prompt: 'Give me my weekly review' },
  { emoji: '🔥', name: 'Habit Tracking',     desc: 'Consistency score + streak',           free: true,  prompt: 'habit_tracking' },
  { emoji: '🗺',  name: 'Territory Strategy', desc: 'Which zones to defend or expand',      free: false, prompt: 'Plan my territory strategy for this week' },
  { emoji: '📅', name: 'Training Plan',      desc: 'Structured 4–8 week curriculum',       free: false, prompt: 'Create me a training plan' },
  { emoji: '💬', name: 'Ask Anything',       desc: 'Running coach on demand',              free: false, prompt: '' },
  { emoji: '🥗', name: 'Nutrition Coach',    desc: '14-day food + run pattern analysis',   free: false, prompt: 'nutrition_coach' },
  { emoji: '🏁', name: 'Race Prep',          desc: 'Goal race → peaking plan',             free: false, prompt: 'Help me prepare for a race' },
  { emoji: '🛡',  name: 'Injury Prevention',  desc: 'Weekly load + decline monitoring',     free: true,  prompt: 'I have pain — what should I do?' },
];

interface Props {
  visible:            boolean;
  onClose:            () => void;
  onSelectCapability: (message: string) => void;
}

export function CoachSidebar({ visible, onClose, onSelectCapability }: Props) {
  const C       = useTheme();
  const insets  = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SHEET_H)).current;
  const backdropOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(backdropOp, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(translateY, { toValue: SHEET_H, useNativeDriver: true, tension: 80, friction: 14 }),
        Animated.timing(backdropOp, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Animated.View
        style={[ss.backdrop, { opacity: backdropOp }]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[ss.sheet, { height: SHEET_H, paddingBottom: insets.bottom + 8, transform: [{ translateY }] }]}>
        <View style={ss.handle} />

        <View style={[ss.header, { borderBottomColor: C.border }]}>
          <Text style={[ss.headerTitle, { color: C.black }]}>
            What <Text style={{ color: C.black }}>Pace</Text><Text style={[ss.xRed, { color: C.red }]}>X</Text> can do
          </Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={18} color={C.t3} weight="regular" />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={ss.grid}>
          {CAPABILITIES.map((cap, i) => (
            <Pressable
              key={cap.name}
              style={({ pressed }) => [
                ss.capCard,
                { backgroundColor: pressed ? C.mid : C.surface, borderColor: C.border },
              ]}
              onPress={() => {
                onClose();
                if (cap.prompt) onSelectCapability(cap.prompt);
              }}
            >
              <Text style={ss.capEmoji}>{cap.emoji}</Text>
              <Text style={[ss.capName, { color: C.black }]}>{cap.name}</Text>
              <Text style={[ss.capDesc, { color: C.t3 }]} numberOfLines={2}>{cap.desc}</Text>
              <View style={[ss.pill, { backgroundColor: cap.free ? C.greenBg : C.amberBg }]}>
                <Text style={[ss.pillText, { color: cap.free ? C.green : C.amber }]}>
                  {cap.free ? 'Free' : 'Premium'}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </Animated.View>
    </>
  );
}

const ss = StyleSheet.create({
  backdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 90 },
  sheet:       { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, zIndex: 91, overflow: 'hidden' },
  handle:      { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(10,10,10,0.12)', alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5 },
  headerTitle: { fontFamily: Fonts.semiBold, fontSize: 15 },
  xRed:        { fontFamily: Fonts.bold },
  grid:        { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 10 },
  capCard:     { width: '47%', borderRadius: 12, borderWidth: 0.5, padding: 12, gap: 4 },
  capEmoji:    { fontSize: 22, marginBottom: 4 },
  capName:     { fontFamily: Fonts.medium, fontSize: 12 },
  capDesc:     { fontFamily: Fonts.regular, fontSize: 10, lineHeight: 14 },
  pill:        { alignSelf: 'flex-start', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4 },
  pillText:    { fontFamily: Fonts.medium, fontSize: 10, letterSpacing: 0.3 },
});
