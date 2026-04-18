import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, SafeAreaView, Platform, KeyboardAvoidingView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useNutritionSetup } from '@features/nutrition/hooks/useNutritionSetup';
import { NutritionSetupForm } from '@features/nutrition/components/NutritionSetupForm';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function NutritionSetupScreen() {
  const navigation = useNavigation<Nav>();
  const {
    saving, goal, setGoal, activityLevel, setActivity,
    diet, setDiet, sex, setSex, ageStr, weightStr, heightStr,
    updateField, dailyKcal, macros, saveProfile,
  } = useNutritionSetup();

  const handleSave = async () => {
    const ok = await saveProfile();
    if (ok) navigation.navigate('CalorieTracker');
  };

  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={s.header}>
          <Pressable onPress={() => navigation.goBack()} style={s.back}>
            <Text style={s.backText}>←</Text>
          </Pressable>
          <Text style={s.title}>Nutrition Setup</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <NutritionSetupForm
            saving={saving}
            goal={goal} setGoal={setGoal}
            activityLevel={activityLevel} setActivity={v => setActivity(v as Parameters<typeof setActivity>[0])}
            diet={diet} setDiet={setDiet}
            sex={sex} setSex={setSex}
            ageStr={ageStr} weightStr={weightStr} heightStr={heightStr}
            updateField={updateField}
            dailyKcal={dailyKcal} macros={macros}
            onSave={handleSave}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EDEAE5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 12 },
  back: { width: 32 }, backText: { fontFamily: 'Barlow_400Regular', fontSize: 18, color: '#6B6B6B' },
  title: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 20, color: '#0A0A0A' },
  content: { paddingHorizontal: 20, paddingBottom: 60, gap: 4 },
});
