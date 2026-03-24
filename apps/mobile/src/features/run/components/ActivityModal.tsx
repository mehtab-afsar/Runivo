import React from 'react';
import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import type { ActivityType } from '../types';

const C = { bg: '#F7F6F4', white: '#FFFFFF', border: '#E0DFDD', black: '#0A0A0A', muted: '#6B6B6B' };
const FONT = 'Barlow_400Regular';
const FONT_MED = 'Barlow_500Medium';
const FONT_LIGHT = 'Barlow_300Light';

const ACTIVITIES: { id: ActivityType; label: string; emoji: string; color: string; bg: string }[] = [
  { id: 'run',           label: 'Run',        emoji: '🏃', color: '#E8391C', bg: '#FDE8E4' },
  { id: 'jog',           label: 'Jog',        emoji: '🏃', color: '#E8391C', bg: '#FDE8E4' },
  { id: 'sprint',        label: 'Sprint',     emoji: '⚡', color: '#DC2626', bg: '#FEE2E2' },
  { id: 'walk',          label: 'Walk',       emoji: '🚶', color: '#059669', bg: '#D1FAE5' },
  { id: 'hike',          label: 'Hike',       emoji: '⛰️', color: '#B45309', bg: '#FEF3C7' },
  { id: 'trail_run',     label: 'Trail',      emoji: '🌲', color: '#15803D', bg: '#DCFCE7' },
  { id: 'cycle',         label: 'Cycle',      emoji: '🚴', color: '#0284C7', bg: '#E0F2FE' },
  { id: 'interval',      label: 'Intervals',  emoji: '🔁', color: '#7C3AED', bg: '#EDE9FE' },
  { id: 'tempo',         label: 'Tempo',      emoji: '📈', color: '#EA580C', bg: '#FFEDD5' },
  { id: 'fartlek',       label: 'Fartlek',    emoji: '🔀', color: '#2563EB', bg: '#DBEAFE' },
  { id: 'race',          label: 'Race',       emoji: '🏁', color: '#E11D48', bg: '#FFE4E6' },
  { id: 'cross_country', label: 'XC',         emoji: '🌄', color: '#4338CA', bg: '#E0E7FF' },
  { id: 'stair_climb',   label: 'Stairs',     emoji: '🪜', color: '#9333EA', bg: '#F3E8FF' },
  { id: 'hiit',          label: 'HIIT',       emoji: '🔥', color: '#DC2626', bg: '#FEE2E2' },
  { id: 'strength',      label: 'Strength',   emoji: '💪', color: '#4B5563', bg: '#F3F4F6' },
  { id: 'swim',          label: 'Swim',       emoji: '🏊', color: '#0369A1', bg: '#E0F2FE' },
  { id: 'wheelchair',    label: 'Wheelchair', emoji: '♿', color: '#6D28D9', bg: '#EDE9FE' },
  { id: 'ski',           label: 'Ski',        emoji: '⛷️', color: '#0EA5E9', bg: '#E0F2FE' },
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
          {ACTIVITIES.map(a => (
            <Pressable
              key={a.id}
              style={[ss.chip, selected === a.id && { backgroundColor: a.bg, borderColor: 'transparent' }]}
              onPress={() => onSelect(a.id)}
            >
              <Text style={{ fontSize: 20 }}>{a.emoji}</Text>
              <Text style={[ss.chipLabel, selected === a.id && { color: a.color, fontFamily: FONT_MED }]}>{a.label}</Text>
            </Pressable>
          ))}
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
  chipLabel:{ fontFamily: FONT, fontSize: 11, color: C.muted },
});
