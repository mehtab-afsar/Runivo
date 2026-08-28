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
  run_distance:      { Icon: Route,           color: C.red },
  claim_territories: { Icon: Flag,             color: C.gold },
  capture_enemy:     { Icon: Shield,           color: C.green },
  speed_run:         { Icon: Zap,              color: C.red },
  run_streak:        { Icon: Flame,            color: C.orange },
  defend_zone:       { Icon: Shield,           color: C.green },
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
      <View style={ss.iconBadge}>
        {m.claimed
          ? <Check size={14} color={C.t3} strokeWidth={2.5} />
          : <MIcon size={15} color={color} strokeWidth={2} />}
      </View>

      <Pressable style={ss.body} onPress={onPress} disabled={!onPress}>
        <Text style={[ss.title, m.claimed && ss.titleDone]}>{m.title}</Text>

        {m.claimed ? (
          <Text style={ss.caption}>Claimed</Text>
        ) : claimable ? (
          <Text style={justMissed ? ss.retryCaption : ss.readyCaption}>
            {justMissed ? 'Not yet — try again shortly' : 'Ready to claim'}
          </Text>
        ) : (
          <>
            <View style={ss.track}>
              <View style={[ss.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
            </View>
            <Text style={ss.caption}>
              {m.current} / {m.target} · {MISSION_SOURCE_LABEL[m.type]}
            </Text>
          </>
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
      ) : (
        <RewardChip pace={m.rewards.pace} muted={m.claimed} C={C} ss={ss} />
      )}
    </View>
  );
});

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    row:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 14, marginBottom: 14 },
    rowBorder:  { borderBottomWidth: 0.5, borderBottomColor: C.border },
    rowClaimed: { opacity: 0.55 },

    iconBadge:  { width: 36, height: 36, borderRadius: 10, backgroundColor: C.stone, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

    body:       { flex: 1 },
    title:      { ...Type.bodySm, fontFamily: Fonts.medium, color: C.t1, marginBottom: 4 },
    titleDone:  { color: C.t3, textDecorationLine: 'line-through' },
    caption:    { ...Type.labelSm, color: C.t3, marginTop: 4 },
    readyCaption: { ...Type.labelSm, color: C.gold },
    retryCaption: { ...Type.labelSm, color: C.retryAmber },

    track:      { height: 3, borderRadius: 1.5, backgroundColor: C.border, overflow: 'hidden' },
    fill:       { height: 3, borderRadius: 1.5 },

    claimBtn:   { height: 32, paddingHorizontal: 16, minHeight: 0 },

    chip:       { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.goldBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
    chipMuted:  { backgroundColor: C.stone },
    chipTxt:    { ...Type.labelSm, fontFamily: Fonts.semiBold, color: C.gold, fontVariant: ['tabular-nums'] },
    chipTxtMuted: { color: C.t3 },
  });
}
