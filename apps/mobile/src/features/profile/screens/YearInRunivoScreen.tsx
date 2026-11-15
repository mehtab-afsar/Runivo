/**
 * Year in Runivo (PRD P6): your year in distance, zones and steals, with a
 * share card (PNG at story size).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { ArrowLeft, ShareNetwork } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { getPlayer } from '@shared/services/store';
import { PngCapture, type PngCaptureHandle } from '@features/run/components/PngCapture';
import { fetchYear, type YearStats } from '../services/yearService';
import { buildYearSvg, yearHighlights } from '../utils/yearCard';

export default function YearInRunivoScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation();
  const year = useRoute<RouteProp<RootStackParamList, 'YearInRunivo'>>().params?.year ?? new Date().getFullYear();
  const [stats, setStats] = useState<YearStats | null | undefined>(undefined);
  const [name, setName] = useState('');
  const [sharing, setSharing] = useState(false);
  const captureRef = useRef<PngCaptureHandle>(null);

  useEffect(() => {
    fetchYear(year).then(setStats).catch(() => setStats(null));
    getPlayer().then(p => setName(p?.username ?? 'My')).catch(() => {});
  }, [year]);

  const share = async () => {
    if (!stats || !captureRef.current) return;
    setSharing(true);
    try {
      const b64 = await captureRef.current.capture(buildYearSvg(stats, name), { viewWidth: 400, viewHeight: 700, outWidth: 1080, outHeight: 1890 });
      const uri = `${FileSystem.cacheDirectory}runivo-${year}.png`;
      await FileSystem.writeAsStringAsync(uri, b64, { encoding: FileSystem.EncodingType.Base64 });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: `My ${year} in Runivo` });
    } catch {
      Alert.alert("Couldn't make the card", 'Try again.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Back">
          <ArrowLeft size={16} color={C.t1} weight="regular" />
        </Pressable>
        <Text style={s.title}>{year} in Runivo</Text>
        <View style={{ width: 32 }} />
      </View>

      {stats === undefined ? (
        <View style={s.center}><ActivityIndicator color={C.t2} /></View>
      ) : !stats || stats.activities === 0 ? (
        <View style={s.center}><Text style={s.empty}>No activities in {year} yet. Your year fills in as you run.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll}>
          <View style={s.hero}>
            <Text style={s.heroYear}>{year}</Text>
            <Text style={s.heroKm}>{Math.round(stats.km).toLocaleString('en')} km</Text>
            <Text style={s.heroSub}>{stats.activities} activities on {stats.activeDays} days · longest {stats.longestKm} km</Text>
          </View>
          <View style={s.card}>
            {yearHighlights(stats).slice(1).map((r, i) => (
              <View key={r.label} style={[s.row, i > 0 && s.rowBorder]}>
                <Text style={s.label}>{r.label}</Text>
                <Text style={s.value} numberOfLines={1}>{r.value}</Text>
              </View>
            ))}
            {stats.timesStolenFrom > 0 && (
              <View style={[s.row, s.rowBorder]}>
                <Text style={s.label}>Zones taken from you</Text>
                <Text style={s.value}>{stats.timesStolenFrom}</Text>
              </View>
            )}
          </View>
          <Pressable style={s.share} onPress={share} disabled={sharing} accessibilityRole="button">
            {sharing ? <ActivityIndicator color={C.alwaysLight} /> : <ShareNetwork size={18} color={C.alwaysLight} weight="bold" />}
            <Text style={s.shareTxt}>Share your year</Text>
          </Pressable>
        </ScrollView>
      )}
      <PngCapture ref={captureRef} />
    </SafeAreaView>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:    { flex: 1, backgroundColor: C.bg },
    header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 12 },
    backBtn: { width: 32, height: 32, borderRadius: 22, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
    title:   { fontFamily: Fonts.semiBold, fontSize: 17, color: C.t1 },
    center:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    empty:   { fontFamily: Fonts.regular, fontSize: 14, color: C.t2, textAlign: 'center' },
    scroll:  { paddingHorizontal: 18, paddingBottom: 40, gap: 12 },
    hero:    { backgroundColor: C.card, borderRadius: 22, padding: 20 },
    heroYear:{ fontFamily: Fonts.numeric, fontSize: 44, color: C.t1 },
    heroKm:  { fontFamily: Fonts.numeric, fontSize: 34, color: C.red, marginTop: 4 },
    heroSub: { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, marginTop: 6 },
    card:    { backgroundColor: C.card, borderRadius: 22, paddingHorizontal: 16 },
    row:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, gap: 12 },
    rowBorder: { borderTopWidth: 1, borderTopColor: C.border },
    label:   { fontFamily: Fonts.regular, fontSize: 14, color: C.t2 },
    value:   { fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1, flexShrink: 1, textAlign: 'right' },
    share:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 14, backgroundColor: C.red, marginTop: 4 },
    shareTxt:{ fontFamily: Fonts.semiBold, fontSize: 16, color: C.alwaysLight },
  });
}
