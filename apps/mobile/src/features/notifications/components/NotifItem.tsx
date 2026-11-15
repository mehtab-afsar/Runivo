import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import {
  Bell, Heart, MessageCircle, Flag, Shield, Swords, Trophy, Check, Flame, UserPlus,
  CalendarDays, Crown, Diamond, Megaphone, type LucideIcon, Hourglass, Footprints, ChartColumn, Gift,
} from '@mobile/shared/icons/lucideCompat';
import { fmtRelativeTime } from '@mobile/shared/lib/formatters';
import type { AppNotification } from '../types';
import { useTheme, useIsDark, Fonts, type AppColors } from '@theme';
import { territoryPalette, type TerritoryPalette } from '@theme/territory';

export interface NotifAction { label: string; onPress: () => void }

interface Props {
  notif: AppNotification;
  onPress: () => void;
  /** Optional button on the right (Follow, Defend, Take back). */
  action?: NotifAction;
  /** Where the row sits in the grouped card. */
  position?: 'first' | 'middle' | 'last' | 'only';
}

/** Square tile per type, like the mock: solid for territory and rank, soft for the rest. */
function tileFor(type: string, C: AppColors, z: TerritoryPalette): { Icon: LucideIcon; bg: string; fg: string } {
  switch (type) {
    case 'territory_lost':
    case 'zone_attacked':      return { Icon: Shield, bg: z.rival, fg: C.alwaysLight };
    case 'territory_claimed':
    case 'territory_captured': return { Icon: Flag, bg: z.own, fg: C.alwaysLight };
    case 'challenge':          return { Icon: Swords, bg: z.rival, fg: C.alwaysLight };
    case 'zone_fading':        return { Icon: Hourglass, bg: C.redLo, fg: z.ownFading };
    case 'rank_up':            return { Icon: Crown, bg: C.alwaysDark, fg: C.alwaysLight };
    case 'achievement':        return { Icon: Trophy, bg: C.alwaysDark, fg: C.alwaysLight };
    case 'mission_complete':   return { Icon: Check, bg: C.redLo, fg: C.red };
    case 'kudos':              return { Icon: Heart, bg: C.redLo, fg: C.red };
    case 'comment':            return { Icon: MessageCircle, bg: C.bg, fg: C.t1 };
    case 'follow':             return { Icon: UserPlus, bg: C.bg, fg: C.t1 };
    case 'new_event':
    case 'event_reminder':     return { Icon: CalendarDays, bg: C.bg, fg: C.t1 };
    case 'streak':
    case 'streak_risk':        return { Icon: Flame, bg: C.redLo, fg: C.red };
    case 'run_reminder':       return { Icon: Footprints, bg: C.redLo, fg: C.red };
    case 'weekly_summary':     return { Icon: ChartColumn, bg: C.bg, fg: C.t1 };
    case 'pace_cap_near':
    case 'pace_cap':           return { Icon: Diamond, bg: C.redLo, fg: C.red };
    case 'campaign':           return { Icon: Gift, bg: C.red, fg: C.alwaysLight };
    case 'system':             return { Icon: Megaphone, bg: C.bg, fg: C.t2 };
    default:                   return { Icon: Bell, bg: C.bg, fg: C.t2 };
  }
}

/** Mock: each notification is its own rounded card; steals amber, ranks dark, the rest soft grey. */
function cardFor(type: string, C: AppColors): { bg: string; fg: string; sub: string; dot: string } {
  if (type === 'territory_lost' || type === 'zone_attacked') return { bg: C.amberBg, fg: C.t1, sub: '#5C4320', dot: C.rivalAmber };
  if (type === 'rank_up' || type === 'achievement') return { bg: C.alwaysDark, fg: C.alwaysLight, sub: '#C9CCC4', dot: C.lime };
  return { bg: C.bg, fg: C.t1, sub: C.t2, dot: C.t1 };
}

export function NotifItem({ notif, onPress, action, position = 'middle' }: Props) {
  const C = useTheme();
  const zone = territoryPalette(useIsDark());
  const s = useMemo(() => mkStyles(C), [C]);
  const { Icon } = tileFor(notif.type, C, zone);
  const card = cardFor(notif.type, C);
  const tileBg = notif.type === 'territory_lost' || notif.type === 'zone_attacked' ? C.rivalAmber
    : notif.type === 'rank_up' || notif.type === 'achievement' ? C.lime
    : notif.type === 'territory_claimed' || notif.type === 'territory_captured' || notif.type === 'kudos' ? C.mint2 : C.lavender;
  const tileFg = notif.type === 'rank_up' || notif.type === 'achievement' || notif.type === 'territory_lost' || notif.type === 'zone_attacked' ? '#17181A'
    : tileBg === C.mint2 ? C.green : C.lavenderInk;
  void position;
  return (
    <Pressable
      style={({ pressed }) => [s.row, { backgroundColor: card.bg }, pressed && { opacity: 0.8 }]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={[s.tile, { backgroundColor: tileBg }]}>
        <Icon size={20} color={tileFg} strokeWidth={2.1} />
      </View>
      <View style={s.text}>
        <Text style={[s.title, { color: card.fg }]} numberOfLines={2}>{notif.title}</Text>
        {!!notif.body && <Text style={[s.body, { color: card.sub }]} numberOfLines={2}>{notif.body}</Text>}
        <Text style={[s.time, { color: card.sub }]}>{fmtRelativeTime(notif.created_at)}</Text>
        {action ? (
          <Pressable style={[s.action, card.bg === C.alwaysDark && { backgroundColor: C.lime }]} onPress={action.onPress} hitSlop={6} accessibilityRole="button">
            <Text style={[s.actionText, card.bg === C.alwaysDark && { color: '#17181A' }]}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
      {!notif.read ? <View style={[s.dot, { backgroundColor: card.dot }]} accessibilityLabel="Unread" /> : null}
    </Pressable>
  );
}

function mkStyles(C: AppColors) { return StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 24, marginBottom: 10 },
  tile:       { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  text:       { flex: 1, gap: 2 },
  title:      { fontFamily: Fonts.medium, fontSize: 15, lineHeight: 20 },
  body:       { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 19 },
  time:       { fontFamily: Fonts.regular, fontSize: 12, marginTop: 1 },
  action:     { alignSelf: 'flex-start', marginTop: 8, backgroundColor: C.alwaysDark, borderRadius: 17, paddingHorizontal: 14, height: 34, justifyContent: 'center' },
  actionText: { fontFamily: Fonts.semiBold, fontSize: 13, color: C.alwaysLight },
  dot:        { width: 9, height: 9, borderRadius: 5, marginTop: 6, flexShrink: 0 },
}); }
