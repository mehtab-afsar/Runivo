// Groups · Clubs: "CLUB WAR · ENDS SUNDAY" card (mock GroupsClubs).
// Server: club_war (migration 20261117000004). Hidden until there's a rival.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { fetchClubWar, type ClubWar } from '../services/clubService';
import { useTheme, Fonts, type AppColors } from '@theme';

const ordinal = (n: number) => {
  const v = n % 100;
  return n + (v >= 11 && v <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
};
const shortName = (name: string) => name.split(/\s+/).filter(w => !/^(the|of|and|club|runners?|run)$/i.test(w)).pop() ?? name;

function endsLabel(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return 'ENDED';
  const hours = ms / 3_600_000;
  if (hours < 24) return 'ENDS TONIGHT';
  // ends_at is Monday 00:00 UTC, so the last day is the day before it.
  return `ENDS ${new Date(new Date(endsAt).getTime() - 1).toLocaleDateString(undefined, { weekday: 'long' }).toUpperCase()}`;
}

export function ClubWarCard({ clubId, onPress }: { clubId: string; onPress?: () => void }) {
  const C = useTheme();
  const s = useMemo(() => styles(C), [C]);
  const [war, setWar] = useState<ClubWar | null>(null);

  useEffect(() => {
    let live = true;
    fetchClubWar(clubId).then(w => { if (live) setWar(w); }).catch(() => {});
    return () => { live = false; };
  }, [clubId]);

  if (!war) return null;
  const total = war.clubAreaM2 + war.rivalAreaM2;
  const mine = total > 0 ? Math.round((war.clubAreaM2 / total) * 100) : 50;
  const me = war.myAreaM2 > 0
    ? `You added ${Math.round(war.myAreaM2).toLocaleString()} m² this week${war.myRank ? ` · ${ordinal(war.myRank)} in the club` : ''}`
    : 'Run this week to add your zones to the score';

  return (
    <Pressable style={s.card} onPress={onPress} disabled={!onPress} accessibilityRole="button"
      accessibilityLabel={`Club war: ${war.clubName} ${mine} percent, ${war.rivalName} ${100 - mine} percent`}>
      <Text style={s.over}>CLUB WAR · {endsLabel(war.endsAt)}</Text>
      <Text style={s.score} numberOfLines={1}>{shortName(war.clubName)} {mine}% · {shortName(war.rivalName)} {100 - mine}%</Text>
      <View style={s.bar}>
        <View style={{ flex: Math.max(mine, 1), backgroundColor: C.brandGreen }} />
        <View style={{ flex: Math.max(100 - mine, 1), backgroundColor: C.rivalAmber }} />
      </View>
      <Text style={s.me}>{me}</Text>
    </Pressable>
  );
}

const styles = (C: AppColors) => StyleSheet.create({
  card:  { borderRadius: 24, backgroundColor: C.mint, padding: 16, gap: 8 },
  over:  { fontFamily: Fonts.bold, fontSize: 12, color: C.green, letterSpacing: 0.3 },
  score: { fontFamily: Fonts.semiBold, fontSize: 17, color: C.t1 },
  bar:   { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden' },
  me:    { fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
});
