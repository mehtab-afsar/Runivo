import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Calendar, MapPin, Users, Bookmark } from 'lucide-react-native';
import type { RunEvent } from '../types';
import { useTheme, type AppColors } from '@theme';

interface Props {
  event: RunEvent;
  joined: boolean;
  onJoin: () => void;
  onPress?: () => void;
}

export function EventCard({ event, joined, onPress }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const [bookmarked, setBookmarked] = useState(false);
  const categoryLabel = event.category.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

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
          {joined && (
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
            fill={bookmarked ? C.red : 'none'}
            strokeWidth={1.8}
          />
        </Pressable>
      </View>

      {/* Title */}
      <Text style={s.title} numberOfLines={2}>{event.title}</Text>

      {/* Meta row */}
      <View style={s.metaRow}>
        <View style={s.metaItem}>
          <Calendar size={10} color={C.t3} strokeWidth={1.8} />
          <Text style={s.metaText}>{event.date}</Text>
        </View>
        <View style={s.metaItem}>
          <MapPin size={10} color={C.t3} strokeWidth={1.8} />
          <Text style={s.metaText}>{event.location}</Text>
        </View>
        <View style={s.metaItem}>
          <Users size={10} color={C.t3} strokeWidth={1.8} />
          <Text style={s.metaText}>{event.participants.toLocaleString()}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    row:           { backgroundColor: C.white, paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: C.mid },
    topRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    pills:         { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
    categoryText:  { fontFamily: 'Barlow_400Regular', fontSize: 9, color: C.t3, textTransform: 'uppercase', letterSpacing: 1 },
    distPill:      { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, backgroundColor: C.redLo },
    distPillText:  { fontFamily: 'Barlow_500Medium', fontSize: 9, color: C.red },
    joinedPill:    { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, backgroundColor: C.greenBg },
    joinedPillText:{ fontFamily: 'Barlow_500Medium', fontSize: 9, color: C.green },
    title:         { fontFamily: 'Barlow_500Medium', fontSize: 15, color: C.black, marginBottom: 10, lineHeight: 20 },
    metaRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 14, rowGap: 4 },
    metaItem:      { flexDirection: 'row', alignItems: 'center', gap: 5 },
    metaText:      { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.t2 },
  });
}
