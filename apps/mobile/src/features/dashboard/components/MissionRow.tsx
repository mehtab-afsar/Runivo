import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Route, Flag, Shield, Zap, Flame, UtensilsCrossed, Check, Diamond, type LucideIcon,
} from 'lucide-react-native';
import { MISSION_SOURCE_LABEL, type Mission, type MissionType } from '@shared/services/missions';
import { useTheme, Type, Fonts, type AppColors } from '@theme';
import { PrimaryButton } from '@mobile/shared/components/PrimaryButton';

// Same type→accent mapping as the full Missions screen — kept in sync by eye
// since it's plain data, not worth a shared cross-platform export for 8 lines.
// capture_enemy/speed_run/defend_zone/steal_rival/run_streak can't currently
// reach a real user (see missions.ts's ACTIVE_MISSION_TEMPLATES filter) but
// keep an icon entry each so this map stays exhaustive if that ever changes.
const mkTypeIcon = (C: AppColors): Record<MissionType, { Icon: LucideIcon; color: string }> => ({
  run_distance:      { Icon: Route,           color: C.t1 },
  claim_territories: { Icon: Flag,             color: C.red },
  capture_enemy:     { Icon: Shield,           color: C.green },
  speed_run:         { Icon: Zap,              color: C.red },
  run_streak:        { Icon: Flame,            color: C.orange },
  defend_zone:       { Icon: Shield,           color: C.blue },
  steal_rival:       { Icon: Zap,              color: C.red },
  nutrition_streak:  { Icon: UtensilsCrossed,  color: C.orange },
});

interface Props {
  mission: Mission;
  isLast?: boolean;
  onClaim?: (missionId: string) => Promise<unknown>;
  /** Optional — when provided, the name/caption area becomes tappable (used by
   *  the full Missions screen to open the swap picker; the Dashboard widget
   *  doesn't pass this, so it stays a plain row there). */
  onPress?: () => void;
}

function RewardChip({ pace, muted, C, ss }: { pace: number; muted: boolean; C: AppColors; ss: ReturnType<typeof mkStyles> }) {
  return (
    <View style={[ss.chip, muted && ss.chipMuted]}>
      <Diamond size={10} color={muted ? C.t3 : C.gold} strokeWidth={2} fill={muted ? 'none' : C.gold} />
      <Text style={[ss.chipTxt, muted && ss.chipTxtMuted]}>{pace}</Text>
    </View>
  );
}

/** Soft tile behind a mission icon, as in the mock (red → peach, blue → lavender, ink → stone). */
function tintFor(color: string, C: AppColors): string {
  if (color === C.red) return C.redLo;
  if (color === C.blue) return '#E5EAFF';
  return '#F0EEE9';
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Unit after the progress numbers, as in the mock ("3.1 / 5 km", "0 / 1 zone"). */
function unitFor(type: MissionType, target: number): string {
  if (type === 'run_distance') return ' km';
  if (type === 'claim_territories' || type === 'defend_zone' || type === 'steal_rival' || type === 'capture_enemy') {
    return target === 1 ? ' zone' : ' zones';
  }
  if (type === 'run_streak' || type === 'nutrition_streak') return target === 1 ? ' day' : ' days';
  return '';
}

// Memoised: one per daily mission, re-rendered by unrelated Dashboard state.
export const MissionRow = React.memo(function MissionRow({ mission: m, isLast, onClaim, onPress }: Props) {
  const C        = useTheme();
  const ss       = useMemo(() => mkStyles(C), [C]);
  const TYPE_ICON = useMemo(() => mkTypeIcon(C), [C]);
  const pct      = Math.min(m.current / Math.max(m.target, 1), 1);
  const claimable = m.completed && !m.claimed && !!onClaim;
  const [claiming, setClaiming] = useState(false);
  const [justMissed, setJustMissed] = useState(false);

  const { Icon: MIcon, color } = TYPE_ICON[m.type] ?? { Icon: Route, color: C.red };

  const handleClaim = useCallback(async () => {
    if (!onClaim || claiming) return;
    setClaiming(true);
    setJustMissed(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await onClaim(m.id);
    setClaiming(false);
    if (!result) {
      // Verification hasn't caught up yet (e.g. run still syncing) or the
      // weekly cap is already hit — stays unclaimed so this can be retried.
      setJustMissed(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, [onClaim, claiming, m.id]);

  return (
    <View style={[ss.row, !isLast && ss.rowBorder, m.claimed && ss.rowClaimed]}>
      <View style={[ss.iconBadge, { backgroundColor: m.claimed ? C.stone : tintFor(color, C) }]}>
        {m.claimed
          ? <Check size={14} color={C.t3} strokeWidth={2.5} />
          : <MIcon size={16} color={color} strokeWidth={1.8} />}
      </View>

      <Pressable style={ss.body} onPress={onPress} disabled={!onPress}>
        <View style={ss.titleRow}>
          <Text style={[ss.title, m.claimed && ss.titleDone]} numberOfLines={1}>{m.title}</Text>
          {!m.claimed && !claimable && (
            <Text style={ss.progressText}>{fmt(m.current)} / {fmt(m.target)}{unitFor(m.type, m.target)}</Text>
          )}
        </View>

        {m.claimed ? (
          <Text style={ss.caption}>Claimed</Text>
        ) : claimable ? (
          <Text style={justMissed ? ss.retryCaption : ss.readyCaption}>
            {justMissed ? 'Not yet — try again shortly' : 'Ready to claim'}
          </Text>
        ) : (
          <View style={ss.track} accessibilityLabel={MISSION_SOURCE_LABEL[m.type]}>
            <View style={[ss.fill, { width: `${pct * 100}%` }]} />
          </View>
        )}
      </Pressable>

      {claimable ? (
        <PrimaryButton
          label="Claim"
          onPress={handleClaim}
          loading={claiming}
          variant="dark"
          size="sm"
          style={ss.claimBtn}
        />
      ) : m.claimed ? (
        <RewardChip pace={m.rewards.pace} muted C={C} ss={ss} />
      ) : null}
    </View>
  );
});

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    row:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
    rowBorder:  { borderBottomWidth: 1, borderBottomColor: C.border },
    rowClaimed: { opacity: 0.55 },

    iconBadge:  { width: 34, height: 34, borderRadius: 10, backgroundColor: C.stone, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

    body:       { flex: 1 },
    titleRow:   { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
    title:      { fontFamily: Fonts.semiBold, fontSize: 14, lineHeight: 18, color: C.t1, flexShrink: 1 },
    progressText: { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, fontVariant: ['tabular-nums'] },
    titleDone:  { color: C.t3, textDecorationLine: 'line-through' },
    caption:    { ...Type.labelSm, color: C.t3, marginTop: 4 },
    readyCaption: { ...Type.labelSm, color: C.gold },
    retryCaption: { ...Type.labelSm, color: C.retryAmber },

    track:      { height: 6, borderRadius: 9, backgroundColor: '#ECEAE5', overflow: 'hidden' },
    fill:       { height: 6, borderRadius: 9, backgroundColor: C.t1 },

    claimBtn:   { height: 32, paddingHorizontal: 16, minHeight: 0 },

    chip:       { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.goldBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
    chipMuted:  { backgroundColor: C.stone },
    chipTxt:    { ...Type.labelSm, fontFamily: Fonts.semiBold, color: C.gold, fontVariant: ['tabular-nums'] },
    chipTxtMuted: { color: C.t3 },
  });
}
