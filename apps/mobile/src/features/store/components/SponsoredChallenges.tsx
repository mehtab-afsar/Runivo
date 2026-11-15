/**
 * S4: brand challenges in the store — "Claim 5 zones in October", funded by a
 * brand. Join, watch progress, and get the brand's code when you finish.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Alert, Share } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme, Fonts, type AppColors } from '@theme';
import { supabase } from '@shared/services/supabase';

interface Sponsored {
  id: string; brand: string; brand_color: string | null; title: string; description: string | null;
  metric: 'distance_km' | 'zones' | 'active_days'; target: number; ends_at: string;
  reward_title: string; reward_value: string; joined: boolean; progress: number; completed: boolean; code: string | null;
}
const UNIT = { distance_km: 'km', zones: 'zones', active_days: 'days' } as const;

export function SponsoredChallenges() {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const [list, setList] = useState<Sponsored[]>([]);
  const load = useCallback(() => {
    supabase.rpc('list_sponsored_challenges').then(({ data }) => setList(((data as Sponsored[] | null) ?? []).map(x => ({ ...x, target: Number(x.target), progress: Number(x.progress) }))), () => {});
  }, []);
  useFocusEffect(load);
  if (list.length === 0) return null;

  const act = async (c: Sponsored) => {
    if (!c.joined) { await supabase.rpc('join_sponsored_challenge', { p_challenge: c.id }); load(); return; }
    if (c.code) { Share.share({ message: `${c.brand}: ${c.code}` }).catch(() => {}); return; }
    const { data, error } = await supabase.rpc('claim_sponsored_reward', { p_challenge: c.id });
    if (error) { Alert.alert('Not yet', error.message); return; }
    Alert.alert(`${c.brand} reward`, `Your code: ${data as string}`);
    load();
  };

  return (
    <View style={s.wrap}>
      <Text style={s.label}>Brand challenges</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
        {list.map(c => {
          const pct = Math.min(1, c.progress / c.target);
          const days = Math.max(0, Math.ceil((new Date(c.ends_at).getTime() - Date.now()) / 86_400_000));
          const done = c.progress >= c.target;
          return (
            <View key={c.id} style={[s.card, { borderTopColor: c.brand_color ?? C.red }]}>
              <Text style={s.brand}>{c.brand}</Text>
              <Text style={s.title} numberOfLines={2}>{c.title}</Text>
              <Text style={s.reward} numberOfLines={1}>Reward: {c.reward_value || c.reward_title}</Text>
              {c.joined && (
                <>
                  <View style={s.track}><View style={[s.fill, { width: `${Math.round(pct * 100)}%` }]} /></View>
                  <Text style={s.meta}>{c.progress} / {c.target} {UNIT[c.metric]} · {days} {days === 1 ? 'day' : 'days'} left</Text>
                </>
              )}
              {!c.joined && <Text style={s.meta}>{days} {days === 1 ? 'day' : 'days'} left</Text>}
              <Pressable hitSlop={8} style={[s.btn, (c.joined && !done && !c.code) && s.btnQuiet]} disabled={c.joined && !done && !c.code} onPress={() => act(c)} accessibilityRole="button">
                <Text style={[s.btnTxt, (c.joined && !done && !c.code) && { color: C.t2 }]}>
                  {!c.joined ? 'Join' : c.code ? `Code: ${c.code}` : done ? 'Get your reward' : 'In progress'}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function mk(C: AppColors) {
  return StyleSheet.create({
    wrap: { marginTop: 18 },
    label: { fontFamily: Fonts.semiBold, fontSize: 13, color: C.t2, paddingHorizontal: 18, marginBottom: 8 },
    row: { gap: 10, paddingHorizontal: 18 },
    card: { width: 230, backgroundColor: C.card, borderRadius: 16, padding: 14, gap: 6, borderTopWidth: 4 },
    brand: { fontFamily: Fonts.semiBold, fontSize: 12, color: C.t2 },
    title: { fontFamily: Fonts.bold, fontSize: 15, color: C.t1 },
    reward: { fontFamily: Fonts.medium, fontSize: 12.5, color: C.t1 },
    track: { height: 6, borderRadius: 3, backgroundColor: C.surface, overflow: 'hidden', marginTop: 2 },
    fill: { height: 6, borderRadius: 3, backgroundColor: C.red },
    meta: { fontFamily: Fonts.regular, fontSize: 12, color: C.t2 },
    btn: { marginTop: 4, height: 36, borderRadius: 18, backgroundColor: C.t1, alignItems: 'center', justifyContent: 'center' },
    btnQuiet: { backgroundColor: C.surface },
    btnTxt: { fontFamily: Fonts.semiBold, fontSize: 13, color: C.bg },
  });
}
