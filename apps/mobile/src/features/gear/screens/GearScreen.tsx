import React, { useCallback, useMemo } from 'react';
import { appAlert } from '@mobile/shared/components/AppAlert';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { Plus } from 'phosphor-react-native';
import { useTheme, Type, Fonts, Spacing, type AppColors } from '@theme';
import { useShoeTracker } from '@features/gear/hooks/useShoeTracker';
import { ShoeCard } from '@features/gear/components/ShoeCard';
import type { StoredShoe } from '@shared/services/store';
import { useToast } from '@mobile/shared/hooks/useToast';
import { ScreenHeader } from '@mobile/shared/components/ScreenHeader';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function GearScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const { shoes, shoeKm, loading, refreshing, refresh, setDefault, retire, deleteShoe } = useShoeTracker();
  const activeShoes  = shoes.filter(sh => !sh.isRetired);
  const retiredShoes = shoes.filter(sh => sh.isRetired);
  const { showToast } = useToast();

  const handleRetire = useCallback(async (shoe: StoredShoe) => {
    await retire(shoe.id);
    const km = shoeKm[shoe.id] ?? 0;
    showToast({ message: `${shoe.brand} ${shoe.model} · ${km.toFixed(0)}km · Well run.`, type: 'success' });
  }, [retire, shoeKm, showToast]);

  const confirmDelete = (shoe: StoredShoe) => {
    appAlert('Delete shoe?', `Remove "${shoe.nickname || shoe.model}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteShoe(shoe.id) },
    ]);
  };

  return (
    <SafeAreaView style={s.root}>
      <ScreenHeader title="Gear" onBack={() => navigation.goBack()} right={<>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {/* V1.1 — foot scan
            <Pressable onPress={() => navigation.navigate('FootScan')} style={[s.addBtn, { backgroundColor: C.purple }]}>
              <Footprints size={14} color="#fff" strokeWidth={1.5} />
            </Pressable>
            */}
            <Pressable onPress={() => navigation.navigate('GearAdd')} style={s.addBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel="Add shoes">
              <Plus size={16} color={C.alwaysLight} weight="bold" />
            </Pressable>
          </View>
        </>} />

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
              return <Text style={s.sectionLabel}>Retired</Text>;
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
    </SafeAreaView>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:          { flex: 1, backgroundColor: C.stone },
    addBtn:        { width: 32, height: 32, borderRadius: 8, backgroundColor: C.alwaysDark, alignItems: 'center', justifyContent: 'center' },
    list:          { paddingHorizontal: Spacing.gutter, paddingTop: 8, paddingBottom: 100, gap: 10 },
    empty:         { alignItems: 'center', paddingVertical: 48 },
    emptyTitle:    { fontFamily: Fonts.semiBold, fontSize: 18, color: C.black, marginBottom: 6 },
    emptyText:     { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, textAlign: 'center', marginBottom: 16 },
    emptyBtn:      { backgroundColor: C.alwaysDark, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
    emptyBtnLabel: { fontFamily: Fonts.medium, fontSize: 12, color: C.alwaysLight, letterSpacing: 0.5 },
    sectionLabel:  { ...Type.overline, color: C.t3, marginTop: 8, marginBottom: 4, paddingLeft: 4 },
  });
}
