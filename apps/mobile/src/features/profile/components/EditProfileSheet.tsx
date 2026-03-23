import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Platform } from 'react-native';

const C = { white: '#FFFFFF', black: '#0A0A0A', t3: '#ADADAD', border: '#DDD9D4' };
const SWATCHES = ['#0A0A0A', '#E8435A', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];

interface Props {
  editName: string;
  setEditName: (v: string) => void;
  editBio: string;
  setEditBio: (v: string) => void;
  editColor: string;
  setEditColor: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function EditProfileSheet({
  editName, setEditName, editBio, setEditBio,
  editColor, setEditColor, onSave, onCancel,
}: Props) {
  return (
    <Pressable style={ss.overlay} onPress={onCancel}>
      <Pressable style={ss.sheet} onPress={() => {}}>
        <Text style={ss.sheetTitle}>Edit Profile</Text>

        <Text style={ss.inputLabel}>Display name</Text>
        <TextInput
          style={ss.input} value={editName} onChangeText={setEditName}
          placeholder="Your name" placeholderTextColor={C.t3}
        />

        <Text style={ss.inputLabel}>Bio</Text>
        <TextInput
          style={[ss.input, { height: 72, textAlignVertical: 'top' }]}
          value={editBio} onChangeText={setEditBio}
          placeholder="Tell your city who you are" placeholderTextColor={C.t3} multiline
        />

        <Text style={ss.inputLabel}>Avatar color</Text>
        <View style={ss.swatchRow}>
          {SWATCHES.map(s => (
            <Pressable
              key={s}
              style={[ss.swatch, { backgroundColor: s }, s === editColor && ss.swatchSel]}
              onPress={() => setEditColor(s)}
            />
          ))}
        </View>

        <Pressable style={ss.saveBtn} onPress={onSave}>
          <Text style={ss.saveBtnLabel}>Save</Text>
        </Pressable>
      </Pressable>
    </Pressable>
  );
}

const ss = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(10,10,10,0.4)', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: C.white, borderTopLeftRadius: 16, borderTopRightRadius: 16,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  sheetTitle: { fontFamily: 'Barlow_600SemiBold', fontSize: 16, color: C.black, marginBottom: 20 },
  inputLabel: {
    fontFamily: 'Barlow_400Regular', fontSize: 10, color: C.t3,
    textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6,
  },
  input: {
    fontFamily: 'Barlow_300Light', fontSize: 14, color: C.black,
    borderWidth: 0.5, borderColor: C.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16,
  },
  swatchRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  swatch: { width: 32, height: 32, borderRadius: 16 },
  swatchSel: {
    borderWidth: 3, borderColor: C.white,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  saveBtn: { backgroundColor: C.black, borderRadius: 4, paddingVertical: 13, alignItems: 'center' },
  saveBtnLabel: { fontFamily: 'Barlow_500Medium', fontSize: 12, color: '#fff', textTransform: 'uppercase', letterSpacing: 1 },
});
