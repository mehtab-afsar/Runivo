import { ErrorState } from '@mobile/shared/components/ErrorState';
import React, { useEffect, useMemo, useState } from 'react';
import { canManageEvent, cancelEvent } from '@features/events/services/eventService';
import { View, Text, StyleSheet, FlatList, ScrollView, Pressable, ActivityIndicator, RefreshControl, Share, Linking, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { Calendar, Clock, MapPin, Users, ShareNetwork, Bookmark, X, Check, ArrowSquareOut, Flag } from 'phosphor-react-native';
import { PaceXOrb } from '@mobile/shared/components/PaceXOrb';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEvents } from '../hooks/useEvents';
import { EventExtras } from '../components/EventExtras';
import { EventCard } from '../components/EventCard';
import { DISCIPLINE_LABEL, type RunEvent } from '../types';
import { useTheme, Fonts, Type, type AppColors } from '@theme';
import { raceForKm } from '@shared/engine/training';
import { safeHttpUrl } from '@mobile/shared/lib/safeUrl';
import { promptReport } from '@mobile/shared/lib/promptReport';
import { canAddToCalendar, addEventToCalendar, hasEventReminder, setEventReminder } from '../services/eventCalendar';
import { ScreenHeader } from '@mobile/shared/components/ScreenHeader';
import { ModalSheet } from '@mobile/shared/components/ModalSheet';
import { Segmented } from '@mobile/shared/components/Segmented';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function avatarColor(initial: string): string {
  const COLORS = ['#4E7F1F', '#A85E06', '#3C3577', '#17181A', '#2F4D12', '#7A5525', '#7C72D8'];
  return COLORS[initial.charCodeAt(0) % COLORS.length];
}

