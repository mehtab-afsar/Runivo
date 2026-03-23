import React from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, SafeAreaView,
  Platform, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useClubs } from '@features/clubs/hooks/useClubs';
import { ClubCard } from '@features/clubs/components/ClubCard';
import { SearchBar } from '@features/clubs/components/SearchBar';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const C = { bg: '#EDEAE5', black: '#0A0A0A', t2: '#6B6B6B', red: '#D93518' };

export default function ClubScreen() {
  const navigation = useNavigation<Nav>();
  const { filteredClubs, loading, refreshing, searchQuery, setSearchQuery, joinClub, leaveClub, refresh } = useClubs();

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </Pressable>
        <Text style={s.title}>Clubs</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={s.searchWrap}>
        <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search clubs..." />
      </View>

      {loading ? (
        <View style={s.loader}>
          <ActivityIndicator color={C.red} />
        </View>
      ) : (
        <FlatList
          data={filteredClubs}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <ClubCard club={item} onJoin={() => joinClub(item)} onLeave={() => leaveClub(item)} />
          )}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.red} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyTitle}>No clubs found</Text>
              <Text style={s.emptyText}>Try a different search or check back soon.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 12,
  },
  backBtn: { width: 32 },
  backText: { fontFamily: 'Barlow_400Regular', fontSize: 18, color: C.t2 },
  title: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 20, color: C.black },
  searchWrap: { paddingHorizontal: 16, marginBottom: 8 },
  list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 100, gap: 8 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 18, color: C.black, marginBottom: 6 },
  emptyText: { fontFamily: 'Barlow_300Light', fontSize: 12, color: C.t2, textAlign: 'center' },
});
