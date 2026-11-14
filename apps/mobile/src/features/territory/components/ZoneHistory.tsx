/** M4 + B5: who held this ground, when it changed hands, and its legend. */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Crown } from 'phosphor-react-native';
import { supabase } from '@shared/services/supabase';
import { useTheme, Fonts, type AppColors } from '@theme';

interface Ev { kind: 'claimed' | 'stolen' | 'defended'; user_id: string; username: string; prev_username: string | null; at: string; is_legend: boolean; legend_defences: number }

function ago(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d < 30 ? `${d}d ago` : `${Math.floor(d / 30)}mo ago`;
}

export function ZoneHistory({ zoneId }: { zoneId: string }) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const [events, setEvents] = useState<Ev[] | null>(null);
  useEffect(() => {
    let live = true;
    supabase.rpc('get_zone_history', { p_zone: zoneId }).then(({ data }) => { if (live) setEvents((data as Ev[] | null) ?? []); }, () => { if (live) setEvents([]); });
    return () => { live = false; };
  }, [zoneId]);
  if (!events || events.length === 0) return null;

  const legend = events.find(e => e.is_legend);
  // Collapse runs of defences into the latest one so changes of hands stand out.
  const shown: Ev[] = [];
  for (const e of events) {
    const last = shown[shown.length - 1];
    if (last && last.kind === 'defended' && e.kind === 'defended' && last.user_id === e.user_id) continue;
    shown.push(e);
    if (shown.length === 3) break;
  }
  const line = (e: Ev) => e.kind === 'stolen'
    ? `${e.username} took it${e.prev_username ? ` from ${e.prev_username}` : ''}`
    : e.kind === 'claimed' ? `${e.username} claimed it` : `${e.username} defended it`;

  return (
    <View style={s.wrap}>
      {legend && legend.legend_defences > 0 && (
        <View style={s.legend}>
          <Crown size={16} color={C.red} weight="fill" />
          <Text style={s.legendTxt} numberOfLines={1}>
            <Text style={s.legendName}>{legend.username}</Text> is the legend here · {legend.legend_defences} {legend.legend_defences === 1 ? 'defence' : 'defences'} in 90 days
          </Text>
        </View>
      )}
      {shown.map((e, i) => (
        <View key={i} style={s.row}>
          <View style={[s.dot, e.kind === 'stolen' && { backgroundColor: C.red }]} />
          <Text style={s.rowTxt} numberOfLines={1}>{line(e)}</Text>
          <Text style={s.when}>{ago(e.at)}</Text>
        </View>
      ))}
    </View>
  );
}

function mk(C: AppColors) {
  return StyleSheet.create({
    wrap: { marginBottom: 14, gap: 6 },
    legend: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.redLo, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
    legendTxt: { flex: 1, fontFamily: Fonts.regular, fontSize: 12.5, color: C.t1 },
    legendName: { fontFamily: Fonts.semiBold },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.t3 },
    rowTxt: { flex: 1, fontFamily: Fonts.regular, fontSize: 12.5, color: C.t2 },
    when: { fontFamily: Fonts.regular, fontSize: 12, color: C.t3 },
  });
}
