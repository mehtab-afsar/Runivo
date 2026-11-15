/** Club territory (PRD C2): every zone the members hold, the club's score and rank, top holders. */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import { fetchClubTerritory, fetchClubTerritoryRank, type ClubZone } from '../services/clubService';

const fmtArea = (m2: number) => (m2 >= 1_000_000 ? `${(m2 / 1_000_000).toFixed(2)} km²` : m2 >= 10_000 ? `${(m2 / 10_000).toFixed(1)} ha` : `${Math.round(m2).toLocaleString('en')} m²`);

export default function ClubTerritoryTab({ clubId, onOpenMap }: { clubId: string; onOpenMap: (zones: ClubZone[]) => void }) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const [zones, setZones] = useState<ClubZone[] | null>(null);
  const [rank, setRank] = useState<{ rank: number; of: number } | null>(null);

  useEffect(() => {
    fetchClubTerritory(clubId).then(setZones).catch(() => setZones([]));
    fetchClubTerritoryRank(clubId).then(setRank).catch(() => {});
  }, [clubId]);

  const byMember = useMemo(() => {
    const m = new Map<string, { name: string; zones: number; area: number }>();
    for (const z of zones ?? []) {
      const e = m.get(z.ownerId) ?? { name: z.ownerName, zones: 0, area: 0 };
      e.zones += 1; e.area += z.areaM2; m.set(z.ownerId, e);
    }
    return [...m.values()].sort((a, b) => b.area - a.area).slice(0, 10);
  }, [zones]);

  if (zones === null) return <ActivityIndicator color={C.t2} style={{ marginTop: 32 }} />;
  const total = zones.reduce((t, z) => t + z.areaM2, 0);

  return (
    <ScrollView contentContainerStyle={s.content}>
      <View style={s.card}>
        <Text style={s.label}>Club territory</Text>
        <Text style={s.big}>{fmtArea(total)}</Text>
        <Text style={s.sub}>{zones.length} zones held by members{rank ? ` · #${rank.rank} of ${rank.of} clubs` : ''}</Text>
        {zones.length > 0 && (
          <Pressable style={s.cta} onPress={() => onOpenMap(zones)} accessibilityRole="button">
            <Text style={s.ctaTxt}>See it on the map</Text>
          </Pressable>
        )}
      </View>
      {byMember.length > 0 && (
        <View style={s.card}>
          <Text style={s.label}>Who holds the most</Text>
          {byMember.map((m, i) => (
            <View key={m.name + i} style={[s.row, i > 0 && s.border]}>
              <Text style={s.rank}>{i + 1}</Text>
              <Text style={s.name} numberOfLines={1}>{m.name}</Text>
              <Text style={s.val}>{fmtArea(m.area)} · {m.zones}</Text>
            </View>
          ))}
        </View>
      )}
      {zones.length === 0 && <Text style={s.sub}>No zones yet. Every zone a member claims counts for the club.</Text>}
    </ScrollView>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    content: { padding: 18, gap: 12, paddingBottom: 60 },
    card:  { backgroundColor: C.card, borderRadius: 22, padding: 16 },
    label: { fontFamily: Fonts.medium, fontSize: 12, color: C.t2 },
    big:   { fontFamily: Fonts.numeric, fontSize: 34, color: C.t1, marginTop: 4 },
    sub:   { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, marginTop: 4 },
    cta:   { height: 44, borderRadius: 12, backgroundColor: C.t1, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
    ctaTxt:{ fontFamily: Fonts.semiBold, fontSize: 14.5, color: C.bg },
    row:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
    border:{ borderTopWidth: 1, borderTopColor: C.border },
    rank:  { width: 20, fontFamily: Fonts.numeric, fontSize: 16, color: C.t2 },
    name:  { flex: 1, fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
    val:   { fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
  });
}
