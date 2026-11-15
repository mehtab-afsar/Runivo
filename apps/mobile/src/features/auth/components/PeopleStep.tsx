import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Share, ActivityIndicator } from 'react-native';
import { Users, Share2, Check } from '@mobile/shared/icons/lucideCompat';
import { supabase } from '@shared/services/supabase';
import { track } from '@shared/services/analytics';
import { fetchClubsNear, joinClub, lastKnownPositionIfAllowed, requestToJoinClub } from '@features/clubs/services/clubService';
import { clubMetaLine, clubsSectionTitle } from '@shared/engine/clubsNear';
import type { Club } from '@features/clubs/types';
import { useTheme } from '@theme';
import { mkStep } from './onboardingStyles';

/** Find your people: clubs to join and an invite link. Mutual follows unlock the live friend map. */
export default function PeopleStep({ username }: { username: string }) {
  const C = useTheme();
  const s = useMemo(() => mkStep(C), [C]);
  const [clubs, setClubs] = useState<Club[] | null>(null);
  const [nearby, setNearby] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, 'joined' | 'requested' | 'busy'>>({});

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      // Location was asked for two steps back; use it only if it was allowed.
      const position = await lastKnownPositionIfAllowed();
      const result = await fetchClubsNear(position, 4);
      setNearby(result.nearby);
      setClubs(result.clubs.slice(0, 4));
    })().catch(() => setClubs([]));
  }, []);

  async function join(club: Club) {
    if (!userId || status[club.id]) return;
    const set = (v: 'joined' | 'requested' | 'busy' | null) => setStatus(prev => {
      const next = { ...prev };
      if (v) next[club.id] = v; else delete next[club.id];
      return next;
    });
    set('busy');
    if (club.join_policy === 'open') {
      const { error } = await joinClub(club.id, userId);
      set(error ? null : 'joined');
    } else {
      const { ok } = await requestToJoinClub(club.id, userId);
      set(ok ? 'requested' : null);
    }
    track('onboarding_club_join', { policy: club.join_policy });
  }

  async function invite() {
    const link = `https://runivo.app/invite${username ? `?from=${encodeURIComponent(username)}` : ''}`;
    track('onboarding_invite_shared');
    await Share.share({ message: `Run with me on Runivo. Close a loop and the streets inside are yours. ${link}` }).catch(() => {});
  }

  return (
    <ScrollView contentContainerStyle={s.content}>
      <Text style={s.eyebrow}>Optional</Text>
      <Text style={s.title}>Find your{'\n'}people</Text>
      <Text style={s.sub}>Running is better together. Friends who follow you back show up live on your map.</Text>

      <Pressable style={[s.card, s.cardOn]} onPress={invite} accessibilityRole="button">
        <View style={[s.cardIcon, s.cardIconOn]}><Share2 size={22} color={C.red} strokeWidth={2} /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle}>Invite friends</Text>
          <Text style={s.cardSub}>Send a link by WhatsApp, message or email</Text>
        </View>
      </Pressable>

      <Text style={[s.label, { marginTop: 14 }]}>{clubsSectionTitle(nearby)}</Text>
      {clubs == null && <ActivityIndicator color={C.red} style={{ marginTop: 12 }} />}
      {clubs?.length === 0 && <Text style={s.note}>No clubs yet. You can start one from the Clubs tab later.</Text>}
      {clubs?.map(club => {
        const st = club.joined ? 'joined' : status[club.id];
        return (
          <View key={club.id} style={s.card}>
            <View style={s.cardIcon}><Users size={20} color={C.t1} strokeWidth={2} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle} numberOfLines={1}>{club.name}</Text>
              <Text style={s.cardSub} numberOfLines={1}>{clubMetaLine(club)}</Text>
            </View>
            <Pressable
              onPress={() => join(club)}
              disabled={!!st}
              style={[s.chip, st === 'joined' || st === 'requested' ? s.chipOn : null]}
              accessibilityRole="button"
            >
              {st === 'busy' ? <ActivityIndicator color={C.t1} />
                : st === 'joined' ? <Check size={16} color={C.alwaysLight} strokeWidth={2.6} />
                : <Text style={[s.chipText, st === 'requested' && s.chipTextOn]}>{st === 'requested' ? 'Asked' : club.join_policy === 'open' ? 'Join' : 'Ask'}</Text>}
            </Pressable>
          </View>
        );
      })}
    </ScrollView>
  );
}
