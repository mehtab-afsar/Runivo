import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Modal, View, Text, TextInput, Pressable, ScrollView, StyleSheet, Platform, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from '@theme/hapticsGated';
import { X, Barcode, Camera, CheckCircle } from 'phosphor-react-native';
import { useTheme, Type, Fonts, type AppColors } from '@theme';
import type { NutritionEntry } from '@shared/services/store';
import type { Meal } from '@features/nutrition/types';
import { MEALS } from '@features/nutrition/types';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { scanFoodPhoto, type ScannedFood } from '@features/nutrition/services/foodScanService';
import { fetchRecentFoods } from '@features/nutrition/services/nutritionService';

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
  editingEntry?: NutritionEntry | null;
  onAdd:    (entry: Omit<NutritionEntry, 'id' | 'date' | 'loggedAt' | 'xpAwarded'>) => void;
  onUpdate?: (id: number, entry: Omit<NutritionEntry, 'id' | 'date' | 'loggedAt' | 'xpAwarded' | 'synced' | 'remoteId'>) => void;
  onClose:  () => void;
}

export function AddFoodModal({ visible, defaultMeal, editingEntry, onAdd, onUpdate, onClose }: AddFoodModalProps) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const isEditing = !!editingEntry;
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
  const [recentFoods,        setRecentFoods]        = useState<NutritionEntry[]>([]);

  const submittingRef = useRef(false);

  useEffect(() => { setMeal(defaultMeal); }, [defaultMeal]);

  useEffect(() => {
    if (visible) fetchRecentFoods().then(setRecentFoods);
  }, [visible]);

  // Prefill the form when opened to edit an existing entry
  useEffect(() => {
    if (visible && editingEntry) {
      setName(editingEntry.name);
      setKcal(String(editingEntry.kcal));
      setProtein(String(editingEntry.proteinG));
      setCarbs(String(editingEntry.carbsG));
      setFat(String(editingEntry.fatG));
      setServing(editingEntry.servingSize);
      setMeal(editingEntry.meal);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, editingEntry?.id]);

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

  // Quick-add and recent foods are known-good, previously-confirmed values —
  // logging them is one tap, no review step. Scanned foods (barcode/photo)
  // still land in the form for a look before saving, since OCR/vision can
  // misread a product. While editing an existing entry there's no "tap to
  // log a new one" — these fill the form instead, same as a scan would.
  function logQuickAdd(q: typeof QUICK_ADDS[0]) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isEditing) {
      setName(q.name); setKcal(String(q.kcal));
      setProtein(String(q.protein)); setCarbs(String(q.carbs)); setFat(String(q.fat));
      return;
    }
    submitEntry({ name: q.name, kcal: q.kcal, proteinG: q.protein, carbsG: q.carbs, fatG: q.fat });
  }

  function logRecentFood(f: NutritionEntry) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isEditing) {
      setName(f.name); setKcal(String(f.kcal));
      setProtein(String(f.proteinG)); setCarbs(String(f.carbsG)); setFat(String(f.fatG));
      setServing(f.servingSize);
      return;
    }
    submitEntry({
      name: f.name, kcal: f.kcal, proteinG: f.proteinG, carbsG: f.carbsG, fatG: f.fatG,
      servingSize: f.servingSize,
    });
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

  // Guards double-tap: set on the first submit, only cleared by the
  // `!visible` cleanup effect below (i.e. once the modal has actually
  // closed) — not immediately after firing onAdd, which would leave a
  // window for a fast second tap to log the same entry twice.
  function submitEntry(item: {
    name: string; kcal: number; proteinG: number; carbsG: number; fatG: number; servingSize?: string;
  }) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    onAdd({
      meal,
      name:        item.name,
      kcal:        item.kcal,
      proteinG:    item.proteinG,
      carbsG:      item.carbsG,
      fatG:        item.fatG,
      servingSize: item.servingSize || '1 serving',
      source:      'manual',
      synced:      false,
    });
    onClose();
  }

  function handleAdd() {
    if (!canAdd || submittingRef.current) return;

    if (isEditing && editingEntry?.id !== undefined && onUpdate) {
      submittingRef.current = true;
      onUpdate(editingEntry.id, {
        meal,
        name:        name.trim(),
        kcal:        parseFloat(kcal)    || 0,
        proteinG:    parseFloat(protein) || 0,
        carbsG:      parseFloat(carbs)   || 0,
        fatG:        parseFloat(fat)     || 0,
        servingSize: serving || '1 serving',
        source:      editingEntry.source,
      });
      onClose();
      return;
    }

    submitEntry({
      name:        name.trim(),
      kcal:        parseFloat(kcal)    || 0,
      proteinG:    parseFloat(protein) || 0,
      carbsG:      parseFloat(carbs)   || 0,
      fatG:        parseFloat(fat)     || 0,
      servingSize: serving,
    });
  }

  function handleClose() { onClose(); }

  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
        <SafeAreaView style={s.root}>
          {/* Header */}
          <View style={s.header}>
            <Pressable onPress={handleClose} style={s.closeBtn} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <X size={16} color={C.t2} weight="regular" />
            </Pressable>
            <Text style={s.title}>{isEditing ? 'Edit Food' : 'Log Food'}</Text>
            <View style={s.scanBtns}>
              <Pressable
                style={s.scanBtn}
                onPress={() => setShowBarcodeScanner(true)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Scan barcode"
              >
                <Barcode size={20} color={C.t1} weight="regular" />
              </Pressable>
              <Pressable
                style={s.scanBtn}
                onPress={handlePhotoScan}
                disabled={photoScanning}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Scan food with camera"
              >
                {photoScanning
                  ? <ActivityIndicator size="small" color={C.red} />
                  : <Camera size={20} color={C.t1} weight="regular" />
                }
              </Pressable>
            </View>
          </View>

          {/* Scan result banner */}
          {scanBanner && (
            <View style={s.banner}>
              <CheckCircle size={14} color={C.green} weight="fill" />
              <Text style={s.bannerText} numberOfLines={1}>
                Found: <Text style={s.bannerName}>{scanBanner}</Text>
              </Text>
              <Pressable onPress={() => setScanBanner(null)} hitSlop={8}>
                <X size={12} color={C.t2} weight="regular" />
              </Pressable>
            </View>
          )}

          <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive">
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
                  <Barcode size={16} color={C.red} weight="regular" />
                  <Text style={s.scanCTALabel}>Scan barcode</Text>
                </Pressable>
                <View style={s.scanDivider} />
                <Pressable style={s.scanCTABtn} onPress={handlePhotoScan} disabled={photoScanning}>
                  {photoScanning
                    ? <ActivityIndicator size="small" color={C.red} />
                    : <Camera size={16} color={C.red} weight="regular" />
                  }
                  <Text style={s.scanCTALabel}>AI photo scan</Text>
                </Pressable>
              </View>
            )}

            {/* Recent foods — one tap to repeat something already logged */}
            {recentFoods.length > 0 && (
              <>
                <Text style={s.sectionLabel}>Recent</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chips} contentContainerStyle={s.chipsContent}>
                  {recentFoods.map(f => (
                    <Pressable key={f.name} style={s.chip} onPress={() => logRecentFood(f)}>
                      <Text style={s.chipName}>{f.name}</Text>
                      <Text style={s.chipKcal}>{f.kcal} kcal</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}

            {/* Quick-add chips */}
            <Text style={s.sectionLabel}>Quick add</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chips} contentContainerStyle={s.chipsContent}>
              {QUICK_ADDS.map(q => (
                <Pressable key={q.name} style={s.chip} onPress={() => logQuickAdd(q)}>
                  <Text style={s.chipName}>{q.name}</Text>
                  <Text style={s.chipKcal}>{q.kcal} kcal</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Food name */}
            <Text style={s.fieldLabel}>Food name *</Text>
            <TextInput
              style={s.input} value={name} onChangeText={v => { setName(v); if (scanBanner) setScanBanner(null); }}
              placeholder="e.g. Chicken breast" placeholderTextColor={C.t3}
            />

            {/* Calories */}
            <Text style={s.fieldLabel}>Calories *</Text>
            <TextInput
              style={s.input} value={kcal} onChangeText={setKcal}
              placeholder="300" placeholderTextColor={C.t3}
              keyboardType="decimal-pad"
            />

            {/* Macros row */}
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Protein (g)</Text>
                <TextInput style={s.input} value={protein} onChangeText={setProtein} placeholder="25" placeholderTextColor={C.t3} keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Carbs (g)</Text>
                <TextInput style={s.input} value={carbs} onChangeText={setCarbs} placeholder="30" placeholderTextColor={C.t3} keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Fat (g)</Text>
                <TextInput style={s.input} value={fat} onChangeText={setFat} placeholder="10" placeholderTextColor={C.t3} keyboardType="decimal-pad" />
              </View>
            </View>

            {/* Serving size (optional) */}
            <Text style={s.fieldLabel}>Serving size</Text>
            <TextInput
              style={s.input} value={serving} onChangeText={setServing}
              placeholder="e.g. 1 cup, 100g" placeholderTextColor={C.t3}
            />

            <Pressable style={[s.addBtn, !canAdd && s.addBtnDisabled]} onPress={handleAdd} disabled={!canAdd}>
              <Text style={s.addBtnLabel}>{isEditing ? 'Save Changes' : 'Add Food'}</Text>
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

function mkStyles(C: AppColors) { return StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.stone },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 12,
    borderBottomWidth: 0.5, borderBottomColor: C.border,
  },
  closeBtn:    { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  title:       { fontFamily: Fonts.semiBold, fontSize: 18, color: C.t1 },
  scanBtns:    { flexDirection: 'row', gap: 4 },
  scanBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  banner:      {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.greenBg, borderBottomWidth: 0.5, borderBottomColor: C.green,
    paddingHorizontal: 20, paddingVertical: 8,
  },
  bannerText:  { flex: 1, fontFamily: Fonts.regular, fontSize: 12, color: C.green },
  bannerName:  { fontFamily: Fonts.semiBold },

  scanCTA:     {
    flexDirection: 'row', marginTop: 14,
    backgroundColor: C.card, borderRadius: 10,
    borderWidth: 0.5, borderColor: C.border, overflow: 'hidden',
  },
  scanCTABtn:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  scanCTALabel:{ fontFamily: Fonts.medium, fontSize: 13, color: C.red },
  scanDivider: { width: 0.5, backgroundColor: C.border },

  content:     { paddingHorizontal: 20, paddingBottom: 60, gap: 4 },
  sectionLabel:{ ...Type.overline, color: C.t3, marginTop: 14, marginBottom: 6 },
  mealRow:     { flexDirection: 'row', gap: 6, marginTop: 14, marginBottom: 4 },
  mealBtn:     { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: C.card, borderWidth: 0.5, borderColor: C.border, alignItems: 'center', gap: 2 },
  mealBtnActive:  { backgroundColor: C.alwaysDark, borderColor: C.alwaysDark },
  mealLabel:      { fontFamily: Fonts.regular, fontSize: 11, color: C.t2 },
  mealLabelActive:{ color: C.alwaysLight },
  chips:       { flexGrow: 0 },
  chipsContent:{ flexDirection: 'row', gap: 6 },
  chip:        { backgroundColor: C.card, borderRadius: 8, borderWidth: 0.5, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', gap: 2 },
  chipName:    { fontFamily: Fonts.medium, fontSize: 11, color: C.t1 },
  chipKcal:    { fontFamily: Fonts.regular, fontSize: 11, color: C.t3 },
  fieldLabel:  { ...Type.overline, color: C.t3, marginTop: 10, marginBottom: 4 },
  input:       { backgroundColor: C.card, borderRadius: 10, borderWidth: 0.5, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 12, fontFamily: Fonts.regular, fontSize: 14, color: C.t1 },
  row:         { flexDirection: 'row', gap: 8, marginTop: 4 },
  addBtn:      { backgroundColor: C.alwaysDark, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  addBtnDisabled: { opacity: 0.4 },
  addBtnLabel: { fontFamily: Fonts.semiBold, fontSize: 14, color: C.alwaysLight },
}); }
