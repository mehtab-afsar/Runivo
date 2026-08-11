import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { Calendar, MapPin, Users, Bookmark, ArrowSquareOut, Check } from 'phosphor-react-native';
import type { RunEvent } from '../types';
import { DISCIPLINE_LABEL } from '../types';
import { useTheme, Fonts, Type, type AppColors } from '@theme';

interface Props {
  event: RunEvent;
  joined: boolean;
  onJoin: () => void;
  onPress?: () => void;
}

export function EventCard({ event, joined, onJoin, onPress }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const [bookmarked, setBookmarked] = useState(false);
  const isCurated = event.source === 'curated';
  const categoryLabel = event.discipline
    ? DISCIPLINE_LABEL[event.discipline]
    : event.category.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <Pressable style={s.row} onPress={onPress}>
      {/* Top row: category + pills | bookmark */}
      <View style={s.topRow}>
        <View style={s.pills}>
          <Text style={s.categoryText}>{categoryLabel}</Text>
          {event.distance && (
            <View style={s.distPill}>
              <Text style={s.distPillText}>{event.distance}</Text>
            </View>
          )}
          {isCurated ? (
            <View style={s.externalPill}>
              <ArrowSquareOut size={9} color={C.t3} weight="bold" />
              <Text style={s.externalPillText}>{event.sourceName ?? 'External'}</Text>
            </View>
          ) : joined && (
            <View style={s.joinedPill}>
              <Text style={s.joinedPillText}>Joined</Text>
            </View>
          )}
        </View>
        <Pressable
          onPress={e => { e.stopPropagation(); setBookmarked(b => !b); }}
          hitSlop={8}
        >
          <Bookmark
            size={14}
            color={bookmarked ? C.red : C.t3}
            weight={bookmarked ? 'fill' : 'light'}
          />
        </Pressable>
      </View>

      {/* Title */}
      <Text style={s.title} numberOfLines={2}>{event.title}</Text>

      {/* Meta row */}
      <View style={s.metaRow}>
        <View style={s.metaItem}>
          <Calendar size={10} color={C.t3} weight="light" />
          <Text style={s.metaText}>{event.date}</Text>
        </View>
        <View style={s.metaItem}>
          <MapPin size={10} color={C.t3} weight="light" />
          <Text style={s.metaText}>{event.location}</Text>
        </View>
        {!isCurated && (
          <View style={s.metaItem}>
            <Users size={10} color={C.t3} weight="light" />
            <Text style={s.metaText}>{event.participants.toLocaleString()}</Text>
          </View>
        )}
      </View>

      {/* Quick action — one tap, no need to open the detail sheet */}
      {isCurated ? (
        event.registrationUrl && (
          <Pressable
            style={s.quickBtn}
            onPress={e => { e.stopPropagation(); Linking.openURL(event.registrationUrl!); }}
          >
            <Text style={s.quickBtnText}>Register</Text>
            <ArrowSquareOut size={11} color={C.alwaysLight} weight="bold" />
          </Pressable>
        )
      ) : (
        <Pressable
          style={[s.quickBtn, joined && s.quickBtnJoined]}
          onPress={e => { e.stopPropagation(); onJoin(); }}
        >
          {joined
            ? <><Check size={11} color={C.green} weight="bold" /><Text style={[s.quickBtnText, s.quickBtnTextJoined]}>Joined</Text></>
            : <Text style={s.quickBtnText}>Join</Text>}
        </Pressable>
      )}
    </Pressable>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    row:           { backgroundColor: C.card, paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: C.mid },
    topRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    pills:         { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, flexWrap: 'wrap' },
    categoryText:  { ...Type.overline, color: C.t3 },
    distPill:      { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, backgroundColor: C.redLo },
    distPillText:  { fontFamily: Fonts.medium, fontSize: 10, color: C.red },
    joinedPill:    { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, backgroundColor: C.greenBg },
    joinedPillText:{ fontFamily: Fonts.medium, fontSize: 10, color: C.green },
    externalPill:  { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, backgroundColor: C.stone },
    externalPillText: { fontFamily: Fonts.medium, fontSize: 10, color: C.t3 },
    title:         { fontFamily: Fonts.medium, fontSize: 15, color: C.black, marginBottom: 10, lineHeight: 20 },
    metaRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 14, rowGap: 4, marginBottom: 12 },
    metaItem:      { flexDirection: 'row', alignItems: 'center', gap: 5 },
    metaText:      { fontFamily: Fonts.regular, fontSize: 10, color: C.t2 },
    quickBtn:      { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 6, backgroundColor: C.alwaysDark, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
    quickBtnJoined:{ backgroundColor: C.greenBg },
    quickBtnText:  { fontFamily: Fonts.semiBold, fontSize: 11.5, color: C.alwaysLight, letterSpacing: 0.2 },
    quickBtnTextJoined: { color: C.green },
  });
}