function EventDetailSheet({ event, joined, onClose, onJoin, onTrain, bookmarked, onBookmark, onFollowRoute, onCancelled }: {
  event: RunEvent;
  /** After the poster (or the club's owner/admin) cancels it. */
  onCancelled?: () => void;
  joined: boolean;
  bookmarked: boolean;
  onBookmark: () => void;
  onFollowRoute?: () => void;
  onClose: () => void;
  onJoin: () => void;
  /** Starts a plan ending on this race, when it is a 5K–marathon far enough ahead. */
  onTrain?: () => void;
}) {
  const C = useTheme();
  const ed = useMemo(() => mkEdStyles(C), [C]);
  const [canManage, setCanManage] = useState(false);
  useEffect(() => {
    let live = true;
    if (event.source !== 'curated' && new Date(event.startsAt).getTime() > Date.now()) {
      canManageEvent(event.id).then(ok => { if (live) setCanManage(ok); }).catch(() => {});
    }
    return () => { live = false; };
  }, [event.id, event.source, event.startsAt]);
  const confirmCancel = () => {
    Alert.alert('Cancel this event?', `Everyone going (${event.participants}) is told. You can’t undo this.`, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Cancel event', style: 'destructive', onPress: async () => {
        try {
          const r = await cancelEvent(event.id);
          if (r === 'started') { Alert.alert('It has already started'); return; }
          if (r !== 'cancelled') { Alert.alert("You can't cancel this event"); return; }
          onClose(); onCancelled?.();
        } catch { Alert.alert("Couldn't cancel the event", 'Check your connection and try again.'); }
      } },
    ]);
  };
  const isCurated = event.source === 'curated';
  const [reminder, setReminder] = useState(false);
  const [added, setAdded] = useState(false);
  const upcoming = new Date(event.startsAt).getTime() > Date.now();
  useEffect(() => { hasEventReminder(event.id).then(setReminder).catch(() => {}); }, [event.id]);
  const toggleReminder = async () => {
    const when = await setEventReminder(event, !reminder).catch(() => null);
    if (!reminder && !when) {
      Alert.alert('No reminder set', 'Turn on notifications for Runivo, or the event is starting too soon.');
      return;
    }
    setReminder(!reminder);
  };
  const addToCalendar = async () => {
    try { if (await addEventToCalendar(event)) setAdded(true); }
    catch { Alert.alert("Couldn't open your calendar", 'Allow calendar access for Runivo in Settings.'); }
  };
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
    <ModalSheet visible={true} onClose={onClose}>
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
        <Pressable style={ed.closeBtn} onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
          <X size={12} color={C.t2} weight="regular" />
        </Pressable>
      </View>

      {/* The body scrolls; header and the Join/Register footer stay put, so on a small phone
          the main action is never pushed off the bottom of the sheet. */}
      <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false} bounces={false}>
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
            <Text style={ed.orgLabel}>Organizer</Text>
            <Text style={ed.orgName}>{event.organizer}</Text>
          </View>
        </View>
      )}

      <EventExtras event={event} joined={joined} onFollowRoute={onFollowRoute} />

      {isCurated && (
        <Text style={ed.disclaimer}>
          Registration happens on the organizer's own site — Runivo isn't hosting this event.
        </Text>
      )}

      {upcoming && (
        <View style={ed.calRow}>
          {canAddToCalendar() && (
            <Pressable hitSlop={8} style={ed.calBtn} onPress={addToCalendar} accessibilityRole="button">
              {added ? <Check size={14} color={C.green} weight="bold" /> : <Calendar size={14} color={C.t1} weight="regular" />}
              <Text style={ed.calTxt}>{added ? 'In your calendar' : 'Add to calendar'}</Text>
            </Pressable>
          )}
          <Pressable hitSlop={8} style={[ed.calBtn, reminder && ed.calBtnOn]} onPress={toggleReminder} accessibilityRole="switch" accessibilityState={{ checked: reminder }}>
            <Clock size={14} color={reminder ? C.bg : C.t1} weight="regular" />
            <Text style={[ed.calTxt, reminder && { color: C.bg }]}>{reminder ? 'Reminder on' : 'Remind me the evening before'}</Text>
          </Pressable>
        </View>
      )}

      {onTrain && (
        <Pressable style={ed.trainBtn} onPress={() => { onClose(); onTrain(); }} accessibilityRole="button">
          <Text style={ed.trainTxt}>Train for this</Text>
          <Text style={ed.trainSub}>A plan that peaks on race day</Text>
        </Pressable>
      )}

      </ScrollView>

      {/* Footer */}
      <View style={ed.footer}>
        <Pressable style={ed.iconBtn} onPress={handleShare} accessibilityRole="button" accessibilityLabel="Share this event">
          <ShareNetwork size={16} color={C.t2} weight="light" />
        </Pressable>
        <Pressable style={ed.iconBtn} onPress={() => promptReport('event', event.id, 'event')}
          accessibilityRole="button" accessibilityLabel="Report this event">
          <Flag size={16} color={C.t2} weight="light" />
        </Pressable>
        <Pressable
          style={[ed.iconBtn, bookmarked && ed.iconBtnSaved]}
          onPress={onBookmark}
          accessibilityLabel={bookmarked ? 'Remove from saved' : 'Save'}
        >
          <Bookmark size={16} color={bookmarked ? C.red : C.t2} weight={bookmarked ? 'fill' : 'light'} />
        </Pressable>
        {isCurated ? (
          <Pressable
            style={ed.joinBtn}
            onPress={() => { const url = safeHttpUrl(event.registrationUrl); if (url) Linking.openURL(url).catch(() => {}); }}
            disabled={!safeHttpUrl(event.registrationUrl)}
          >
            <Text style={ed.joinLabel}>Register</Text>
            <ArrowSquareOut size={14} color={C.alwaysLight} weight="bold" />
          </Pressable>
        ) : (
          <Pressable
            style={[ed.joinBtn, joined && ed.joinBtnJoined]}
            // Tapping "Joined" used to leave the event on the spot. Leaving asks first.
            onPress={() => {
              if (!joined) { onJoin(); onClose(); return; }
              Alert.alert('Leave this event?', 'You can join again any time.', [
                { text: 'Stay', style: 'cancel' },
                { text: 'Leave event', style: 'destructive', onPress: () => { onJoin(); onClose(); } },
              ]);
            }}
            accessibilityRole="button"
          >
            {joined
              ? <><Check size={15} color={C.green} weight="regular" /><Text style={[ed.joinLabel, ed.joinLabelJoined]}>Joined</Text></>
              : <Text style={ed.joinLabel}>Join Event</Text>}
          </Pressable>
        )}
      </View>
      {canManage && (
        <Pressable onPress={confirmCancel} style={ed.cancelRow} accessibilityRole="button">
          <Text style={ed.cancelText}>Cancel event</Text>
        </Pressable>
      )}
    </ModalSheet>
  );
}

