import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, SafeAreaView,
  Platform, ActivityIndicator, RefreshControl, Alert, Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useShoeTracker } from '@features/gear/hooks/useShoeTracker';
import { ShoeCard } from '@features/gear/components/ShoeCard';
import type { StoredShoe } from '@shared/services/store';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function GearScreen() {
  const navigation = useNavigation<Nav>();
  const { shoes, shoeKm, loading, refreshing, refresh, setDefault, retire, deleteShoe } = useShoeTracker();
  const activeShoes  = shoes.filter(s => !s.isRetired);
  const retiredShoes = shoes.filter(s => s.isRetired);
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
          <Text style={s.backText}>←</Text>
        </Pressable>
        <Text style={s.title}>Gear</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={() => navigation.navigate('FootScan')} style={[s.addBtn, { backgroundColor: '#5A3A8A' }]}>
            <Text style={s.addLabel}>🦶</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('GearAdd')} style={s.addBtn}>
            <Text style={s.addLabel}>+</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#D93518" />
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#D93518" />}
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

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EDEAE5' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 12,
  },
  backBtn: { width: 32 },
  backText: { fontFamily: 'Barlow_400Regular', fontSize: 18, color: '#6B6B6B' },
  title: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 20, color: '#0A0A0A' },
  addBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center' },
  addLabel: { fontFamily: 'Barlow_400Regular', fontSize: 20, color: '#fff', lineHeight: 22 },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100, gap: 10 },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 18, color: '#0A0A0A', marginBottom: 6 },
  emptyText: { fontFamily: 'Barlow_300Light', fontSize: 12, color: '#6B6B6B', textAlign: 'center', marginBottom: 16 },
  emptyBtn: { backgroundColor: '#0A0A0A', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnLabel: { fontFamily: 'Barlow_500Medium', fontSize: 12, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionLabel: { fontFamily: 'Barlow_300Light', fontSize: 10, color: '#ADADAD', textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 8, marginBottom: 4, paddingLeft: 4 },
  toast: {
    position: 'absolute', bottom: 36, left: 20, right: 20,
    backgroundColor: '#0A0A0A', borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16,
  },
  toastText: { fontFamily: 'Barlow_400Regular', fontSize: 13, color: '#fff', textAlign: 'center' },
});
