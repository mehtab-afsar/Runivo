import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ExternalLink } from 'lucide-react-native';
import type { RunEvent } from '../types';
import { DISCIPLINE_LABEL } from '../types';
import { useTheme, Fonts, type AppColors } from '@theme';
import { CityBackdrop } from '@mobile/shared/components/CityBackdrop';
import { safeHttpUrl } from '@mobile/shared/lib/safeUrl';
import { RunnerFace } from '@mobile/shared/components/RunnerFace';

interface Props {
  event: RunEvent;
  joined: boolean;
  onJoin: () => void;
  onPress?: () => void;
  /** The first hosted card gets the map header, as in the mock. */
  featured?: boolean;
}

/** "Sat 8 Nov · 8:00" */
function whenLine(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}

const MAP_W = 320, MAP_H = 110;

export function EventCard({ event, joined, onJoin, onPress, featured }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const curated = event.source === 'curated';
  const kind = event.discipline ? DISCIPLINE_LABEL[event.discipline] : null;

  if (curated) {
    const meta = [whenLine(event.startsAt), event.distance, "sign-up on the organiser's site"].filter(Boolean).join(' · ');
    return (
      <Pressable style={s.card} onPress={onPress}>
        <View style={s.curatedTop}>
          <View style={s.curatedChip}><Text style={s.curatedChipText}>Curated · {kind ?? 'Official race'}</Text></View>
          <ExternalLink size={16} color={C.t2} strokeWidth={1.8} />
        </View>
        <Text style={s.title}>{event.title}</Text>
        <Text style={s.meta}>{meta}</Text>
        <Pressable
          style={s.outlineBtn}
          onPress={() => { const url = safeHttpUrl(event.registrationUrl); if (url) Linking.openURL(url).catch(() => {}); }}
          disabled={!safeHttpUrl(event.registrationUrl)}
          accessibilityRole="link"
        >
          <Text style={s.outlineBtnText}>Register on organiser site</Text>
        </Pressable>
      </Pressable>
    );
  }

  const meta = [event.location, event.distance && `${event.distance} group loop`, event.organizer && `hosted by ${event.organizer}`]
    .filter(Boolean).join(' · ');
  const going = event.participants;
  const rsvp = (
    <Pressable
      style={[s.rsvp, featured ? s.rsvpSolid : s.rsvpOutline, joined && s.rsvpJoined]}
      onPress={onJoin}
      accessibilityRole="button"
    >
      <Text style={[s.rsvpText, featured && !joined ? { color: '#fff' } : null]}>{joined ? 'Going' : 'RSVP'}</Text>
    </Pressable>
  );

  return (
    <Pressable style={[s.card, featured && { paddingTop: 0, overflow: 'hidden' }]} onPress={onPress}>
      {featured && (
        <View style={s.mapWrap}>
          <Svg width="100%" height={MAP_H} viewBox={`0 0 ${MAP_W} ${MAP_H}`} preserveAspectRatio="xMidYMid slice">
            <CityBackdrop width={MAP_W} height={MAP_H} seed={event.id} />
            <Path d="M30 14C82 -6 168 0 196 26L210 104C182 128 98 132 46 112Z" fill="none" stroke={C.red} strokeWidth={4} strokeLinejoin="round" />
          </Svg>
          <View style={s.mapChip}><Text style={s.mapChipText}>Hosted · In-app RSVP</Text></View>
        </View>
      )}
      <View style={featured ? s.featuredBody : s.compactRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.when}>{whenLine(event.startsAt)}</Text>
          <Text style={s.title}>{event.title}</Text>
          <Text style={s.meta}>{featured ? meta : [event.location, event.distance, `${going} going`].filter(Boolean).join(' · ')}</Text>
        </View>
        {!featured && rsvp}
      </View>
      {featured && (
        <View style={s.footer}>
          <View style={s.faces}>
            {[0, 1, 2].slice(0, Math.max(1, Math.min(3, going))).map(i => (
              <View key={i} style={[s.face, i > 0 && { marginLeft: -8 }]}>
                <RunnerFace seed={`${event.id}-${i}`} size={24} />
              </View>
            ))}
            <Text style={s.going}>{going} going</Text>
          </View>
          {rsvp}
        </View>
      )}
    </Pressable>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card:         { backgroundColor: C.card, borderRadius: 18, padding: 16, marginHorizontal: 18, marginBottom: 12 },
    mapWrap:      { marginHorizontal: -16, marginBottom: 14, height: MAP_H, overflow: 'hidden' },
    mapChip:      { position: 'absolute', left: 12, top: 12, backgroundColor: C.t1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
    mapChipText:  { fontFamily: Fonts.semiBold, fontSize: 11, color: '#fff' },
    featuredBody: {},
    compactRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    when:         { fontFamily: Fonts.medium, fontSize: 12.5, color: C.red, marginBottom: 4 },
    title:        { fontFamily: Fonts.bold, fontSize: 19, letterSpacing: -0.4, color: C.t1, marginBottom: 4 },
    meta:         { fontFamily: Fonts.regular, fontSize: 13, lineHeight: 18, color: C.t2 },
    footer:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
    faces:        { flexDirection: 'row', alignItems: 'center' },
    face:         { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: C.card, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    going:        { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, marginLeft: 8 },
    rsvp:         { borderRadius: 999, paddingHorizontal: 16, height: 34, justifyContent: 'center', alignItems: 'center' },
    rsvpSolid:    { backgroundColor: C.red },
    rsvpOutline:  { borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
    rsvpJoined:   { backgroundColor: C.card, borderWidth: 1, borderColor: C.t1 },
    rsvpText:     { fontFamily: Fonts.semiBold, fontSize: 13, color: C.t1 },
    curatedTop:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    curatedChip:  { backgroundColor: C.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
    curatedChipText: { fontFamily: Fonts.semiBold, fontSize: 11.5, color: C.t1 },
    outlineBtn:   { marginTop: 14, height: 44, borderRadius: 999, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    outlineBtnText: { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
  });
}
