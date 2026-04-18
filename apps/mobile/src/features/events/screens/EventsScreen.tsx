import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, SafeAreaView, Platform, ActivityIndicator, RefreshControl, ScrollView, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { Calendar, Clock, MapPin, Users, Share2, Bookmark, X, Check, Activity } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEvents } from '../hooks/useEvents';
import { EventCard } from '../components/EventCard';
import type { RunEvent } from '../types';
import { CATEGORY_EMOJI } from '../types';
import { Colors } from '@theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type EventTab = 'upcoming' | 'challenges' | 'past';

const C = Colors;

const TABS: { id: EventTab; label: string }[] = [
  { id: 'upcoming',   label: 'Upcoming'   },
  { id: 'challenges', label: 'Challenges' },
  { id: 'past',       label: 'Past'       },
];

const CHALLENGE_CATEGORIES = new Set(['challenge', 'brand-challenge', 'king-of-hill', 'survival']);

function EventDetailSheet({ event, joined, onClose, onJoin }: {
  event: RunEvent;
  joined: boolean;
  onClose: () => void;
  onJoin: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [bookmarked, setBookmarked] = useState(false);
  const emoji = CATEGORY_EMOJI[event.category] ?? '📍';
  const categoryLabel = event.category.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={ed.backdrop} onPress={onClose} />
      <View style={[ed.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <View style={ed.handle} />

        {/* Header */}
        <View style={ed.sheetHeader}>
          <View style={ed.chips}>
            <View style={ed.chip}><Text style={ed.chipText}>{emoji} {categoryLabel}</Text></View>
            {event.distance && (
              <View style={[ed.chip, ed.chipDist, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                <Activity size={11} color={C.black} strokeWidth={1.5} />
                <Text style={[ed.chipText, { color: C.black }]}>{event.distance}</Text>
              </View>
            )}
          </View>
          <Pressable style={ed.closeBtn} onPress={onClose}>
            <X size={14} color={C.t2} strokeWidth={2} />
          </Pressable>
        </View>

        <Text style={ed.eventTitle}>{event.title}</Text>
        <Text style={ed.eventDesc}>{event.description}</Text>

        {/* Detail rows */}
        <View style={ed.detailCard}>
          {[
            { Icon: Calendar, label: 'DATE',     value: event.date },
            { Icon: Clock,    label: 'TIME',     value: event.time },
            { Icon: MapPin,   label: 'LOCATION', value: event.location },
            { Icon: Users,    label: 'JOINED',   value: `${event.participants} runners` },
          ].map(({ Icon, label, value }) => (
            <View key={label} style={ed.detailRow}>
              <View style={ed.detailIconBox}>
                <Icon size={14} color={C.t2} strokeWidth={1.5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ed.detailLabel}>{label}</Text>
                <Text style={ed.detailValue}>{value}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Organizer row */}
        {event.organizer && (
          <View style={ed.organizerRow}>
            <View style={[ed.orgAvatar, { backgroundColor: '#D93518' }]}>
              <Text style={ed.orgAvatarText}>{event.organizer.slice(0, 1).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={ed.orgLabel}>ORGANIZER</Text>
              <Text style={ed.orgName}>{event.organizer}</Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={ed.footer}>
          <Pressable style={ed.iconBtn} onPress={() => {}}>
            <Share2 size={18} color={C.black} strokeWidth={1.5} />
          </Pressable>
          <Pressable
            style={[ed.iconBtn, bookmarked && ed.iconBtnActive]}
            onPress={() => setBookmarked(b => !b)}
          >
            <Bookmark size={18} color={bookmarked ? C.white : C.black} strokeWidth={1.5} fill={bookmarked ? C.red : 'transparent'} />
          </Pressable>
          <Pressable style={[ed.joinBtn, joined && ed.joinBtnJoined]} onPress={() => { onJoin(); onClose(); }}>
            {joined ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Check size={14} color="#1A6B40" strokeWidth={2} />
                <Text style={[ed.joinLabel, ed.joinLabelJoined]}>Joined</Text>
              </View>
            ) : (
              <Text style={ed.joinLabel}>Join Event</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const ed = StyleSheet.create({
  backdrop:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet:        { backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, maxHeight: '88%' },
  handle:       { width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetHeader:  { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  chips:        { flexDirection: 'row', gap: 6, flexWrap: 'wrap', flex: 1 },
  chip:         { backgroundColor: '#FEF0EE', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  chipDist:     { backgroundColor: C.stone },
  chipText:     { fontFamily: 'Barlow_400Regular', fontSize: 11, color: C.red },
  closeBtn:     { width: 28, height: 28, borderRadius: 14, backgroundColor: C.stone, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 8 },
  closeBtnText: { fontFamily: 'Barlow_400Regular', fontSize: 12, color: C.t2 },
  eventTitle:   { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 22, color: C.black, marginBottom: 8, lineHeight: 28 },
  eventDesc:    { fontFamily: 'Barlow_300Light', fontSize: 13, color: C.t2, lineHeight: 21, marginBottom: 16 },
  detailCard:   { backgroundColor: C.stone, borderRadius: 14, padding: 4, marginBottom: 20 },
  detailRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
  detailIconBox:{ width: 30, height: 30, borderRadius: 8, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  detailLabel:  { fontFamily: 'Barlow_500Medium', fontSize: 9, letterSpacing: 0.8, color: C.t3, textTransform: 'uppercase' },
  detailValue:  { fontFamily: 'Barlow_400Regular', fontSize: 13, color: C.black, marginTop: 1 },
  organizerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  orgAvatar:    { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  orgAvatarText:{ fontFamily: 'Barlow_700Bold', fontSize: 12, color: '#FFFFFF' },
  orgLabel:     { fontFamily: 'Barlow_500Medium', fontSize: 9, color: '#ADADAD', letterSpacing: 0.8, textTransform: 'uppercase' },
  orgName:      { fontFamily: 'Barlow_500Medium', fontSize: 13, color: '#0A0A0A', marginTop: 1 },
  footer:       { flexDirection: 'row', gap: 8, alignItems: 'center' },
  iconBtn:      { width: 48, height: 48, borderRadius: 12, backgroundColor: C.stone, borderWidth: 0.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconBtnActive:{ backgroundColor: C.red, borderColor: C.red },
  joinBtn:      { flex: 1, height: 48, borderRadius: 12, backgroundColor: C.black, alignItems: 'center', justifyContent: 'center' },
  joinBtnJoined:{ backgroundColor: '#EDF7F2', borderWidth: 0.5, borderColor: '#A3D9B1' },
  joinLabel:    { fontFamily: 'Barlow_600SemiBold', fontSize: 14, color: C.white, letterSpacing: 0.3 },
  joinLabelJoined: { color: '#1A6B40' },
});

export default function EventsScreen() {
  const navigation = useNavigation<Nav>();
  const { events, joinedIds, canCreate, loading, refreshing, handleJoin, refresh } = useEvents();
  const [activeTab, setActiveTab] = useState<EventTab>('upcoming');
  const [selectedEvent, setSelectedEvent] = useState<RunEvent | null>(null);

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
              onPress={() => setSelectedEvent(item)}
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

      {selectedEvent && (
        <EventDetailSheet
          event={selectedEvent}
          joined={joinedIds.has(selectedEvent.id)}
          onClose={() => setSelectedEvent(null)}
          onJoin={() => { handleJoin(selectedEvent.id); setSelectedEvent(null); }}
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
