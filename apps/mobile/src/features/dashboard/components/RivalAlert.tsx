/**
 * Home: the latest zone a rival took from you in the last day, as the mock's
 * dark card with a lime Defend button. Hidden when nothing was taken.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useTheme, Fonts, type AppColors } from '@theme';
import { supabase } from '@shared/services/supabase';
import { routeNotificationUrl } from '@features/notifications/services/notificationHandler';

type Nav = NativeStackNavigationProp<RootStackParamList>;
interface Lost { id: string; title: string; body: string; created_at: string; action_url?: string }

function ago(iso: string): string {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
}

export function RivalAlert() {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const navigation = useNavigation<Nav>();
  const [lost, setLost] = useState<Lost | null>(null);

  useFocusEffect(useCallback(() => {
    let live = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const since = new Date(Date.now() - 86_400_000).toISOString();
      const { data } = await supabase.from('notifications')
        .select('id, title, body, created_at, action_url')
        .eq('user_id', session.user.id).eq('type', 'territory_lost')
        .gte('created_at', since).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (live) setLost((data as Lost | null) ?? null);
    })().catch(() => {});
    return () => { live = false; };
  }, []));

  if (!lost) return null;
  const defend = () => (lost.action_url
    ? routeNotificationUrl(lost.action_url, navigation)
    : navigation.navigate('TerritoryMap', { initialFilter: 'stale' }));
  return (
    <View style={s.card}>
      <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
        <Path d="M12 3 19.8 7.5v9L12 21l-7.8-4.5v-9Z" fill="#F2A43A" stroke="#F2A43A" strokeWidth={1.6} strokeLinejoin="round" />
      </Svg>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.title} numberOfLines={2}>{lost.title}</Text>
        <Text style={s.sub} numberOfLines={1}>{lost.body ? `${lost.body} · ` : ''}{ago(lost.created_at)}</Text>
      </View>
      <Pressable style={s.btn} onPress={defend} accessibilityRole="button" hitSlop={6}>
        <Text style={s.btnTxt}>Defend</Text>
      </Pressable>
    </View>
  );
}

function mk(C: AppColors) {
  return StyleSheet.create({
    card:   { borderRadius: 28, backgroundColor: C.alwaysDark, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
    title:  { fontFamily: Fonts.medium, fontSize: 16, color: C.alwaysLight },
    sub:    { fontFamily: Fonts.regular, fontSize: 13, color: '#C9CCC4' },
    btn:    { height: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: C.lime, justifyContent: 'center' },
    btnTxt: { fontFamily: Fonts.semiBold, fontSize: 14, color: C.alwaysDark },
  });
}
