import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getAllTerritories } from '@shared/services/store';
import type { StoredTerritory } from '@shared/services/store';
import { supabase } from '@shared/services/supabase';
import { TIER_CONFIG, formatArea } from '@shared/constants/territory';
import { useTheme, Fonts, type AppColors } from '@theme';

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;
  if (d === 1) return 'Yesterday';
  return `${d} days ago`;
}

export function TerritoryTab() {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const [owned, setOwned] = useState<StoredTerritory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const all = await getAllTerritories();
      if (session) {
        setOwned(all.filter(t => t.ownerId === session.user.id));
      } else {
        setOwned([]);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return null;

  if (owned.length === 0) {
    return (
      <View style={ss.empty}>
        <Text style={ss.emptyHeadline}>No ground under your name yet.</Text>
        <Text style={ss.emptyText}>Claim your first zone and it'll show up here.</Text>
      </View>
    );
  }

  const totalAreaM2 = owned.reduce((s, t) => s + t.areaM2, 0);
  const sorted = [...owned].sort((a, b) => (b.claimedAt ?? 0) - (a.claimedAt ?? 0));

  return (
    <View>
      {/* Header stat row */}
      <View style={ss.statRow}>
        <View style={ss.statBlock}>
          <Text style={ss.statNum}>{owned.length}</Text>
          <Text style={ss.statLabel}>{owned.length === 1 ? 'zone owned' : 'zones owned'}</Text>
        </View>
        <View style={ss.statDivider} />
        <View style={ss.statBlock}>
          <Text style={ss.statNum}>{formatArea(totalAreaM2)}</Text>
          <Text style={ss.statLabel}>total claimed</Text>
        </View>
      </View>

      {/* Zone grid */}
      <View style={ss.grid}>
        {sorted.map(t => {
          const tc = TIER_CONFIG[t.tier] ?? TIER_CONFIG.patch;
          return (
            <View key={t.id} style={ss.zoneCard}>
              <View style={[ss.swatch, { backgroundColor: tc.bg }]}>
                <View style={[ss.swatchCore, { backgroundColor: tc.fg }]} />
              </View>
              <View style={[ss.tierBadge, { backgroundColor: tc.bg }]}>
                <Text style={[ss.tierBadgeText, { color: tc.fg }]}>{tc.label}</Text>
              </View>
              <Text style={ss.zoneArea}>{formatArea(t.areaM2)}</Text>
              <Text style={ss.zoneDate}>{t.claimedAt ? timeAgo(t.claimedAt) : '—'}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    empty:        { backgroundColor: C.stone, borderRadius: 14, paddingVertical: 40, paddingHorizontal: 28, alignItems: 'center', gap: 8 },
    emptyHeadline:{ fontFamily: Fonts.display, fontSize: 21, lineHeight: 26, color: C.black, textAlign: 'center' },
    emptyText:    { fontFamily: Fonts.regular, fontSize: 12.5, color: C.t2, textAlign: 'center', lineHeight: 18 },

    statRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 14, borderWidth: 0.5, borderColor: C.border, paddingVertical: 20, marginBottom: 20 },
    statBlock:   { flex: 1, alignItems: 'center' },
    statDivider: { width: 0.5, alignSelf: 'stretch', backgroundColor: C.border },
    statNum:     { fontFamily: Fonts.semiBold, fontSize: 24, color: C.red, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
    statLabel:   { fontFamily: Fonts.regular, fontSize: 11, color: C.t3, marginTop: 4 },

    grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    zoneCard:    { width: '47%', backgroundColor: C.card, borderRadius: 14, borderWidth: 0.5, borderColor: C.border, padding: 14, alignItems: 'center', gap: 6 },
    swatch:      { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    swatchCore:  { width: 18, height: 18, borderRadius: 5 },
    tierBadge:   { borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
    tierBadgeText: { fontFamily: Fonts.semiBold, fontSize: 11.5, letterSpacing: 0.4 },
    zoneArea:    { fontFamily: Fonts.medium, fontSize: 13, color: C.black, marginTop: 2 },
    zoneDate:    { fontFamily: Fonts.regular, fontSize: 11.5, color: C.t3 },
  });
}
