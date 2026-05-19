import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getAllTerritories } from '@shared/services/store';
import type { StoredTerritory } from '@shared/services/store';
import { supabase } from '@shared/services/supabase';
import { useTheme, type AppColors } from '@theme';

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
        <Text style={ss.emptyTitle}>No territories yet</Text>
        <Text style={ss.emptyText}>Complete your first run to claim zones and build your empire.</Text>
      </View>
    );
  }

  const sorted = [...owned].sort((a, b) => (b.claimedAt ?? 0) - (a.claimedAt ?? 0));
  const recent = sorted.slice(0, 5);

  return (
    <View>
      {/* Summary card */}
      <View style={ss.summaryCard}>
        <Text style={ss.zonesCount}>⬡ {owned.length}</Text>
        <Text style={ss.zonesLabel}>Zones owned</Text>
      </View>

      {/* Recent captures */}
      <Text style={ss.sectionLabel}>Recent captures</Text>
      <View style={ss.listCard}>
        {recent.map((t, i) => (
          <View key={t.id} style={[ss.zoneRow, i < recent.length - 1 && ss.zoneRowBorder]}>
            <Text style={ss.hexIcon}>⬡</Text>
            <View style={{ flex: 1 }}>
              <Text style={ss.zoneName}>Zone {t.id.slice(0, 8).toUpperCase()}</Text>
              <Text style={ss.zoneTier}>{t.tier ?? 'Basic'}</Text>
            </View>
            <Text style={ss.zoneTime}>{t.claimedAt ? timeAgo(t.claimedAt) : '—'}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    empty: { alignItems: 'center', paddingVertical: 40 },
    emptyTitle: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 18, color: C.black, marginBottom: 6 },
    emptyText: { fontSize: 12, color: C.t2, textAlign: 'center', lineHeight: 18 },
    summaryCard: {
      backgroundColor: C.white, borderRadius: 14, borderWidth: 0.5, borderColor: C.border,
      padding: 24, alignItems: 'center', marginBottom: 20,
    },
    zonesCount: { fontSize: 48, color: C.red, letterSpacing: -1 },
    zonesLabel: { fontWeight: '500', fontSize: 9, color: C.t3, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 4 },
    sectionLabel: {
      fontWeight: '500', fontSize: 9, color: C.t3,
      letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10,
    },
    listCard: {
      backgroundColor: C.white, borderRadius: 14, borderWidth: 0.5, borderColor: C.border, overflow: 'hidden',
    },
    zoneRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
    zoneRowBorder: { borderBottomWidth: 0.5, borderBottomColor: C.border },
    hexIcon: { fontSize: 20, color: C.red },
    zoneName: { fontWeight: '500', fontSize: 13, color: C.black },
    zoneTier: { fontSize: 11, color: C.t3, textTransform: 'capitalize' },
    zoneTime: { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t3 },
  });
}
