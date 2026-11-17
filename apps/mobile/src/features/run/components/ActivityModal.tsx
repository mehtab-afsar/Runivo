import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import type { ActivityType } from '../types';
import { SELECTABLE_ACTIVITIES as ACTIVITIES } from '../constants/activities';
import { useTheme, Fonts, type AppColors } from '@theme';
import { ModalSheet } from '@mobile/shared/components/ModalSheet';

interface ActivityModalProps {
  visible: boolean;
  selected: ActivityType;
  onSelect: (type: ActivityType) => void;
  onClose: () => void;
}

export default function ActivityModal({ visible, selected, onSelect, onClose }: ActivityModalProps) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  return (
    <ModalSheet visible={visible} onClose={onClose} padded={false} title="Activity" subtitle="Select your workout type" showClose>
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
    </ModalSheet>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, paddingBottom: 20 },
    chip:     { width: '30%', alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 0.5, borderColor: C.border, backgroundColor: C.card },
    iconBox:  { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    chipLabel:{ fontFamily: Fonts.regular, fontSize: 11, color: C.muted },
  });
}
