import React from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, SafeAreaView, Platform, ActivityIndicator, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useEvents } from '../hooks/useEvents';
import { EventCard } from '../components/EventCard';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const C = { bg: '#EDEAE5', black: '#0A0A0A', t2: '#6B6B6B', red: '#D93518' };

export default function EventsScreen() {
  const navigation = useNavigation<Nav>();
  const { events, joinedIds, canCreate, loading, refreshing, handleJoin, refresh } = useEvents();

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </Pressable>
        <Text style={s.title}>Events</Text>
        {canCreate ? (
          <Pressable onPress={() => navigation.navigate('CreateEvent')} style={s.createBtn}>
            <Text style={s.createLabel}>+</Text>
          </Pressable>
        ) : (
          <View style={{ width: 32 }} />
        )}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.red} />
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={e => e.id}
          renderItem={({ item }) => (
            <EventCard
              event={item}
              joined={joinedIds.has(item.id)}
              onJoin={() => handleJoin(item.id)}
            />
          )}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.red} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyTitle}>No events yet</Text>
              <Text style={s.emptyText}>Check back soon for upcoming community events.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 12 },
  backBtn: { width: 32 },
  backText: { fontFamily: 'Barlow_400Regular', fontSize: 18, color: C.t2 },
  title: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 20, color: C.black },
  createBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: C.black, alignItems: 'center', justifyContent: 'center' },
  createLabel: { fontFamily: 'Barlow_400Regular', fontSize: 20, color: '#fff', lineHeight: 22 },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100, gap: 10 },
  empty: { alignItems: 'center' as const, paddingVertical: 48 },
  emptyTitle: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 18, color: C.black, marginBottom: 6 },
  emptyText: { fontFamily: 'Barlow_300Light', fontSize: 12, color: C.t2, textAlign: 'center' },
});
