import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, Pressable, StyleSheet, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';

interface LogWeightModalProps {
  visible: boolean;
  currentWeightKg?: number;
  onSave:  (weightKg: number) => void;
  onClose: () => void;
}

export function LogWeightModal({ visible, currentWeightKg, onSave, onClose }: LogWeightModalProps) {
  const C = useTheme();
  const s = mkStyles(C);
  const [weight, setWeight] = useState('');

  useEffect(() => {
    if (visible) setWeight(currentWeightKg ? String(currentWeightKg) : '');
  }, [visible, currentWeightKg]);

  const value = parseFloat(weight);
  const canSave = value > 0 && value < 500;

  function handleSave() {
    if (!canSave) return;
    onSave(value);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={s.card}>
          <View style={s.header}>
            <Text style={s.title}>Log Weight</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <X size={16} color={C.t2} weight="regular" />
            </Pressable>
          </View>
          <TextInput
            style={s.input}
            value={weight}
            onChangeText={setWeight}
            placeholder="70.0"
            placeholderTextColor={C.t3}
            keyboardType="decimal-pad"
            autoFocus
            accessibilityLabel="Weight in kilograms"
          />
          <Text style={s.unit}>kg</Text>
          <Pressable style={[s.saveBtn, !canSave && s.saveBtnDisabled]} onPress={handleSave} disabled={!canSave}>
            <Text style={s.saveLabel}>Save</Text>
          </Pressable>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function mkStyles(C: AppColors) { return StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: C.card, borderRadius: 22, padding: 20,
    borderWidth: 0.5, borderColor: C.border,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontFamily: Fonts.semiBold, fontSize: 16, color: C.t1 },
  input: {
    backgroundColor: C.stone, borderRadius: 10, borderWidth: 0.5, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontFamily: Fonts.semiBold, fontSize: 24, color: C.t1, textAlign: 'center',
  },
  unit: { fontFamily: Fonts.regular, fontSize: 11, color: C.t3, textAlign: 'center', marginTop: 6, marginBottom: 16 },
  saveBtn: { backgroundColor: C.alwaysDark, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.4 },
  saveLabel: { fontFamily: Fonts.semiBold, fontSize: 14, color: C.alwaysLight, letterSpacing: 0.5 },
}); }
