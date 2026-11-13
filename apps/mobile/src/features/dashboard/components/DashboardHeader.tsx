import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Flame, MapPin, Bell, Crown } from 'lucide-react-native';
import { useTheme, Type, Fonts, type AppColors } from '@theme';
import { Avatar } from '@mobile/shared/components/Avatar';

interface Props {
  greeting:       string;
  username:       string;
  streakDays:     number;
  territoryScore: number;
  isPremium:      boolean;
  unreadCount:    number;
  onAvatarPress:  () => void;
  onPlusPress:    () => void;
  onBellPress:    () => void;
}

/**
 * Presentation-only — greeting/username/streak/territory-score/unread-count and
 * every onPress all come from the caller (DashboardScreen), which still owns all
 * data-fetching and the underlying streak/territory/notification logic.
 */
export function DashboardHeader({
  greeting, username, streakDays, territoryScore, isPremium, unreadCount,
  onAvatarPress, onPlusPress, onBellPress,
}: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);

  return (
    <View style={s.header}>
      {/* Left: avatar + greeting/name */}
      <View style={s.left}>
        <Avatar name={username} size={36} onPress={onAvatarPress} />
        <View style={s.nameStack}>
          <Text style={s.greeting}>{greeting}</Text>
          <Text style={s.username}>{username}</Text>
        </View>
      </View>

      {/* Right: grouped stat pill · bell · Plus */}
      <View style={s.right}>
        <View style={s.statPill}>
          <View style={s.statSeg}>
            <Flame size={12} color={streakDays > 0 ? C.red : C.t3} strokeWidth={2} fill={streakDays > 0 ? C.red : 'none'} />
            <Text style={s.statTxt}>{streakDays}</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statSeg}>
            <MapPin size={12} color={C.t2} strokeWidth={2} />
            <Text style={s.statTxt}>{territoryScore.toLocaleString()}</Text>
            <Text style={s.statSup}>TS</Text>
          </View>
        </View>

        <Pressable onPress={onBellPress} style={s.bellBtn} hitSlop={4}>
          <Bell size={14} color={unreadCount > 0 ? C.red : C.t3} strokeWidth={2} />
          {unreadCount > 0 && <View style={s.bellDot} />}
        </Pressable>

        {/* Runivo Plus — always-visible entry point to the paywall/plan screen,
            not buried in Settings. Solid gold once subscribed, soft gold outline
            as an upsell otherwise. */}
        <Pressable onPress={onPlusPress} style={[s.plusPill, isPremium ? s.plusPillActive : s.plusPillUpsell]}>
          <Crown
            size={12}
            color={isPremium ? C.alwaysLight : C.gold}
            fill={isPremium ? C.alwaysLight : 'none'}
            strokeWidth={2}
          />
          <Text style={[s.plusTxt, { color: isPremium ? C.alwaysLight : C.gold }]}>Plus</Text>
        </Pressable>
      </View>
    </View>
  );
}

// Type-scale rules: no bare fontWeight (system-font leak next to Barlow), no text
// below the 10px overline floor except the 9px bell/stat count badges.
function mkStyles(C: AppColors) {
  return StyleSheet.create({
    header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 24, marginBottom: 22, gap: 12 },

    left:           { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    nameStack:      { flex: 1 },
    greeting:       { ...Type.overline, color: C.t3, marginBottom: 5 },
    username:       { fontFamily: Fonts.display, fontSize: 30, color: C.t1, lineHeight: 34 },

    right:          { flexDirection: 'row', alignItems: 'center', gap: 8 },

    statPill:       { flexDirection: 'row', alignItems: 'center', height: 32, paddingHorizontal: 10, backgroundColor: C.card, borderWidth: 0.5, borderColor: C.border, borderRadius: 16 },
    statSeg:        { flexDirection: 'row', alignItems: 'center', gap: 4 },
    statDivider:    { width: 0.5, height: 16, backgroundColor: C.border, marginHorizontal: 9 },
    statTxt:        { ...Type.metricSm, fontSize: 13, color: C.t1 },
    statSup:        { fontFamily: Fonts.medium, fontSize: 11, color: C.t3, letterSpacing: 0.4, marginTop: 2, marginLeft: 1 },

    bellBtn:        { width: 32, height: 32, borderRadius: 16, backgroundColor: C.card, borderWidth: 0.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    bellDot:        { position: 'absolute', top: 7, right: 8, width: 6, height: 6, borderRadius: 3, backgroundColor: C.red, borderWidth: 1, borderColor: C.card },

    plusPill:       { flexDirection: 'row', alignItems: 'center', gap: 4, height: 32, paddingHorizontal: 12, borderRadius: 16, borderWidth: 0.5 },
    plusPillActive: { backgroundColor: C.gold, borderColor: C.gold },
    plusPillUpsell: { backgroundColor: C.goldBg, borderColor: 'rgba(212,162,0,0.35)' },
    plusTxt:        { fontFamily: Fonts.semiBold, fontSize: 12 },
  });
}
