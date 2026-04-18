import React, { useState } from 'react';
import {
  View, Text, Pressable, Image, ScrollView, ActivityIndicator,
  StyleSheet, SafeAreaView, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Camera, RefreshCw, CheckCircle } from 'lucide-react-native';
import { analyseFootImage, ARCH_INFO, type FootScanResult } from '../services/footScanService';
import { Colors } from '@theme';

type Step = 'instructions' | 'preview' | 'analysing' | 'result';

const C = Colors;

export default function FootScanScreen() {
  const navigation = useNavigation();
  const [step, setStep]     = useState<Step>('instructions');
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult]   = useState<FootScanResult | null>(null);
  const [error, setError]     = useState<string | null>(null);

  const capture = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera access needed', 'Enable camera in Settings to scan your foot.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      allowsEditing: true, aspect: [3, 4], quality: 0.8,
    });
    if (res.canceled || !res.assets[0]) return;

    const uri = res.assets[0].uri;
    setPreview(uri);
    setError(null);
    setStep('analysing');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const scan = await analyseFootImage(uri);
      setResult(scan);
      setStep('result');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setError(e.message ?? 'Analysis failed');
      setStep('preview');
    }
  };

  const reset = () => { setStep('instructions'); setPreview(null); setResult(null); setError(null); };

  const archInfo = result ? ARCH_INFO[result.archType] : null;

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.back}>
          <ArrowLeft size={18} color={C.black} strokeWidth={1.5} />
        </Pressable>
        <Text style={s.title}>Foot Scan</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {step === 'instructions' && (
          <View style={s.section}>
            <Text style={s.emoji}>🦶</Text>
            <Text style={s.heading}>Analyse your arch type</Text>
            <Text style={s.body}>Place your foot flat on a light-coloured floor and take a photo from directly above. Keep the whole foot in frame.</Text>
            <Pressable style={s.primaryBtn} onPress={capture}>
              <Camera size={18} color={C.white} strokeWidth={1.5} />
              <Text style={s.primaryBtnText}>Open Camera</Text>
            </Pressable>
          </View>
        )}

        {(step === 'preview' || step === 'analysing') && preview && (
          <View style={s.section}>
            <Image source={{ uri: preview }} style={s.preview} />
            {step === 'analysing' && (
              <View style={s.analysingRow}>
                <ActivityIndicator color={C.purple} />
                <Text style={s.analysingText}>Analysing with AI…</Text>
              </View>
            )}
            {error && <Text style={s.errorText}>{error}</Text>}
            {step === 'preview' && (
              <Pressable style={s.secondaryBtn} onPress={reset}>
                <RefreshCw size={16} color={C.black} strokeWidth={1.5} />
                <Text style={s.secondaryBtnText}>Try again</Text>
              </Pressable>
            )}
          </View>
        )}

        {step === 'result' && result && archInfo && (
          <View style={s.section}>
            {preview && <Image source={{ uri: preview }} style={s.preview} />}
            <View style={[s.resultCard, { backgroundColor: C.greenLo }]}>
              <View style={s.resultHeader}>
                <CheckCircle size={20} color={C.green} strokeWidth={1.5} />
                <Text style={[s.resultTitle, { color: C.green }]}>
                  {archInfo.emoji} {archInfo.label} · {result.confidence}% confidence
                </Text>
              </View>
              <Text style={s.resultBody}>{result.explanation}</Text>
            </View>
            <View style={[s.resultCard, { backgroundColor: '#F3EEFF' }]}>
              <Text style={[s.resultLabel, { color: C.purple }]}>Shoe recommendation</Text>
              <Text style={s.resultBody}>{result.shoeRecommendation}</Text>
            </View>
            <Pressable style={s.secondaryBtn} onPress={reset}>
              <RefreshCw size={16} color={C.black} strokeWidth={1.5} />
              <Text style={s.secondaryBtnText}>Scan again</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 8 },
  back:    { width: 36, height: 36, borderRadius: 8, backgroundColor: C.white, borderWidth: 0.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  title:   { fontFamily: 'Barlow_600SemiBold', fontSize: 16, color: C.black },
  scroll:  { padding: 16, paddingTop: 8 },
  section: { alignItems: 'center', gap: 16 },
  emoji:   { fontSize: 56, marginTop: 24 },
  heading: { fontFamily: 'Barlow_600SemiBold', fontSize: 20, color: C.black, textAlign: 'center' },
  body:    { fontFamily: 'Barlow_300Light', fontSize: 14, color: C.mid, textAlign: 'center', lineHeight: 22, maxWidth: 300 },
  preview: { width: '100%', aspectRatio: 3 / 4, borderRadius: 12, marginVertical: 8 },
  analysingRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  analysingText:   { fontFamily: 'Barlow_400Regular', fontSize: 14, color: C.mid },
  errorText:       { fontFamily: 'Barlow_400Regular', fontSize: 13, color: C.red, textAlign: 'center' },
  primaryBtn:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.black, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12, marginTop: 8 },
  primaryBtnText:  { fontFamily: 'Barlow_600SemiBold', fontSize: 14, color: C.white },
  secondaryBtn:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.white, borderWidth: 0.5, borderColor: C.border, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  secondaryBtnText:{ fontFamily: 'Barlow_400Regular', fontSize: 14, color: C.black },
  resultCard:      { width: '100%', borderRadius: 12, padding: 16, gap: 8 },
  resultHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultTitle:     { fontFamily: 'Barlow_600SemiBold', fontSize: 14, flex: 1 },
  resultLabel:     { fontFamily: 'Barlow_600SemiBold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 },
  resultBody:      { fontFamily: 'Barlow_300Light', fontSize: 13, color: C.black, lineHeight: 20 },
});
