import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { supabase } from '@shared/services/supabase';
import { fetchSuggestedRunners } from '@features/social/services/feedService';
import type { SuggestedRunner } from '@features/social/types';
import { mkLobbyRooms } from '@features/clubs/screens/LobbyChatScreen';
import { Avatar } from '@mobile/shared/components/Avatar';
import { useTheme, Type, Fonts, Spacing, type AppColors } from '@theme';

interface Props {
  /** Navigates straight into LobbyChatScreen for this room id. */
  onOpenRoom:     (lobbyId: string) => void;
  /** Feed has no route param to pre-select the Discover tab today (`Feed:
   *  undefined` in RootStackParamList) — this just opens Feed on its default
   *  Following tab. Flagged back rather than half-wiring a param that isn't
   *  actually read anywhere. */
  onOpenDiscover: () => void;
}

/**
 * Surfaces two things that previously had no entry point on Home: the fixed
 * public Lobby chat rooms, and a taste of "Runners near you" (reusing
 * Discover's exact suggested-runners query — same top-territory-score list,
 * capped at 8, not a true geo count).
 */
export function CommunityPulseCard({ onOpenRoom, onOpenDiscover }: Props) {
  const C     = useTheme();
  const s     = useMemo(() => mkStyles(C), [C]);
  const rooms = useMemo(() => mkLobbyRooms(C), [C]);

  const [runners, setRunners] = useState<SuggestedRunner[]>([]);
  const [loaded, setLoaded]   = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setLoaded(true); return; }
      fetchSuggestedRunners(user.id)
        .then(setRunners)
        .catch(() => {})
        .finally(() => setLoaded(true));
    }).catch(() => setLoaded(true));
  }, []);

  return (
    <View style={s.card}>
      <Text style={s.label}>Community</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.roomScroll}>
        {rooms.map(room => (
          <Pressable key={room.id} style={s.chip} onPress={() => onOpenRoom(room.id)}>
            {/* Static presence indicator — the room is available, not a real
                online-user count. No presence-tracking backend for chat rooms
                today; that'd be a separate Realtime presence-channel feature. */}
            <View style={s.liveDot} />
            <Text style={s.chipTxt} numberOfLines={1}>{room.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loaded && runners.length > 0 && (
        <Pressable style={s.nearbyRow} onPress={onOpenDiscover}>
          <View style={s.avatarStack}>
            {runners.slice(0, 3).map((r, i) => (
              <View key={r.id} style={[s.avatarRing, i > 0 && { marginLeft: -10 }, { zIndex: 3 - i }]}>
                <Avatar name={r.username} color={r.avatarColor} uri={r.avatarUrl} size={28} />
              </View>
            ))}
          </View>
          <Text style={s.nearbyTxt}>{runners.length} runners active near you</Text>
          <ChevronRight size={15} color={C.t3} strokeWidth={2} />
        </Pressable>
      )}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card:        { marginHorizontal: Spacing.gutter, marginBottom: 28, borderRadius: 16, backgroundColor: C.card, borderWidth: 0.5, borderColor: C.border, paddingVertical: 16 },
    label:       { ...Type.overline, color: C.t3, paddingHorizontal: 16, marginBottom: 12 },

    roomScroll:  { paddingHorizontal: 16, gap: 10 },
    chip:        { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.stone, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 0.5, borderColor: C.border },
    liveDot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
    chipTxt:     { fontFamily: Fonts.medium, fontSize: 12.5, color: C.t1 },

    nearbyRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, paddingHorizontal: 16, paddingTop: 14, borderTopWidth: 0.5, borderTopColor: C.border },
    avatarStack: { flexDirection: 'row', alignItems: 'center' },
    avatarRing:  { borderRadius: 16, borderWidth: 2, borderColor: C.card },
    nearbyTxt:   { ...Type.bodySm, color: C.t1, flex: 1 },
  });
}
