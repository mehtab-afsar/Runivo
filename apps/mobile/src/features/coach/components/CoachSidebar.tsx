import React, { useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, ScrollView, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useTheme } from '@theme';
import { CoachCapabilityCard } from './CoachCapabilityCard';

const SCREEN_H    = Dimensions.get('window').height;
const SHEET_H     = SCREEN_H * 0.82;

const CAPABILITIES = [
  { label: 'Training Plan',     icon: '📋', description: 'Generate a personalised plan',          message: 'Build me a personalised training plan based on my current fitness' },
  { label: 'Run Analysis',      icon: '📊', description: 'Deep dive on your latest run',           message: 'Analyse my most recent run' },
  { label: 'Weekly Brief',      icon: '📅', description: 'Summary of your training week',          message: 'Give me my weekly training brief' },
  { label: 'Pace Coach',        icon: '⚡', description: "What's holding your pace back",          message: 'I want to improve my pace. Based on my data, what is holding me back?' },
  { label: 'Race Prep',         icon: '🏁', description: 'Prepare for your next race',             message: 'Help me prepare for my next race' },
  { label: 'Nutrition Advice',  icon: '🥗', description: 'Fuel strategy for your training load',   message: 'Give me personalised nutrition advice for my training load' },
  { label: 'Injury Prevention', icon: '🛡️', description: 'Catch overtraining early',              message: 'Based on my training load, am I at risk of overtraining or injury?' },
  { label: 'Goal Setting',      icon: '🎯', description: 'Set your next milestone',                message: 'Help me set a new running goal based on my current fitness' },
];

const DATA_ACCESS = ['Last 20 runs', 'Nutrition profile', 'Gear & shoes', 'Territory map', 'Personal records'];
const RULES = [
  'Stays on running & health topics',
  "Won't give medical diagnoses",
  'References your actual data',
];

interface Props {
  visible:              boolean;
  onClose:              () => void;
  onSelectCapability:   (message: string) => void;
}

export function CoachSidebar({ visible, onClose, onSelectCapability }: Props) {
  const C        = useTheme();
  const insets   = useSafeAreaInsets();
  const translateY   = useRef(new Animated.Value(SHEET_H)).current;
  const backdropOp   = useRef(new Animated.Value(0)).current;

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
      {/* Backdrop */}
      <Animated.View
        style={[ss.backdrop, { opacity: backdropOp }]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[ss.sheet, { height: SHEET_H, paddingBottom: insets.bottom + 8, transform: [{ translateY }] }]}
      >
        <View style={ss.handle} />
        <View style={[ss.sheetHeader, { borderBottomColor: C.border }]}>
          <Text style={[ss.sheetTitle, { color: C.t3 }]}>COACH CAPABILITIES</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={18} color={C.t3} strokeWidth={2} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
          {CAPABILITIES.map(cap => (
            <CoachCapabilityCard
              key={cap.label}
              label={cap.label}
              description={cap.description}
              icon={cap.icon}
              onPress={() => { onClose(); onSelectCapability(cap.message); }}
            />
          ))}

          <View style={[ss.section, { borderTopColor: C.border }]}>
            <Text style={[ss.sectionTitle, { color: C.t3 }]}>DATA ACCESS</Text>
            <View style={ss.dataGrid}>
              {DATA_ACCESS.map(d => (
                <View key={d} style={[ss.dataChip, { borderColor: C.border }]}>
                  <Text style={[ss.dataText, { color: C.t2 }]}>✓ {d}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[ss.section, { borderTopColor: C.border }]}>
            <Text style={[ss.sectionTitle, { color: C.t3 }]}>RULES & GUARDRAILS</Text>
            {RULES.map(r => (
              <Text key={r} style={[ss.ruleText, { color: C.t2 }]}>• {r}</Text>
            ))}
          </View>
        </ScrollView>
      </Animated.View>
    </>
  );
}

const ss = StyleSheet.create({
  backdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 90 },
  sheet:       { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, zIndex: 91, overflow: 'hidden' },
  handle:      { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(10,10,10,0.12)', alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5 },
  sheetTitle:  { fontFamily: 'DMSans_500Medium', fontSize: 10, letterSpacing: 1.2 },
  section:     { paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 0.5 },
  sectionTitle:{ fontFamily: 'DMSans_500Medium', fontSize: 10, letterSpacing: 1.2, marginBottom: 12 },
  dataGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dataChip:    { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 0.5, backgroundColor: 'rgba(10,10,10,0.025)' },
  dataText:    { fontFamily: 'DMSans_400Regular', fontSize: 11 },
  ruleText:    { fontFamily: 'DMSans_300Light', fontSize: 12, marginBottom: 6, lineHeight: 18 },
});
