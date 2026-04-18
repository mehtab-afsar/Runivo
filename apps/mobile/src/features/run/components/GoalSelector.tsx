import React from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import type { GoalType } from '../types';
import { Colors } from '@theme';

const C = Colors;
const FONT = 'Barlow_400Regular';
const FONT_MED = 'Barlow_500Medium';
const FONT_SEMI = 'Barlow_600SemiBold';

const GOAL_TYPES: { id: GoalType; label: string; unit?: string }[] = [
  { id: 'open',     label: 'Open' },
  { id: 'distance', label: 'Distance', unit: 'km' },
  { id: 'time',     label: 'Time',     unit: 'min' },
  { id: 'calories', label: 'Calories', unit: 'kcal' },
];

interface GoalSelectorProps {
  goalType: GoalType;
  goalValue: number;
  onTypeChange: (type: GoalType) => void;
  onValueChange: (value: number) => void;
}

export default function GoalSelector({ goalType, goalValue, onTypeChange, onValueChange }: GoalSelectorProps) {
  const activeGoal = GOAL_TYPES.find(g => g.id === goalType);

  return (
    <View style={ss.container}>
      <View style={ss.typeRow}>
        {GOAL_TYPES.map(g => (
          <Pressable
            key={g.id}
            style={[ss.typeBtn, goalType === g.id && ss.typeBtnActive]}
            onPress={() => onTypeChange(g.id)}
          >
            <Text style={[ss.typeLabel, goalType === g.id && ss.typeLabelActive]}>{g.label}</Text>
          </Pressable>
        ))}
      </View>

      {goalType !== 'open' && (
        <View style={ss.valueRow}>
          <TextInput
            style={ss.valueInput}
            keyboardType="numeric"
            value={goalValue > 0 ? String(goalValue) : ''}
            onChangeText={text => onValueChange(parseFloat(text) || 0)}
            placeholder="0"
            placeholderTextColor={C.muted}
          />
          <Text style={ss.unit}>{activeGoal?.unit}</Text>
        </View>
      )}
    </View>
  );
}

const ss = StyleSheet.create({
  container:      { paddingHorizontal: 16 },
  typeRow:        { flexDirection: 'row', backgroundColor: C.stone, borderRadius: 8, padding: 3, gap: 3 },
  typeBtn:        { flex: 1, paddingVertical: 9, borderRadius: 6, alignItems: 'center' },
  typeBtnActive:  { backgroundColor: C.black },
  typeLabel:      { fontFamily: FONT, fontSize: 11, color: C.muted },
  typeLabelActive:{ fontFamily: FONT_MED, color: C.white },
  valueRow:       { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 12 },
  valueInput:     { fontFamily: FONT_SEMI, fontSize: 32, color: C.black, minWidth: 60 },
  unit:           { fontFamily: FONT, fontSize: 13, color: C.muted },
});
