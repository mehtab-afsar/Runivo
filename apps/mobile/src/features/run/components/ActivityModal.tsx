import React from 'react';
import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import type { ActivityType } from '../types';

const C = { bg: '#F7F6F4', white: '#FFFFFF', border: '#E0DFDD', black: '#0A0A0A', muted: '#6B6B6B' };
const FONT = 'Barlow_400Regular';
const FONT_MED = 'Barlow_500Medium';
const FONT_LIGHT = 'Barlow_300Light';

const ACTIVITIES: { id: ActivityType; label: string; emoji: string; color: string; bg: string }[] = [
  { id: 'run',      label: 'Run',       emoji: '🏃', color: '#E8391C', bg: '#FDE8E4' },
  { id: 'walk',     label: 'Walk',      emoji: '🚶', color: '#059669', bg: '#D1FAE5' },
  { id: 'cycle',    label: 'Cycle',     emoji: '🚴', color: '#0284C7', bg: '#E0F2FE' },
  { id: 'hike',     label: 'Hike',      emoji: '⛰️', color: '#B45309', bg: '#FEF3C7' },
  { id: 'trail',    label: 'Trail',     emoji: '🌲', color: '#15803D', bg: '#DCFCE7' },
  { id: 'interval', label: 'Intervals', emoji: '🔁', color: '#7C3AED', bg: '#EDE9FE' },
  { id: 'long_run', label: 'Long Run',  emoji: '📈', color: '#EA580C', bg: '#FFEDD5' },
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
