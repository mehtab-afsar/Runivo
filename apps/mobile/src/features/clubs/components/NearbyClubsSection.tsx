import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme, Fonts, Type, type AppColors } from '@theme';
import { ClubInitialsTile } from './ClubHeroCard';
import { clubMetaLine, clubsSectionTitle } from '@shared/engine/clubsNear';
import type { Club } from '../types';

interface Props {
  clubs: Club[];
  /** false when the list is the popular fallback. */
  nearby: boolean;
  /** Whether location is granted; picks the hint under the popular list. */
  locationOn?: boolean;
  onPress: (club: Club) => void;
  onJoin: (club: Club) => void;
}

/**
 * "Clubs near you" on the Clubs screen: the closest clubs with a rounded
 * distance, or the most popular ones when the runner's location isn't shared
 * or nothing is close.
 */
export function NearbyClubsSection({ clubs, nearby, locationOn = false, onPress, onJoin }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  if (clubs.length === 0) return null;

  return (
    <View style={s.wrap}>
      <View style={s.headRow}>
        <Text style={s.heading}>{nearby ? 'Discover near you' : clubsSectionTitle(nearby)}</Text>
      </View>
      {!nearby && (
        <Text style={s.hint}>
          {locationOn
            ? 'No clubs within 15 km yet. Start one, or join a popular club.'
            : 'Allow location to see clubs that run near you.'}
        </Text>
      )}
      <View style={s.card}>
        {clubs.map((club, i) => {
          return (
            <Pressable
              key={club.id}
              style={({ pressed }) => [s.row, i < clubs.length - 1 && s.rowBorder, pressed && s.pressed]}
              onPress={() => onPress(club)}
              accessibilityRole="button"
              accessibilityLabel={`${club.name}, ${clubMetaLine(club)}`}
            >
              <ClubInitialsTile name={club.name} size={40} />
              <View style={s.middle}>
                <Text style={s.name} numberOfLines={1}>{club.name}</Text>
                <Text style={s.meta} numberOfLines={1}>
                  {[
                    nearby && club.distance_km != null ? `${club.distance_km.toFixed(1)} km` : null,
                    `${club.member_count} ${club.member_count === 1 ? 'member' : 'members'}`,
                    club.join_policy === 'open' ? 'open to all' : 'invite only',
                  ].filter(Boolean).join(' · ')}
                </Text>
              </View>
              {club.joined ? (
                <Text style={s.joined}>Joined</Text>
              ) : (
                <Pressable
                  style={s.joinBtn}
                  onPress={() => onJoin(club)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={club.join_policy === 'open' ? `Join ${club.name}` : `Ask to join ${club.name}`}
                >
                  <Text style={s.joinText}>{club.join_policy === 'open' ? 'Join' : 'Request'}</Text>
                </Pressable>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    wrap:      { marginBottom: 18 },
    headRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    heading:   { ...Type.labelSm, color: C.t2 },
    hint:      { ...Type.caption, color: C.t2, marginBottom: 8, marginTop: -4 },
    card:      {
      backgroundColor: C.card, borderRadius: 16, paddingHorizontal: 16,
      shadowColor: '#14120F', shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1,
    },
    row:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
    pressed:   { opacity: 0.7 },
    badge:     { width: 36, height: 36, borderRadius: 10, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
    middle:    { flex: 1 },
    name:      { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
    meta:      { fontFamily: Fonts.regular, fontSize: 12.5, color: C.t2, marginTop: 2 },
    joinBtn:   { height: 30, paddingHorizontal: 12, borderRadius: 999, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    joinText:  { fontFamily: Fonts.semiBold, fontSize: 12.5, color: C.t1 },
    joined:    { fontFamily: Fonts.medium, fontSize: 12, color: C.t3 },
  });
}
