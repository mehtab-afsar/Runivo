import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import {
  Bell, Heart, MessageCircle, Flag, Shield, Swords, Trophy, Check, Flame, UserPlus,
  CalendarDays, Crown, Diamond, Megaphone, type LucideIcon, Hourglass, Footprints, ChartColumn, Gift,
} from 'lucide-react-native';
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

export function NotifItem({ notif, onPress, action, position = 'middle' }: Props) {
  const C = useTheme();
  const zone = territoryPalette(useIsDark());
  const s = useMemo(() => mkStyles(C), [C]);
  const { Icon, bg, fg } = tileFor(notif.type, C, zone);
  const first = position === 'first' || position === 'only';
  const last = position === 'last' || position === 'only';
  return (
    <Pressable
      style={({ pressed }) => [s.row, first && s.rowFirst, last && s.rowLast, !last && s.rowDivider, pressed && { opacity: 0.7 }]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={[s.tile, { backgroundColor: bg }]}>
        <Icon size={18} color={fg} strokeWidth={2.1} />
      </View>
      <View style={s.text}>
        <Text style={s.title} numberOfLines={2}>{notif.title}</Text>
        <Text style={s.body} numberOfLines={2}>
          {notif.body ? `${notif.body} · ` : ''}{fmtRelativeTime(notif.created_at)}
        </Text>
      </View>
      {/* Unread dot always shows for unread rows, including ones with an action button. */}
      {!notif.read ? <View style={s.dot} accessibilityLabel="Unread" /> : null}
      {action ? (
        <Pressable style={s.action} onPress={action.onPress} hitSlop={6} accessibilityRole="button">
          <Text style={s.actionText}>{action.label}</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

function mkStyles(C: AppColors) { return StyleSheet.create({
  row:        { backgroundColor: C.card, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowFirst:   { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  rowLast:    { borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: C.border },
  tile:       { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  text:       { flex: 1 },
  title:      { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1, lineHeight: 18 },
  body:       { fontFamily: Fonts.regular, fontSize: 12.5, color: C.t2, lineHeight: 17, marginTop: 2 },
  action:     { backgroundColor: C.alwaysDark, borderRadius: 999, paddingHorizontal: 12, height: 30, justifyContent: 'center' },
  actionText: { fontFamily: Fonts.semiBold, fontSize: 12.5, color: C.alwaysLight },
  dot:        { width: 7, height: 7, borderRadius: 4, backgroundColor: C.red, flexShrink: 0 },
}); }
