import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, SafeAreaView,
  Platform, TextInput, ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useGearAdd } from '@features/gear/hooks/useGearAdd';
import { PhotoPicker } from '@features/gear/components/PhotoPicker';
import { CATEGORIES } from '@features/gear/types';
import { useTheme, type AppColors } from '@theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function GearAddScreen() {
  const C = useTheme();
  const ga = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const {
    brand, model, nickname, category, maxKm, photoUri, setPhotoUri,
    updateField, updateCategory, submit, isValid, submitting, uploadingPhoto,
  } = useGearAdd();
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');
    const ok = await submit();
    if (ok) { navigation.goBack(); } else { setError('Failed to save shoe. Please try again.'); }
  };

  return (
    <SafeAreaView style={ga.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={ga.header}>
          <Pressable onPress={() => navigation.goBack()} style={ga.backBtn}><Text style={ga.backText}>←</Text></Pressable>
          <Text style={ga.title}>Add Shoe</Text>
          <View style={{ width: 32 }} />
        </View>
        <ScrollView contentContainerStyle={ga.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <PhotoPicker uri={photoUri} onPick={setPhotoUri} />
          {uploadingPhoto && <Text style={ga.hint}>Uploading photo…</Text>}

          <Text style={ga.label}>Brand</Text>
          <TextInput style={ga.input} value={brand} onChangeText={v => updateField('brand', v)} placeholder="Nike, Adidas, Asics..." placeholderTextColor={C.t3} maxLength={40} />

          <Text style={ga.label}>Model</Text>
          <TextInput style={ga.input} value={model} onChangeText={v => updateField('model', v)} placeholder="Pegasus 41, Gel-Nimbus 26..." placeholderTextColor={C.t3} maxLength={60} />

          <Text style={ga.label}>Nickname — optional</Text>
          <TextInput style={ga.input} value={nickname} onChangeText={v => updateField('nickname', v)} placeholder="My fast shoes" placeholderTextColor={C.t3} maxLength={40} />

          <Text style={ga.label}>Category</Text>
          <View style={ga.catGrid}>
            {CATEGORIES.map(cat => (
              <Pressable key={cat.value} style={[ga.catBtn, category === cat.value && ga.catBtnActive]} onPress={() => updateCategory(cat.value)}>
                <Text style={{ fontSize: 18 }}>{cat.emoji}</Text>
                <Text style={[ga.catLabel, category === cat.value && ga.catLabelActive]}>{cat.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={ga.label}>Max mileage (km)</Text>
          <TextInput style={ga.input} value={maxKm} onChangeText={v => updateField('maxKm', v)} placeholder="700" placeholderTextColor={C.t3} keyboardType="numeric" maxLength={5} />
          <Text style={ga.hint}>Typical: road 700 km · trail 500 km · track 400 km</Text>

          {error ? <Text style={ga.error}>{error}</Text> : null}

          <Pressable style={[ga.saveBtn, !isValid && ga.saveBtnDisabled]} onPress={handleSave} disabled={!isValid || submitting}>
            {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={ga.saveLabel}>Add Shoe</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function mkStyles(C: AppColors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 12 },
  backBtn: { width: 32 },
  backText: { fontFamily: 'Barlow_400Regular', fontSize: 18, color: C.t2 },
  title: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 20, color: C.black },
  content: { paddingHorizontal: 20, paddingBottom: 60, gap: 4 },
  label: { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.t3, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 14, marginBottom: 6 },
  input: { backgroundColor: C.white, borderRadius: 10, borderWidth: 0.5, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 12, fontFamily: 'Barlow_400Regular', fontSize: 14, color: C.black },
  catGrid: { flexDirection: 'row', gap: 8 },
  catBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: C.white, borderWidth: 0.5, borderColor: C.border, alignItems: 'center', gap: 4 },
  catBtnActive: { backgroundColor: C.black, borderColor: C.black },
  catLabel: { fontFamily: 'Barlow_400Regular', fontSize: 11, color: C.t2 },
  catLabelActive: { color: '#fff', fontFamily: 'Barlow_500Medium' },
  hint: { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.t3, marginTop: 4 },
  error: { fontFamily: 'Barlow_400Regular', fontSize: 12, color: C.red, marginTop: 8 },
  saveBtn: { backgroundColor: C.black, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  saveBtnDisabled: { opacity: 0.4 },
  saveLabel: { fontFamily: 'Barlow_600SemiBold', fontSize: 14, color: '#fff', textTransform: 'uppercase', letterSpacing: 1 },
}); }