function mkEdStyles(C: AppColors) {
  return StyleSheet.create({
    sheetHeader:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 },
    chips:           { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, flexWrap: 'wrap' },
    categoryText:    { ...Type.overline, color: C.t3 },
    distPill:        { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: C.redLo },
    distPillText:    { fontFamily: Fonts.medium, fontSize: 11, color: C.red },
    externalPill:    { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: C.stone },
    externalPillText:{ fontFamily: Fonts.medium, fontSize: 11, color: C.t3 },
    closeBtn:        { width: 28, height: 28, borderRadius: 14, backgroundColor: C.mid, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 8 },
    eventTitle:      { ...Type.displaySm, color: C.black, marginBottom: 8 },
    eventDesc:       { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, lineHeight: 22, marginBottom: 16 },
    detailCard:      { backgroundColor: C.card, borderRadius: 22, borderWidth: 0.5, borderColor: C.border, overflow: 'hidden', marginBottom: 20 },
    detailRow:       { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 13 },
    detailRowBorder: { borderBottomWidth: 0.5, borderBottomColor: C.mid },
    detailIconBox:   { width: 30, height: 30, borderRadius: 8, backgroundColor: C.stone, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    detailLabel:     { fontFamily: Fonts.regular, fontSize: 11, color: C.t3, marginBottom: 2 },
    detailValue:     { fontFamily: Fonts.regular, fontSize: 13, color: C.black },
    organizerRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
    orgAvatar:       { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    orgAvatarText:   { fontFamily: Fonts.bold, fontSize: 11, color: C.white },
    orgLabel:        { fontFamily: Fonts.regular, fontSize: 11, color: C.t3, marginBottom: 1 },
    orgName:         { fontFamily: Fonts.regular, fontSize: 13, color: C.black },
    disclaimer:      { fontFamily: Fonts.regular, fontSize: 11.5, color: C.t3, lineHeight: 15, marginBottom: 14 },
    footer:          { flexDirection: 'row', gap: 8, alignItems: 'center' },
    iconBtn:         { width: 48, height: 48, borderRadius: 22, backgroundColor: C.card, borderWidth: 0.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    iconBtnSaved:    { backgroundColor: C.redLo, borderColor: 'rgba(217,53,24,0.3)' },
    calRow:          { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
    calBtn:          { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 12, borderRadius: 19, borderWidth: 1, borderColor: C.border },
    calBtnOn:        { backgroundColor: C.t1, borderColor: C.t1 },
    calTxt:          { fontFamily: Fonts.semiBold, fontSize: 13, color: C.t1 },
    trainBtn:        { borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingVertical: 12, alignItems: 'center', marginBottom: 12 },
    trainTxt:        { fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1 },
    trainSub:        { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, marginTop: 2 },
    joinBtn:         { flex: 1, height: 48, borderRadius: 14, backgroundColor: C.alwaysDark, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
    joinBtnJoined:   { backgroundColor: C.greenBg, borderWidth: 0.5, borderColor: 'rgba(26,107,64,0.25)' },
    joinLabel:       { fontFamily: Fonts.semiBold, fontSize: 14, color: C.alwaysLight },
    joinLabelJoined: { color: C.green },
    cancelRow:       { alignItems: 'center', paddingTop: 14 },
    cancelText:      { fontFamily: Fonts.medium, fontSize: 15, color: C.danger },
  });
}

/** `embedded`: shown inside the Groups tab, which supplies the title and safe area. */
export default function EventsScreen({ embedded = false }: { embedded?: boolean }) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const {
    events, joinedIds, bookmarkedIds, toggleBookmark, canCreate, loading, refreshing,
    nearMeAvailable, nearMeActive, toggleNearMe, handleJoin, refresh,
    error: loadError,
  } = useEvents();
  const [selectedEvent, setSelectedEvent] = useState<RunEvent | null>(null);

  const [tab, setTab] = useState<'upcoming' | 'going' | 'past'>('upcoming');
  const shown = useMemo(() => {
    const now = Date.now();
    const upcoming = events.filter(e => new Date(e.startsAt).getTime() >= now);
    if (tab === 'going') return upcoming.filter(e => joinedIds.has(e.id) || bookmarkedIds.has(e.id));
    if (tab === 'past') return events.filter(e => new Date(e.startsAt).getTime() < now).reverse();
    return upcoming;
  }, [events, joinedIds, bookmarkedIds, tab]);
  const firstHosted = shown.find(e => e.source !== 'curated')?.id;

  // "Train for this": curated races of a plannable distance at least a week away
  // open plan setup on that race's page (curated events are mirrored as races).
  const trainFor = (e: RunEvent) => {
    const race = raceForKm(e.distanceM ? e.distanceM / 1000 : null);
    if (e.source !== 'curated' || !race || new Date(e.startsAt).getTime() - Date.now() < 7 * 86400e3) return undefined;
    return () => navigation.navigate('PlanBuilder', { eventId: e.id });
  };

  const headerActions = (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {canCreate && (
        <Pressable hitSlop={8} style={s.chip} onPress={() => navigation.navigate('CreateEvent')}>
          <Text style={s.chipText}>Host</Text>
        </Pressable>
      )}
      {nearMeAvailable && (
        <Pressable hitSlop={8} style={[s.chip, nearMeActive && s.chipOn]} onPress={() => toggleNearMe()}>
          <Text style={[s.chipText, nearMeActive && { color: C.bg }]}>Near me</Text>
        </Pressable>
      )}
    </View>
  );

  const Root = embedded ? View : SafeAreaView;
  return (
    <Root style={s.root}>
      {embedded
        ? <View style={s.embeddedBar}>{headerActions}</View>
        : <ScreenHeader variant="large" title="Events" onBack={() => navigation.goBack()} right={headerActions} />}

      {!embedded && <Segmented style={{ marginHorizontal: 18, marginBottom: 12 }} options={[{ value: 'upcoming', label: 'Upcoming' }, { value: 'going', label: 'Going' }, { value: 'past', label: 'Past' }]} value={tab} onChange={setTab} />}

      {embedded && !loading ? (
        <ScrollView
          contentContainerStyle={s.secList}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.red} />}
        >
          {loadError && events.length === 0 && <ErrorState title="Couldn't load events" onRetry={refresh} />}
          {(() => {
            const now = Date.now();
            const up = events.filter(e => new Date(e.startsAt).getTime() >= now);
            const runs = up.filter(e => e.source !== 'curated').slice(0, 8);
            const races = up.filter(e => e.source === 'curated').slice(0, 6);
            const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
            return (
              <>
                <View style={s.secHead}><Text style={s.secTitle}>Club runs this week</Text></View>
                {runs.length === 0
                  ? <Text style={s.secEmpty}>No club runs coming up. Clubs you join post them here.</Text>
                  : (
                    <View style={s.rowsCard}>
                      {runs.map((e, i) => {
                        const d = new Date(e.startsAt);
                        const going = joinedIds.has(e.id);
                        return (
                          <Pressable key={e.id} style={[s.evRow, i > 0 && s.evRowBorder]} onPress={() => setSelectedEvent(e)} accessibilityRole="button">
                            <View style={s.dateTile}>
                              <Text style={s.dateDow}>{DOW[d.getDay()]}</Text>
                              <Text style={s.dateNum}>{d.getDate()}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={s.evTitle} numberOfLines={1}>{e.title}</Text>
                              <Text style={s.evSub} numberOfLines={1}>{[e.time, e.distance, e.location, `${e.participants} going`].filter(Boolean).join(' · ')}</Text>
                            </View>
                            {going && <View style={s.goingPill}><Text style={s.goingTxt}>Going ✓</Text></View>}
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                <View style={s.secHead}><Text style={s.secTitle}>Races near you</Text></View>
                {races.length === 0 && <Text style={s.secEmpty}>No races listed near you yet.</Text>}
                {races.map(e => {
                  const train = trainFor(e);
                  return (
                    <Pressable key={e.id} style={s.raceCard} onPress={() => setSelectedEvent(e)} accessibilityRole="button">
                      <Text style={s.raceWhen}>{e.date}{e.location ? ` · ${e.location}` : ''}</Text>
                      <Text style={s.raceTitle} numberOfLines={2}>{e.title}</Text>
                      {!!e.distance && <Text style={s.raceSub}>{e.distance}</Text>}
                      {train && (
                        <Pressable style={s.trainBtn} onPress={train} accessibilityRole="button">
                          <PaceXOrb size={22} />
                          <Text style={s.trainTxt}>Train for this with PaceX</Text>
                        </Pressable>
                      )}
                    </Pressable>
                  );
                })}
              </>
            );
          })()}
        </ScrollView>
      ) : loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.red} />
        </View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={e => e.id}
          renderItem={({ item }) => (
            <EventCard
              event={item}
              featured={item.id === firstHosted}
              joined={joinedIds.has(item.id)}
              onJoin={() => handleJoin(item.id)}
              onPress={() => setSelectedEvent(item)}
            />
          )}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.red} />}
          ListEmptyComponent={
            loadError ? <ErrorState title="Couldn't load events" onRetry={refresh} /> :
            <View style={s.empty}>
              <Text style={s.emptyTitle}>
                {tab === 'going' ? "Nothing yet. Join or save an event and it shows here." : tab === 'past' ? 'No past events.' : 'No events coming up.'}
              </Text>
              <Text style={s.emptyText}>Group runs from clubs and official races near you show up here.</Text>
            </View>
          }
        />
      )}

      {selectedEvent && (
        <EventDetailSheet
          event={selectedEvent}
          joined={joinedIds.has(selectedEvent.id)}
          onClose={() => setSelectedEvent(null)}
          onJoin={() => handleJoin(selectedEvent.id)}
          onTrain={trainFor(selectedEvent)}
          bookmarked={bookmarkedIds.has(selectedEvent.id)}
          onBookmark={() => toggleBookmark(selectedEvent.id)}
          onCancelled={refresh}
          onFollowRoute={selectedEvent.route ? () => { const r = selectedEvent.route!; setSelectedEvent(null); navigation.navigate('ActiveRun', { autoStart: false, activityType: 'run', ghostRoutePoints: r }); } : undefined}
        />
      )}
    </Root>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:       { flex: 1, backgroundColor: C.bg },
    embeddedBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 18, paddingTop: 4, paddingBottom: 12 },
    chip:       { backgroundColor: C.card, borderRadius: 999, paddingHorizontal: 16, height: 38, justifyContent: 'center' },
    chipOn:     { backgroundColor: C.t1, borderColor: C.t1 },
    chipText:   { fontFamily: Fonts.medium, fontSize: 14, color: C.t1 },
    list:       { paddingTop: 2, paddingBottom: 130 },
    secList:    { paddingHorizontal: 18, paddingBottom: 130, gap: 12 },
    secHead:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 6 },
    secTitle:   { fontFamily: Fonts.semiBold, fontSize: 18, color: C.t1 },
    secEmpty:   { fontFamily: Fonts.regular, fontSize: 14, color: C.t2 },
    rowsCard:   { backgroundColor: C.card, borderRadius: 24, paddingHorizontal: 14 },
    evRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
    evRowBorder:{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
    dateTile:   { width: 48, height: 52, borderRadius: 14, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
    dateDow:    { fontFamily: Fonts.bold, fontSize: 11, color: C.t2 },
    dateNum:    { fontFamily: Fonts.semiBold, fontSize: 20, color: C.t1, lineHeight: 24 },
    evTitle:    { fontFamily: Fonts.semiBold, fontSize: 16, color: C.t1 },
    evSub:      { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, marginTop: 2 },
    goingPill:  { height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: C.mint, justifyContent: 'center' },
    goingTxt:   { fontFamily: Fonts.semiBold, fontSize: 12.5, color: C.green },
    raceCard:   { backgroundColor: C.card, borderRadius: 26, padding: 18, gap: 6 },
    raceWhen:   { fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
    raceTitle:  { fontFamily: Fonts.semiBold, fontSize: 22, lineHeight: 27, color: C.t1 },
    raceSub:    { fontFamily: Fonts.regular, fontSize: 14, color: C.t2 },
    trainBtn:   { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start', marginTop: 8, height: 44, paddingLeft: 12, paddingRight: 18, borderRadius: 22, backgroundColor: C.lavender },
    trainTxt:   { fontFamily: Fonts.medium, fontSize: 14, color: C.lavenderInk },
    empty:      { alignItems: 'center' as const, paddingVertical: 56, paddingHorizontal: 32, gap: 8 },
    emptyTitle: { fontFamily: Fonts.semiBold, fontSize: 16, color: C.t1, textAlign: 'center' },
    emptyText:  { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, textAlign: 'center', lineHeight: 18 },
  });
}
