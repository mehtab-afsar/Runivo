import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Calendar, Users, Award, Zap, Play } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { WeeklyRing } from './WeeklyRing';

const C = { border: '#DDD9D4', red: '#D93518' };

const QUICK_ACTIONS = [
  { Icon: Calendar, name: 'Events',      screen: 'Events' },
  { Icon: Users,    name: 'Clubs',       screen: 'Club' },
  { Icon: Award,    name: 'Leaderboard', screen: 'Leaderboard' },
] as const;

interface Props {
  weeklyKm: number;
  goalKm: number;
  runDays: boolean[];
  onNavigate: (screen: string) => void;
  onStartRun: () => void;
}

export function BentoCard({ weeklyKm, goalKm, runDays, onNavigate, onStartRun }: Props) {
  return (
    <View style={ss.bento}>
      <View style={ss.bentoRow}>
        <View style={ss.hero}>
          <WeeklyRing weeklyKm={weeklyKm} goalKm={goalKm} runDays={runDays} />
        </View>
        <View style={{ flex: 1, gap: 8 }}>
          {QUICK_ACTIONS.map(({ Icon, name, screen }) => (
            <Pressable
              key={name}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onNavigate(screen); }}
              style={ss.qa}
            >
              <View style={ss.qaIcon}><Icon size={14} color={C.red} strokeWidth={1.5} /></View>
              <Text style={ss.qaLabel}>{name}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Pressable onPress={onStartRun} style={ss.startBtn}>
        <View style={ss.startLeft}>
          <View style={ss.startCircle}><Play size={16} color="#fff" fill="#fff" strokeWidth={1.5} /></View>
          <View><Text style={ss.startHint}>TAP TO BEGIN</Text><Text style={ss.startLabel}>Start run</Text></View>
        </View>
        <View style={ss.energy}>
          <Zap size={11} color="rgba(255,255,255,0.5)" strokeWidth={1.5} />
          <Text style={ss.energyText}>1 energy</Text>
        </View>
      </Pressable>
    </View>
  );
}

const ss = StyleSheet.create({
  bento:       { paddingHorizontal: 16, marginBottom: 28 },
  bentoRow:    { flexDirection: 'row', gap: 10, marginBottom: 10 },
  hero:        { flex: 1.15, height: 224, borderRadius: 16, backgroundColor: '#0A0A0A', overflow: 'hidden' },
  qa:          { flex: 1, padding: 15, borderRadius: 14, backgroundColor: '#F0EDE8', borderWidth: 0.5, borderColor: C.border, flexDirection: 'row', alignItems: 'center', gap: 10 },
  qaIcon:      { width: 32, height: 32, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  qaLabel:     { fontFamily: 'Barlow_500Medium', fontSize: 13, color: '#0A0A0A', flex: 1 },
  startBtn:    { backgroundColor: '#0A0A0A', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  startLeft:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  startCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' },
  startHint:   { fontFamily: 'Barlow_400Regular', fontSize: 9, color: 'rgba(255,255,255,0.38)', letterSpacing: 1 },
  startLabel:  { fontFamily: 'Barlow_500Medium', fontSize: 17, color: '#fff', lineHeight: 22 },
  energy:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.14)', borderRadius: 10, paddingVertical: 5, paddingHorizontal: 11 },
  energyText:  { fontFamily: 'Barlow_400Regular', fontSize: 10, color: 'rgba(255,255,255,0.5)' },
});
