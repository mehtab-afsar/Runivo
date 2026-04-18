import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Calendar, Clock, MapPin, Activity, Users, Check } from 'lucide-react-native';
import type { RunEvent } from '../types';
import { CATEGORY_EMOJI } from '../types';
import { Colors } from '@theme';

const C = Colors;

interface Props {
  event: RunEvent;
  joined: boolean;
  onJoin: () => void;
  onPress?: () => void;
}

export function EventCard({ event, joined, onJoin, onPress }: Props) {
  const emoji = CATEGORY_EMOJI[event.category] ?? '📍';
  return (
    <Pressable style={s.card} onPress={onPress}>
      <View style={s.cardTop}>
        <View style={s.iconBox}>
          <Text style={{ fontSize: 20 }}>{emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.eventTitle} numberOfLines={1}>{event.title}</Text>
          <Text style={s.eventDesc} numberOfLines={2}>{event.description}</Text>
        </View>
      </View>
      <View style={s.metaRow}>
        <Calendar size={11} color={C.t2} strokeWidth={1.5} />
        <Text style={s.meta}> {event.date}  </Text>
        <Clock size={11} color={C.t2} strokeWidth={1.5} />
        <Text style={s.meta}> {event.time}</Text>
      </View>
      <View style={s.metaRow}>
        <MapPin size={11} color={C.t2} strokeWidth={1.5} />
        <Text style={s.meta}> {event.location}</Text>
        {event.distance && (
          <>
            <Activity size={11} color={C.t2} strokeWidth={1.5} style={{ marginLeft: 8 }} />
            <Text style={s.meta}> {event.distance}</Text>
          </>
        )}
      </View>
      <View style={s.footer}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Users size={11} color={C.t3} strokeWidth={1.5} />
          <Text style={s.participants}>{event.participants} joined</Text>
        </View>
        <Pressable style={[s.joinBtn, joined && s.joinBtnJoined]} onPress={onJoin}>
          {joined ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Check size={12} color={C.green} strokeWidth={2} />
              <Text style={[s.joinLabel, s.joinLabelJoined]}>Joined</Text>
            </View>
          ) : (
            <Text style={s.joinLabel}>Join</Text>
          )}
        </Pressable>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: C.white, borderRadius: 14, borderWidth: 0.5, borderColor: C.border, padding: 14 },
  cardTop: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  iconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.stone, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  eventTitle: { fontFamily: 'Barlow_600SemiBold', fontSize: 14, color: C.black, marginBottom: 3 },
  eventDesc: { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t2, lineHeight: 16 },
  metaRow: { flexDirection: 'row', marginBottom: 4 },
  meta: { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t2 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  participants: { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t3 },
  joinBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 6, backgroundColor: C.black },
  joinBtnJoined: { backgroundColor: C.greenLo },
  joinLabel: { fontFamily: 'Barlow_500Medium', fontSize: 12, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 },
  joinLabelJoined: { color: C.green },
});
