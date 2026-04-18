import React from 'react';
import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import {
  Activity, Gauge, Zap, Footprints, Mountain, TreePine, Bike,
  Timer, TrendingUp, Shuffle, Flame, Route as RouteIcon, Dumbbell,
  Waves, Accessibility, Snowflake,
} from 'lucide-react-native';
import type { ActivityType } from '../types';
import { Colors } from '@theme';

const C = Colors;
const FONT = 'Barlow_400Regular';
const FONT_MED = 'Barlow_500Medium';
const FONT_LIGHT = 'Barlow_300Light';

type IconComp = typeof Activity;
const ACTIVITIES: { id: ActivityType; label: string; icon: IconComp; color: string; bg: string }[] = [
  { id: 'run',           label: 'Run',        icon: Activity,     color: '#D93518', bg: '#FDE8E4' },
  { id: 'jog',           label: 'Jog',        icon: Gauge,        color: '#D93518', bg: '#FDE8E4' },
  { id: 'sprint',        label: 'Sprint',     icon: Zap,          color: '#DC2626', bg: '#FEE2E2' },
  { id: 'walk',          label: 'Walk',       icon: Footprints,   color: '#059669', bg: '#D1FAE5' },
  { id: 'hike',          label: 'Hike',       icon: Mountain,     color: '#B45309', bg: '#FEF3C7' },
  { id: 'trail_run',     label: 'Trail',      icon: TreePine,     color: '#15803D', bg: '#DCFCE7' },
  { id: 'cycle',         label: 'Cycle',      icon: Bike,         color: '#0284C7', bg: '#E0F2FE' },
  { id: 'interval',      label: 'Intervals',  icon: Timer,        color: '#7C3AED', bg: '#EDE9FE' },
  { id: 'tempo',         label: 'Tempo',      icon: TrendingUp,   color: '#EA580C', bg: '#FFEDD5' },
  { id: 'fartlek',       label: 'Fartlek',    icon: Shuffle,      color: '#2563EB', bg: '#DBEAFE' },
  { id: 'race',          label: 'Race',       icon: Flame,        color: '#E11D48', bg: '#FFE4E6' },
  { id: 'cross_country', label: 'XC',         icon: RouteIcon,    color: '#4338CA', bg: '#E0E7FF' },
  { id: 'stair_climb',   label: 'Stairs',     icon: TrendingUp,   color: '#9333EA', bg: '#F3E8FF' },
  { id: 'hiit',          label: 'HIIT',       icon: Flame,        color: '#DC2626', bg: '#FEE2E2' },
  { id: 'strength',      label: 'Strength',   icon: Dumbbell,     color: '#4B5563', bg: '#F3F4F6' },
  { id: 'swim',          label: 'Swim',       icon: Waves,        color: '#0369A1', bg: '#E0F2FE' },
  { id: 'wheelchair',    label: 'Wheelchair', icon: Accessibility, color: '#6D28D9', bg: '#EDE9FE' },
  { id: 'ski',           label: 'Ski',        icon: Snowflake,    color: '#0EA5E9', bg: '#E0F2FE' },
];

interface ActivityModalProps {
  visible: boolean;
  selected: ActivityType;
  bottomInset: number;
  onSelect: (type: ActivityType) => void;
  onClose: () => void;
}

export default function ActivityModal({ visible, selected, bottomInset, onSelect, onClose }: ActivityModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={ss.overlay} onPress={onClose} />
      <View style={[ss.sheet, { paddingBottom: Math.max(bottomInset, 16) }]}>
        <View style={ss.header}>
          <View>
            <Text style={ss.title}>Activity</Text>
            <Text style={ss.sub}>Select your workout type</Text>
          </View>
          <Pressable style={ss.closeBtn} onPress={onClose}>
            <Text style={{ color: C.muted, fontSize: 16 }}>✕</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={ss.grid} showsVerticalScrollIndicator={false}>
          {ACTIVITIES.map(a => {
            const Icon = a.icon;
            const isSelected = selected === a.id;
            return (
              <Pressable
                key={a.id}
                style={[ss.chip, isSelected && { backgroundColor: a.bg, borderColor: 'transparent' }]}
                onPress={() => onSelect(a.id)}
              >
                <View style={[ss.iconBox, isSelected && { backgroundColor: a.color + '22' }]}>
                  <Icon size={20} color={isSelected ? a.color : C.muted} strokeWidth={1.5} />
                </View>
                <Text style={[ss.chipLabel, isSelected && { color: a.color, fontFamily: FONT_MED }]}>{a.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const ss = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
  sheet:    { backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 4 },
  header:   { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  title:    { fontFamily: FONT_MED, fontSize: 17, color: C.black },
  sub:      { fontFamily: FONT_LIGHT, fontSize: 12, color: C.muted, marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.bg, borderWidth: 0.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, paddingBottom: 20 },
  chip:     { width: '30%', alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 0.5, borderColor: C.border, backgroundColor: C.white },
  iconBox:  { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  chipLabel:{ fontFamily: FONT, fontSize: 11, color: C.muted },
});
