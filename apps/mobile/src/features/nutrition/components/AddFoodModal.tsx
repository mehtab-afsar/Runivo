import React, { useState, useEffect, useRef } from 'react';
import {
  Modal, SafeAreaView, View, Text, TextInput, Pressable,
  ScrollView, StyleSheet, Platform, Alert, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { X, Barcode, Camera, CheckCircle } from 'phosphor-react-native';
import type { NutritionEntry } from '@shared/services/store';
import type { Meal } from '@features/nutrition/types';
import { MEALS } from '@features/nutrition/types';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { scanFoodPhoto, type ScannedFood } from '@features/nutrition/services/foodScanService';

const QUICK_ADDS = [
  { name: 'Banana',         kcal: 90,  protein: 1,  carbs: 23, fat: 0 },
  { name: 'Protein shake',  kcal: 150, protein: 25, carbs: 6,  fat: 3 },
  { name: 'Black coffee',   kcal: 5,   protein: 0,  carbs: 1,  fat: 0 },
  { name: 'Protein bar',    kcal: 200, protein: 20, carbs: 22, fat: 5 },
  { name: 'Greek yogurt',   kcal: 100, protein: 17, carbs: 6,  fat: 0 },
  { name: 'Chicken breast', kcal: 165, protein: 31, carbs: 0,  fat: 4 },
];

interface AddFoodModalProps {
  visible:      boolean;
  defaultMeal:  Meal;
  defaultKcal?: number;
  onAdd:   (entry: Omit<NutritionEntry, 'id' | 'date' | 'loggedAt' | 'xpAwarded'>) => void;
  onClose: () => void;
}

export function AddFoodModal({ visible, defaultMeal, defaultKcal, onAdd, onClose }: AddFoodModalProps) {
  const [name,    setName]    = useState('');
  const [kcal,    setKcal]    = useState('');
  const [protein, setProtein] = useState('');
  const [carbs,   setCarbs]   = useState('');
  const [fat,     setFat]     = useState('');
  const [serving, setServing] = useState('');
  const [meal,    setMeal]    = useState<Meal>(defaultMeal);

  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [scanBanner,         setScanBanner]         = useState<string | null>(null);
  const [photoScanning,      setPhotoScanning]      = useState(false);

  const submittingRef = useRef(false);

  useEffect(() => { setMeal(defaultMeal); }, [defaultMeal]);

  useEffect(() => {
    if (defaultKcal && defaultKcal > 0) setKcal(String(defaultKcal));
  }, [defaultKcal]);

  // Clear form and banner when modal closes
  useEffect(() => {
    if (!visible) {
      setName(''); setKcal(''); setProtein(''); setCarbs(''); setFat(''); setServing('');
      setScanBanner(null);
      submittingRef.current = false;
    }
  }, [visible]);

  function applyScannedFood(food: ScannedFood) {
    setName(food.name);
    setKcal(String(food.kcal));
    setProtein(String(food.proteinG));
    setCarbs(String(food.carbsG));
    setFat(String(food.fatG));
    setServing(food.servingSize);
    setScanBanner(food.name);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function applyQuickAdd(q: typeof QUICK_ADDS[0]) {
    setName(q.name);
    setKcal(String(q.kcal));
    setProtein(String(q.protein));
    setCarbs(String(q.carbs));
    setFat(String(q.fat));
    setScanBanner(null);
  }

  async function handlePhotoScan() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Enable camera access in Settings to scan food photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.6,
    });
    if (result.canceled || !result.assets[0]) return;

    setPhotoScanning(true);
    const food = await scanFoodPhoto(result.assets[0].uri);
    setPhotoScanning(false);

    if (food) {
      applyScannedFood(food);
    } else {
      Alert.alert('Could not identify food', 'Try again with a clearer photo, or enter details manually.');
    }
  }

  const canAdd = name.trim().length > 0 && parseFloat(kcal) > 0;

  function handleAdd() {
    if (!canAdd || submittingRef.current) return;
    submittingRef.current = true;
    onAdd({
      meal,
      name:        name.trim(),
      kcal:        parseFloat(kcal)    || 0,
      proteinG:    parseFloat(protein) || 0,
      carbsG:      parseFloat(carbs)   || 0,
      fatG:        parseFloat(fat)     || 0,
      servingSize: serving || '1 serving',
      source:      'manual',
      synced:      false,
    });
    submittingRef.current = false;
    onClose();
  }

  function handleClose() { onClose(); }

  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
        <SafeAreaView style={s.root}>
          {/* Header */}
          <View style={s.header}>
            <Pressable onPress={handleClose} style={s.closeBtn}>
              <X size={16} color="#6B6B6B" weight="regular" />
            </Pressable>
            <Text style={s.title}>Log Food</Text>
            <View style={s.scanBtns}>
              <Pressable
                style={s.scanBtn}
                onPress={() => setShowBarcodeScanner(true)}
                hitSlop={8}
              >
                <Barcode size={20} color="#0A0A0A" weight="regular" />
              </Pressable>
              <Pressable
                style={s.scanBtn}
                onPress={handlePhotoScan}
                disabled={photoScanning}
                hitSlop={8}
              >
                {photoScanning
                  ? <ActivityIndicator size="small" color="#D93518" />
                  : <Camera size={20} color="#0A0A0A" weight="regular" />
                }
              </Pressable>
            </View>
          </View>

          {/* Scan result banner */}
          {scanBanner && (
            <View style={s.banner}>
              <CheckCircle size={14} color="#1A6B40" weight="fill" />
              <Text style={s.bannerText} numberOfLines={1}>
                Found: <Text style={s.bannerName}>{scanBanner}</Text>
              </Text>
              <Pressable onPress={() => setScanBanner(null)} hitSlop={8}>
                <X size={12} color="#6B6B6B" weight="regular" />
              </Pressable>
            </View>
          )}

          <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
            {/* Meal selector */}
            <View style={s.mealRow}>
              {MEALS.map(m => (
                <Pressable
                  key={m.value}
                  style={[s.mealBtn, meal === m.value && s.mealBtnActive]}
                  onPress={() => setMeal(m.value)}
                >
                  <Text style={{ fontSize: 14 }}>{m.emoji}</Text>
                  <Text style={[s.mealLabel, meal === m.value && s.mealLabelActive]}>{m.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* Scan CTA row — shown when form is empty */}
            {!name && (
              <View style={s.scanCTA}>
                <Pressable style={s.scanCTABtn} onPress={() => setShowBarcodeScanner(true)}>
                  <Barcode size={16} color="#D93518" weight="regular" />
                  <Text style={s.scanCTALabel}>Scan barcode</Text>
                </Pressable>
                <View style={s.scanDivider} />
                <Pressable style={s.scanCTABtn} onPress={handlePhotoScan} disabled={photoScanning}>
                  {photoScanning
                    ? <ActivityIndicator size="small" color="#D93518" />
                    : <Camera size={16} color="#D93518" weight="regular" />
                  }
                  <Text style={s.scanCTALabel}>AI photo scan</Text>
                </Pressable>
              </View>
            )}

            {/* Quick-add chips */}
            <Text style={s.sectionLabel}>QUICK ADD</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chips} contentContainerStyle={s.chipsContent}>
              {QUICK_ADDS.map(q => (
                <Pressable key={q.name} style={s.chip} onPress={() => applyQuickAdd(q)}>
                  <Text style={s.chipName}>{q.name}</Text>
                  <Text style={s.chipKcal}>{q.kcal} kcal</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Food name */}
            <Text style={s.fieldLabel}>Food name *</Text>
            <TextInput
              style={s.input} value={name} onChangeText={v => { setName(v); if (scanBanner) setScanBanner(null); }}
              placeholder="e.g. Chicken breast" placeholderTextColor="#ADADAD"
            />

            {/* Calories */}
            <Text style={s.fieldLabel}>Calories *</Text>
            <TextInput
              style={s.input} value={kcal} onChangeText={setKcal}
              placeholder="300" placeholderTextColor="#ADADAD"
              keyboardType="decimal-pad"
            />

            {/* Macros row */}
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Protein (g)</Text>
                <TextInput style={s.input} value={protein} onChangeText={setProtein} placeholder="25" placeholderTextColor="#ADADAD" keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Carbs (g)</Text>
                <TextInput style={s.input} value={carbs} onChangeText={setCarbs} placeholder="30" placeholderTextColor="#ADADAD" keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Fat (g)</Text>
                <TextInput style={s.input} value={fat} onChangeText={setFat} placeholder="10" placeholderTextColor="#ADADAD" keyboardType="decimal-pad" />
              </View>
            </View>

            {/* Serving size (optional) */}
            <Text style={s.fieldLabel}>Serving size</Text>
            <TextInput
              style={s.input} value={serving} onChangeText={setServing}
              placeholder="e.g. 1 cup, 100g" placeholderTextColor="#ADADAD"
            />

            <Pressable style={[s.addBtn, !canAdd && s.addBtnDisabled]} onPress={handleAdd} disabled={!canAdd}>
              <Text style={s.addBtnLabel}>Add Food</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Barcode scanner — separate modal on top */}
      <BarcodeScannerModal
        visible={showBarcodeScanner}
        onResult={food => { setShowBarcodeScanner(false); applyScannedFood(food); }}
        onClose={() => setShowBarcodeScanner(false)}
      />
    </>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#EDEAE5' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 12,
    borderBottomWidth: 0.5, borderBottomColor: '#DDD9D4',
  },
  closeBtn:    { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  title:       { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 18, color: '#0A0A0A' },
  scanBtns:    { flexDirection: 'row', gap: 4 },
  scanBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  banner:      {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#EDF7F2', borderBottomWidth: 0.5, borderBottomColor: '#C8E8D6',
    paddingHorizontal: 20, paddingVertical: 8,
  },
  bannerText:  { flex: 1, fontSize: 12, color: '#1A6B40' },
  bannerName:  { fontWeight: '600' },

  scanCTA:     {
    flexDirection: 'row', marginTop: 14,
    backgroundColor: '#FFFFFF', borderRadius: 10,
    borderWidth: 0.5, borderColor: '#DDD9D4', overflow: 'hidden',
  },
  scanCTABtn:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  scanCTALabel:{ fontSize: 13, fontWeight: '500', color: '#D93518' },
  scanDivider: { width: 0.5, backgroundColor: '#DDD9D4' },

  content:     { paddingHorizontal: 20, paddingBottom: 60, gap: 4 },
  sectionLabel:{ fontSize: 10, color: '#ADADAD', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 14, marginBottom: 6 },
  mealRow:     { flexDirection: 'row', gap: 6, marginTop: 14, marginBottom: 4 },
  mealBtn:     { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#DDD9D4', alignItems: 'center', gap: 2 },
  mealBtnActive:  { backgroundColor: '#0A0A0A', borderColor: '#0A0A0A' },
  mealLabel:      { fontSize: 9, color: '#6B6B6B' },
  mealLabelActive:{ color: '#fff' },
  chips:       { flexGrow: 0 },
  chipsContent:{ flexDirection: 'row', gap: 6 },
  chip:        { backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 0.5, borderColor: '#DDD9D4', paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', gap: 2 },
  chipName:    { fontWeight: '500', fontSize: 11, color: '#0A0A0A' },
  chipKcal:    { fontSize: 9, color: '#ADADAD' },
  fieldLabel:  { fontSize: 10, color: '#ADADAD', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 10, marginBottom: 4 },
  input:       { backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 0.5, borderColor: '#DDD9D4', paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#0A0A0A' },
  row:         { flexDirection: 'row', gap: 8, marginTop: 4 },
  addBtn:      { backgroundColor: '#0A0A0A', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  addBtnDisabled: { opacity: 0.4 },
  addBtnLabel: { fontWeight: '600', fontSize: 14, color: '#fff', letterSpacing: 1 },
});
