import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, SafeAreaView, Platform, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useEvents } from '../hooks/useEvents';
import { EventCard } from '../components/EventCard';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type EventTab = 'upcoming' | 'challenges' | 'past';

const C = { bg: '#EDEAE5', black: '#0A0A0A', t2: '#6B6B6B', t3: '#ADADAD', red: '#D93518', white: '#FFFFFF', border: '#DDD9D4', stone: '#F0EDE8' };

const TABS: { id: EventTab; label: string }[] = [
  { id: 'upcoming',   label: 'Upcoming'   },
  { id: 'challenges', label: 'Challenges' },
  { id: 'past',       label: 'Past'       },
];

const CHALLENGE_CATEGORIES = new Set(['challenge', 'brand-challenge', 'king-of-hill', 'survival']);

export default function EventsScreen() {
  const navigation = useNavigation<Nav>();
  const { events, joinedIds, canCreate, loading, refreshing, handleJoin, refresh } = useEvents();
  const [activeTab, setActiveTab] = useState<EventTab>('upcoming');

  const now = new Date();

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      const eventDate = new Date(e.date);
      const isPast = eventDate < now;
      const isChallenge = CHALLENGE_CATEGORIES.has(e.category);

      if (activeTab === 'past')       return isPast;
      if (activeTab === 'challenges') return !isPast && isChallenge;
      return !isPast && !isChallenge; // upcoming = non-challenge future events
    });
  }, [events, activeTab, now]);

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </Pressable>
        <View>
          <Text style={s.title}>Events</Text>
          <Text style={s.subtitle}>Races, meetups & challenges near you</Text>
        </View>
        {canCreate ? (
          <Pressable onPress={() => navigation.navigate('CreateEvent')} style={s.createBtn}>
            <Text style={s.createLabel}>+</Text>
          </Pressable>
        ) : (
          <View style={{ width: 32 }} />
        )}
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {TABS.map(tab => (
          <Pressable
            key={tab.id}
            style={[s.tab, activeTab === tab.id && s.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[s.tabLabel, activeTab === tab.id && s.tabLabelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.red} />
        </View>
      ) : (
        <FlatList
          data={filteredEvents}
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
              <Text style={s.emptyTitle}>
                {activeTab === 'past' ? 'No past events' : activeTab === 'challenges' ? 'No challenges' : 'No upcoming events'}
              </Text>
              <Text style={s.emptyText}>Check back soon for new events.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: C.bg },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 10 },
  backBtn:        { width: 32 },
  backText:       { fontFamily: 'Barlow_400Regular', fontSize: 18, color: C.t2 },
  title:          { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 20, color: C.black },
  subtitle:       { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.t3, marginTop: 1 },
  createBtn:      { width: 32, height: 32, borderRadius: 8, backgroundColor: C.black, alignItems: 'center', justifyContent: 'center' },
  createLabel:    { fontFamily: 'Barlow_400Regular', fontSize: 20, color: '#fff', lineHeight: 22 },
  // Tabs
  tabRow:         { flexDirection: 'row', backgroundColor: '#E8E4DF', borderRadius: 10, marginHorizontal: 20, marginBottom: 12, padding: 3, gap: 2 },
  tab:            { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  tabActive:      { backgroundColor: C.white, borderWidth: 0.5, borderColor: C.border },
  tabLabel:       { fontFamily: 'Barlow_400Regular', fontSize: 12, color: C.t2 },
  tabLabelActive: { fontFamily: 'Barlow_600SemiBold', fontSize: 12, color: C.black },
  // List
  list:           { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100, gap: 10 },
  empty:          { alignItems: 'center' as const, paddingVertical: 48 },
  emptyTitle:     { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 18, color: C.black, marginBottom: 6 },
  emptyText:      { fontFamily: 'Barlow_300Light', fontSize: 12, color: C.t2, textAlign: 'center' },
});
