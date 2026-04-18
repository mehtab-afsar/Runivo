import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, SafeAreaView,
  Platform, ActivityIndicator, RefreshControl, Alert, Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { ArrowLeft, Plus, Footprints } from 'lucide-react-native';
import { useTheme, type AppColors } from '@theme';
import { useShoeTracker } from '@features/gear/hooks/useShoeTracker';
import { ShoeCard } from '@features/gear/components/ShoeCard';
import type { StoredShoe } from '@shared/services/store';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function GearScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const { shoes, shoeKm, loading, refreshing, refresh, setDefault, retire, deleteShoe } = useShoeTracker();
  const activeShoes  = shoes.filter(sh => !sh.isRetired);
  const retiredShoes = shoes.filter(sh => sh.isRetired);
  const [toast, setToast] = useState('');
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    toastOpacity.setValue(1);
    Animated.sequence([
      Animated.delay(2200),
      Animated.timing(toastOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [toastOpacity]);

  const handleRetire = useCallback(async (shoe: StoredShoe) => {
    await retire(shoe.id);
    const km = shoeKm[shoe.id] ?? 0;
    showToast(`${shoe.brand} ${shoe.model} · ${km.toFixed(0)}km · Well run.`);
  }, [retire, shoeKm, showToast]);

  const confirmDelete = (shoe: StoredShoe) => {
    Alert.alert('Delete shoe?', `Remove "${shoe.nickname || shoe.model}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteShoe(shoe.id) },
    ]);
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
          <ArrowLeft size={18} color={C.t2} strokeWidth={2} />
        </Pressable>
        <Text style={s.title}>Gear</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={() => navigation.navigate('FootScan')} style={[s.addBtn, { backgroundColor: C.purple }]}>
            <Footprints size={14} color="#fff" strokeWidth={1.5} />
          </Pressable>
          <Pressable onPress={() => navigation.navigate('GearAdd')} style={s.addBtn}>
            <Plus size={16} color="#fff" strokeWidth={2.5} />
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.red} />
        </View>
      ) : (
        <FlatList
          data={[
            ...activeShoes,
            ...(retiredShoes.length > 0 ? [{ id: '__retired_header__', isHeader: true } as any] : []),
            ...retiredShoes,
          ]}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            if (item.isHeader) {
              return <Text style={s.sectionLabel}>RETIRED</Text>;
            }
            return (
              <ShoeCard
                shoe={item}
                kmRun={shoeKm[item.id] ?? 0}
                onSetDefault={() => setDefault(item.id)}
                onRetire={() => handleRetire(item)}
                onDelete={() => confirmDelete(item)}
              />
            );
          }}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.red} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyTitle}>No shoes yet</Text>
              <Text style={s.emptyText}>Add your running shoes to track mileage.</Text>
              <Pressable style={s.emptyBtn} onPress={() => navigation.navigate('GearAdd')}>
                <Text style={s.emptyBtnLabel}>Add first shoe</Text>
              </Pressable>
            </View>
          }
        />
      )}
      {toast !== '' && (
        <Animated.View style={[s.toast, { opacity: toastOpacity }]}>
          <Text style={s.toastText}>{toast}</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:          { flex: 1, backgroundColor: C.stone },
    header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 12 },
    backBtn:       { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    title:         { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 20, color: C.black },
    addBtn:        { width: 32, height: 32, borderRadius: 8, backgroundColor: C.black, alignItems: 'center', justifyContent: 'center' },
    list:          { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100, gap: 10 },
    empty:         { alignItems: 'center', paddingVertical: 48 },
    emptyTitle:    { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 18, color: C.black, marginBottom: 6 },
    emptyText:     { fontFamily: 'Barlow_300Light', fontSize: 12, color: C.t2, textAlign: 'center', marginBottom: 16 },
    emptyBtn:      { backgroundColor: C.black, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
    emptyBtnLabel: { fontFamily: 'Barlow_500Medium', fontSize: 12, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 },
    sectionLabel:  { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.t3, textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 8, marginBottom: 4, paddingLeft: 4 },
    toast:         { position: 'absolute', bottom: 36, left: 20, right: 20, backgroundColor: C.black, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16 },
    toastText:     { fontFamily: 'Barlow_400Regular', fontSize: 13, color: '#fff', textAlign: 'center' },
  });
}
