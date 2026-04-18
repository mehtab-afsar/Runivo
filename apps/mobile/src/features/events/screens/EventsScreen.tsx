import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, SafeAreaView, Platform, ActivityIndicator, RefreshControl, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { Calendar, Clock, MapPin, Users, Share2, Bookmark, X, Check, Plus, ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEvents } from '../hooks/useEvents';
import { EventCard } from '../components/EventCard';
import type { RunEvent } from '../types';
import { useTheme, type AppColors } from '@theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type EventTab = 'upcoming' | 'challenges' | 'past';

const TABS: { id: EventTab; label: string }[] = [
  { id: 'upcoming',   label: 'Upcoming'   },
  { id: 'challenges', label: 'Challenges' },
  { id: 'past',       label: 'Past'       },
];

const CHALLENGE_CATEGORIES = new Set(['challenge', 'brand-challenge', 'king-of-hill', 'survival']);

function avatarColor(initial: string): string {
  const COLORS = ['#D93518', '#1A6B40', '#9E6800', '#1E4D8C', '#6B2D8C', '#8C2D1E', '#2D6B5C'];
  return COLORS[initial.charCodeAt(0) % COLORS.length];
}

function EventDetailSheet({ event, joined, onClose, onJoin }: {
  event: RunEvent;
  joined: boolean;
  onClose: () => void;
  onJoin: () => void;
}) {
  const C = useTheme();
  const ed = useMemo(() => mkEdStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const [bookmarked, setBookmarked] = useState(false);
  const categoryLabel = event.category.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={ed.backdrop} onPress={onClose} />
      <View style={[ed.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <View style={ed.handle} />

        {/* Header */}
        <View style={ed.sheetHeader}>
          <View style={ed.chips}>
            <Text style={ed.categoryText}>{categoryLabel}</Text>
            {event.distance && (
              <View style={ed.distPill}><Text style={ed.distPillText}>{event.distance}</Text></View>
            )}
          </View>
          <Pressable style={ed.closeBtn} onPress={onClose}>
            <X size={12} color={C.t2} strokeWidth={2} />
          </Pressable>
        </View>

        {/* Title + description */}
        <Text style={ed.eventTitle}>{event.title}</Text>
        {!!event.description && (
          <Text style={ed.eventDesc}>{event.description}</Text>
        )}

        {/* Detail rows */}
        <View style={ed.detailCard}>
          {[
            { Icon: Calendar, label: 'Date',     value: event.date },
            { Icon: Clock,    label: 'Time',     value: event.time },
            { Icon: MapPin,   label: 'Location', value: event.location },
            { Icon: Users,    label: 'Going',    value: `${event.participants.toLocaleString()} runners` },
          ].map(({ Icon, label, value }, i, arr) => (
            <View key={label} style={[ed.detailRow, i < arr.length - 1 && ed.detailRowBorder]}>
              <View style={ed.detailIconBox}>
                <Icon size={13} color={C.t2} strokeWidth={1.5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ed.detailLabel}>{label.toUpperCase()}</Text>
                <Text style={ed.detailValue}>{value}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Organizer */}
        {!!event.organizer && (
          <View style={ed.organizerRow}>
            <View style={[ed.orgAvatar, { backgroundColor: avatarColor(event.organizer.charAt(0)) }]}>
              <Text style={ed.orgAvatarText}>{event.organizer.charAt(0).toUpperCase()}</Text>
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
            <Share2 size={16} color={C.t2} strokeWidth={1.5} />
          </Pressable>
          <Pressable
            style={[ed.iconBtn, bookmarked && ed.iconBtnSaved]}
            onPress={() => setBookmarked(b => !b)}
          >
            <Bookmark size={16} color={bookmarked ? C.red : C.t2} fill={bookmarked ? C.red : 'none'} strokeWidth={1.5} />
          </Pressable>
          <Pressable
            style={[ed.joinBtn, joined && ed.joinBtnJoined]}
            onPress={() => { onJoin(); onClose(); }}
          >
            {joined
              ? <><Check size={15} color={C.green} strokeWidth={2} /><Text style={[ed.joinLabel, ed.joinLabelJoined]}>Joined</Text></>
              : <Text style={ed.joinLabel}>Join Event</Text>}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function mkEdStyles(C: AppColors) {
  return StyleSheet.create({
    backdrop:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    sheet:           { backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, maxHeight: '88%' as any },
    handle:          { width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
    sheetHeader:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 },
    chips:           { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, flexWrap: 'wrap' },
    categoryText:    { fontFamily: 'Barlow_400Regular', fontSize: 9, color: C.t3, textTransform: 'uppercase', letterSpacing: 1 },
    distPill:        { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: C.redLo },
    distPillText:    { fontFamily: 'Barlow_500Medium', fontSize: 9, color: C.red },
    closeBtn:        { width: 28, height: 28, borderRadius: 14, backgroundColor: C.mid, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 8 },
    eventTitle:      { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 22, color: C.black, marginBottom: 8, lineHeight: 28 },
    eventDesc:       { fontFamily: 'Barlow_300Light', fontSize: 13, color: C.t2, lineHeight: 22, marginBottom: 16 },
    detailCard:      { backgroundColor: C.white, borderRadius: 16, borderWidth: 0.5, borderColor: C.border, overflow: 'hidden', marginBottom: 20 },
    detailRow:       { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 13 },
    detailRowBorder: { borderBottomWidth: 0.5, borderBottomColor: C.mid },
    detailIconBox:   { width: 30, height: 30, borderRadius: 8, backgroundColor: C.stone, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    detailLabel:     { fontFamily: 'Barlow_400Regular', fontSize: 9, color: C.t3, letterSpacing: 0.8, marginBottom: 2 },
    detailValue:     { fontFamily: 'Barlow_400Regular', fontSize: 13, color: C.black },
    organizerRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
    orgAvatar:       { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    orgAvatarText:   { fontFamily: 'Barlow_700Bold', fontSize: 11, color: '#FFFFFF' },
    orgLabel:        { fontFamily: 'Barlow_400Regular', fontSize: 9, color: C.t3, letterSpacing: 0.8, marginBottom: 1 },
    orgName:         { fontFamily: 'Barlow_400Regular', fontSize: 13, color: C.black },
    footer:          { flexDirection: 'row', gap: 8, alignItems: 'center' },
    iconBtn:         { width: 48, height: 48, borderRadius: 14, backgroundColor: C.white, borderWidth: 0.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    iconBtnSaved:    { backgroundColor: C.redLo, borderColor: 'rgba(217,53,24,0.3)' },
    joinBtn:         { flex: 1, height: 48, borderRadius: 14, backgroundColor: C.black, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
    joinBtnJoined:   { backgroundColor: C.greenBg, borderWidth: 0.5, borderColor: 'rgba(26,107,64,0.25)' },
    joinLabel:       { fontFamily: 'Barlow_600SemiBold', fontSize: 14, color: C.white },
    joinLabelJoined: { color: C.green },
  });
}

export default function EventsScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
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
      return !isPast && !isChallenge;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, activeTab]);

  return (
    <SafeAreaView style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={8}>
          <ArrowLeft size={18} color={C.t2} strokeWidth={2} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Events</Text>
          <Text style={s.subtitle}>Races, meetups &amp; challenges near you</Text>
        </View>
        {canCreate ? (
          <Pressable onPress={() => navigation.navigate('CreateEvent')} style={s.createBtn}>
            <Plus size={14} color={C.white} strokeWidth={2.5} />
          </Pressable>
        ) : (
          <View style={{ width: 32 }} />
        )}
      </View>

      {/* Segmented tabs — matches web pill container */}
      <View style={s.tabContainer}>
        <View style={s.tabPill}>
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
              <Calendar size={32} color={C.t3} strokeWidth={1.5} />
              <Text style={s.emptyTitle}>
                {activeTab === 'past' ? 'No past events' : activeTab === 'challenges' ? 'No challenges' : 'No upcoming events'}
              </Text>
              <Text style={s.emptyText}>Check back soon for new events.</Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      {canCreate && (
        <Pressable
          style={[s.fab, { bottom: insets.bottom + 80 }]}
          onPress={() => navigation.navigate('CreateEvent')}
        >
          <Plus size={16} color={C.white} strokeWidth={2.5} />
        </Pressable>
      )}

      {selectedEvent && (
        <EventDetailSheet
          event={selectedEvent}
          joined={joinedIds.has(selectedEvent.id)}
          onClose={() => setSelectedEvent(null)}
          onJoin={() => handleJoin(selectedEvent.id)}
        />
      )}
    </SafeAreaView>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:           { flex: 1, backgroundColor: C.bg },
    header:         { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 18, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 12, backgroundColor: C.white, borderBottomWidth: 0.5, borderBottomColor: C.border },
    backBtn:        { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginRight: 4, marginTop: 2 },
    title:          { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 20, color: C.black },
    subtitle:       { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.t3, marginTop: 2 },
    createBtn:      { width: 32, height: 32, borderRadius: 8, backgroundColor: C.black, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
    // Segmented tabs
    tabContainer:   { backgroundColor: C.white, paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: C.border },
    tabPill:        { flexDirection: 'row', backgroundColor: C.bg, borderRadius: 20, padding: 3, gap: 2 },
    tab:            { flex: 1, paddingVertical: 6, borderRadius: 16, alignItems: 'center' },
    tabActive:      { backgroundColor: C.white, borderWidth: 0.5, borderColor: C.border },
    tabLabel:       { fontFamily: 'Barlow_400Regular', fontSize: 10, color: C.t3 },
    tabLabelActive: { fontFamily: 'Barlow_500Medium', color: C.black },
    // List
    list:           { paddingBottom: 120 },
    empty:          { alignItems: 'center' as const, paddingVertical: 56, paddingHorizontal: 18, gap: 8 },
    emptyTitle:     { fontFamily: 'Barlow_500Medium', fontSize: 13, color: C.black },
    emptyText:      { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t3, textAlign: 'center' },
    // FAB
    fab:            { position: 'absolute', right: 14, width: 40, height: 40, borderRadius: 20, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', shadowColor: C.red, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  });
}
