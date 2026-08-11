import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, SafeAreaView, Platform, ActivityIndicator, RefreshControl, Modal, Share, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { Calendar, Clock, MapPin, Users, ShareNetwork, Bookmark, X, Check, Plus, ArrowLeft, ArrowSquareOut, NavigationArrow } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEvents } from '../hooks/useEvents';
import { EventCard } from '../components/EventCard';
import { DISCIPLINE_LABEL, type RunEvent } from '../types';
import { useTheme, Fonts, Type, type AppColors } from '@theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

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
  const isCurated = event.source === 'curated';
  const categoryLabel = event.discipline
    ? DISCIPLINE_LABEL[event.discipline]
    : event.category.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const detailRows = [
    { Icon: Calendar, label: 'Date',     value: event.date },
    { Icon: Clock,    label: 'Time',     value: event.time },
    { Icon: MapPin,   label: 'Location', value: event.location },
    ...(isCurated ? [] : [{ Icon: Users, label: 'Going', value: `${event.participants.toLocaleString()} runners` }]),
  ];

  const handleShare = () => {
    Share.share({
      message: isCurated && event.registrationUrl
        ? `${event.title} — ${event.date}\n${event.registrationUrl}`
        : `${event.title} — ${event.date} at ${event.location}`,
    }).catch(() => {});
  };

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
            {isCurated && (
              <View style={ed.externalPill}>
                <ArrowSquareOut size={9} color={C.t3} weight="bold" />
                <Text style={ed.externalPillText}>{event.sourceName ?? 'External listing'}</Text>
              </View>
            )}
          </View>
          <Pressable style={ed.closeBtn} onPress={onClose}>
            <X size={12} color={C.t2} weight="regular" />
          </Pressable>
        </View>

        {/* Title + description */}
        <Text style={ed.eventTitle}>{event.title}</Text>
        {!!event.description && (
          <Text style={ed.eventDesc}>{event.description}</Text>
        )}

        {/* Detail rows */}
        <View style={ed.detailCard}>
          {detailRows.map(({ Icon, label, value }, i, arr) => (
            <View key={label} style={[ed.detailRow, i < arr.length - 1 && ed.detailRowBorder]}>
              <View style={ed.detailIconBox}>
                <Icon size={13} color={C.t2} weight="light" />
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

        {isCurated && (
          <Text style={ed.disclaimer}>
            Registration happens on the organizer's own site — Runivo isn't hosting this event.
          </Text>
        )}

        {/* Footer */}
        <View style={ed.footer}>
          <Pressable style={ed.iconBtn} onPress={handleShare}>
            <ShareNetwork size={16} color={C.t2} weight="light" />
          </Pressable>
          <Pressable
            style={[ed.iconBtn, bookmarked && ed.iconBtnSaved]}
            onPress={() => setBookmarked(b => !b)}
          >
            <Bookmark size={16} color={bookmarked ? C.red : C.t2} weight={bookmarked ? 'fill' : 'light'} />
          </Pressable>
          {isCurated ? (
            <Pressable
              style={ed.joinBtn}
              onPress={() => event.registrationUrl && Linking.openURL(event.registrationUrl)}
              disabled={!event.registrationUrl}
            >
              <Text style={ed.joinLabel}>Register</Text>
              <ArrowSquareOut size={14} color={C.alwaysLight} weight="bold" />
            </Pressable>
          ) : (
            <Pressable
              style={[ed.joinBtn, joined && ed.joinBtnJoined]}
              onPress={() => { onJoin(); onClose(); }}
            >
              {joined
                ? <><Check size={15} color={C.green} weight="regular" /><Text style={[ed.joinLabel, ed.joinLabelJoined]}>Joined</Text></>
                : <Text style={ed.joinLabel}>Join Event</Text>}
            </Pressable>
          )}
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
    categoryText:    { ...Type.overline, color: C.t3 },
    distPill:        { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: C.redLo },
    distPillText:    { fontFamily: Fonts.medium, fontSize: 10, color: C.red },
    externalPill:    { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: C.stone },
    externalPillText:{ fontFamily: Fonts.medium, fontSize: 10, color: C.t3 },
    closeBtn:        { width: 28, height: 28, borderRadius: 14, backgroundColor: C.mid, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 8 },
    eventTitle:      { ...Type.displaySm, color: C.black, marginBottom: 8 },
    eventDesc:       { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, lineHeight: 22, marginBottom: 16 },
    detailCard:      { backgroundColor: C.card, borderRadius: 16, borderWidth: 0.5, borderColor: C.border, overflow: 'hidden', marginBottom: 20 },
    detailRow:       { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 13 },
    detailRowBorder: { borderBottomWidth: 0.5, borderBottomColor: C.mid },
    detailIconBox:   { width: 30, height: 30, borderRadius: 8, backgroundColor: C.stone, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    detailLabel:     { fontFamily: Fonts.regular, fontSize: 10, color: C.t3, letterSpacing: 0.8, marginBottom: 2 },
    detailValue:     { fontFamily: Fonts.regular, fontSize: 13, color: C.black },
    organizerRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
    orgAvatar:       { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    orgAvatarText:   { fontFamily: Fonts.bold, fontSize: 11, color: C.white },
    orgLabel:        { fontFamily: Fonts.regular, fontSize: 10, color: C.t3, letterSpacing: 0.8, marginBottom: 1 },
    orgName:         { fontFamily: Fonts.regular, fontSize: 13, color: C.black },
    disclaimer:      { fontFamily: Fonts.regular, fontSize: 10.5, color: C.t3, lineHeight: 15, marginBottom: 14 },
    footer:          { flexDirection: 'row', gap: 8, alignItems: 'center' },
    iconBtn:         { width: 48, height: 48, borderRadius: 14, backgroundColor: C.card, borderWidth: 0.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    iconBtnSaved:    { backgroundColor: C.redLo, borderColor: 'rgba(217,53,24,0.3)' },
    joinBtn:         { flex: 1, height: 48, borderRadius: 14, backgroundColor: C.alwaysDark, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
    joinBtnJoined:   { backgroundColor: C.greenBg, borderWidth: 0.5, borderColor: 'rgba(26,107,64,0.25)' },
    joinLabel:       { fontFamily: Fonts.semiBold, fontSize: 14, color: C.alwaysLight },
    joinLabelJoined: { color: C.green },
  });
}

export default function EventsScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const {
    events, joinedIds, canCreate, loading, refreshing,
    nearMeAvailable, nearMeActive, toggleNearMe, handleJoin, refresh,
  } = useEvents();
  const [selectedEvent, setSelectedEvent] = useState<RunEvent | null>(null);

  // One list, upcoming only, sorted by date (already server-sorted) — no tabs,
  // no category taxonomy. What's happening next is the only question this
  // screen answers; a discipline label still shows on each card itself.
  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    return events.filter(e => new Date(e.startsAt).getTime() >= now);
  }, [events]);

  return (
    <SafeAreaView style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={8}>
          <ArrowLeft size={18} color={C.t2} weight="regular" />
        </Pressable>
        <Text style={s.title}>Events</Text>
        {canCreate ? (
          <Pressable onPress={() => navigation.navigate('CreateEvent')} style={s.createBtn}>
            <Plus size={14} color={C.white} weight="bold" />
          </Pressable>
        ) : (
          <View style={{ width: 32 }} />
        )}
      </View>

      {nearMeAvailable && (
        <View style={s.nearMeRow}>
          <Pressable style={[s.nearMePill, nearMeActive && s.nearMePillActive]} onPress={() => toggleNearMe()}>
            <NavigationArrow size={11} color={nearMeActive ? C.alwaysLight : C.t3} weight="fill" />
            <Text style={[s.nearMeText, nearMeActive && s.nearMeTextActive]}>Near me</Text>
          </Pressable>
        </View>
      )}

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.red} />
        </View>
      ) : (
        <FlatList
          data={upcomingEvents}
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
              <Calendar size={32} color={C.t3} weight="light" />
              <Text style={s.emptyTitle}>No upcoming events</Text>
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
          <Plus size={16} color={C.white} weight="bold" />
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
    header:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: Platform.OS === 'android' ? 14 : 4, paddingBottom: 16, backgroundColor: C.card, borderBottomWidth: 0.5, borderBottomColor: C.border },
    backBtn:        { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    title:          { flex: 1, textAlign: 'center', fontFamily: Fonts.semiBold, fontSize: 22, color: C.black },
    createBtn:      { width: 32, height: 32, borderRadius: 16, backgroundColor: C.alwaysDark, alignItems: 'center', justifyContent: 'center' },
    // Near-me — the one filter worth surfacing, everything else lives on the card itself
    nearMeRow:      { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 2, backgroundColor: C.bg },
    nearMePill:     { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, backgroundColor: C.card, borderWidth: 0.5, borderColor: C.border },
    nearMePillActive: { backgroundColor: C.alwaysDark, borderColor: C.alwaysDark },
    nearMeText:     { fontFamily: Fonts.medium, fontSize: 11.5, color: C.t3 },
    nearMeTextActive: { color: C.alwaysLight },
    // List
    list:           { paddingTop: 8, paddingBottom: 120 },
    empty:          { alignItems: 'center' as const, paddingVertical: 56, paddingHorizontal: 18, gap: 8 },
    emptyTitle:     { fontFamily: Fonts.medium, fontSize: 13, color: C.black },
    emptyText:      { fontFamily: Fonts.regular, fontSize: 11, color: C.t3, textAlign: 'center' },
    // FAB
    fab:            { position: 'absolute', right: 14, width: 40, height: 40, borderRadius: 20, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', shadowColor: C.red, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  });
}
