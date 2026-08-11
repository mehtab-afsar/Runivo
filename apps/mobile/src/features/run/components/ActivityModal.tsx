import React, { useMemo } from 'react';
import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import type { ActivityType } from '../types';
import { SELECTABLE_ACTIVITIES as ACTIVITIES } from '../constants/activities';
import { useTheme, Fonts, type AppColors } from '@theme';

interface ActivityModalProps {
  visible: boolean;
  selected: ActivityType;
  bottomInset: number;
  onSelect: (type: ActivityType) => void;
  onClose: () => void;
}

export default function ActivityModal({ visible, selected, bottomInset, onSelect, onClose }: ActivityModalProps) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
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
            <Text style={{ fontFamily: Fonts.regular, color: C.muted, fontSize: 16 }}>✕</Text>
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
                  <Icon size={20} color={isSelected ? a.color : C.muted} weight="light" />
                </View>
                <Text style={[ss.chipLabel, isSelected && { color: a.color, fontFamily: Fonts.medium }]}>{a.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
    sheet:    { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 4 },
    header:   { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
    title:    { fontFamily: Fonts.medium, fontSize: 17, color: C.black },
    sub:      { fontFamily: Fonts.light, fontSize: 12, color: C.muted, marginTop: 2 },
    closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.bg, borderWidth: 0.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, paddingBottom: 20 },
    chip:     { width: '30%', alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 0.5, borderColor: C.border, backgroundColor: C.card },
    iconBox:  { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    chipLabel:{ fontFamily: Fonts.regular, fontSize: 11, color: C.muted },
  });
}
