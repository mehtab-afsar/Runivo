import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';
import { TrendUp, Fire, Target, Check, Shield, Lightning, ForkKnife, type Icon } from 'phosphor-react-native';
import { MISSION_SOURCE_LABEL, type Mission } from '@shared/services/missions';
import { useTheme, Type, Fonts, type AppColors } from '@theme';
import { MissionRing } from '@features/missions/components/MissionRing';

const GLOW = '#6DE8A8';

// Same type→accent mapping as the full Missions screen — kept in sync by eye
// since it's plain data, not worth a shared cross-platform export for 8 lines.
const mkTypeIcon = (C: AppColors): Record<string, { Icon: Icon; color: string }> => ({
  run_distance:      { Icon: TrendUp,    color: C.red },
  claim_territories: { Icon: Lightning,  color: C.gold },
  capture_enemy:     { Icon: Shield,     color: C.green },
  speed_run:         { Icon: TrendUp,    color: C.red },
  run_streak:        { Icon: Fire,       color: C.orange },
  defend_zone:       { Icon: Shield,     color: C.green },
  steal_rival:       { Icon: Lightning,  color: C.red },
  nutrition_streak:  { Icon: ForkKnife,  color: C.orange },
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

// Memoised: one per daily mission, re-rendered by unrelated Dashboard state.
export const MissionRow = React.memo(function MissionRow({ mission: m, isLast, onClaim, onPress }: Props) {
  const C        = useTheme();
  const ss       = useMemo(() => mkStyles(C), [C]);
  const TYPE_ICON = useMemo(() => mkTypeIcon(C), [C]);
  const pct      = Math.min(m.current / Math.max(m.target, 1), 1);
  const claimable = m.completed && !m.claimed && !!onClaim;
  const [claiming, setClaiming] = useState(false);
  const [justMissed, setJustMissed] = useState(false);

  const { Icon: MIcon, color } = TYPE_ICON[m.type] ?? { Icon: Target, color: C.red };
  const ringColor = m.claimed ? GLOW : m.completed ? GLOW : color;

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
    <View style={[ss.row, !isLast && ss.rowBorder]}>
      <MissionRing pct={pct} color={ringColor} size={38}>
        {m.claimed
          ? <Check size={12} color={GLOW} weight="bold" />
          : <MIcon size={13} color={ringColor} weight="light" />}
      </MissionRing>
      <Pressable style={{ flex: 1 }} onPress={onPress} disabled={!onPress}>
        <Text style={[ss.title, m.claimed && ss.titleDone]}>{m.title}</Text>
        {claimable ? (
          <Text style={ss.claimHint}>{justMissed ? 'Not yet — try again shortly' : '● Ready to claim'}</Text>
        ) : (
          !m.claimed && <Text style={ss.source}>{MISSION_SOURCE_LABEL[m.type]}</Text>
        )}
      </Pressable>
      {claimable ? (
        <Pressable
          onPress={handleClaim}
          disabled={claiming}
          style={({ pressed }) => [ss.claimBtn, pressed && { opacity: 0.85 }]}
        >
          {claiming
            ? <ActivityIndicator size="small" color={C.alwaysDark} />
            : <Text style={ss.claimBtnText}>Claim +{m.rewards.pace}</Text>}
        </Pressable>
      ) : (
        <Text style={[ss.xp, m.claimed && ss.xpDone]}>+{m.rewards.pace} PACE</Text>
      )}
    </View>
  );
});

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    row:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 14, marginBottom: 14 },
    rowBorder:  { borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.08)' },
    // Sits on the always-dark mission card, so the title must be a fixed-light token —
    // C.bg inverts to near-black in dark mode and vanishes against the card.
    title:      { ...Type.bodySm, color: C.alwaysLight, marginBottom: 4 },
    titleDone:  { color: 'rgba(255,255,255,0.35)', textDecorationLine: 'line-through' },
    source:     { fontFamily: Fonts.regular, fontSize: 9.5, color: 'rgba(255,255,255,0.4)' },
    xp:         { ...Type.labelSm, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
    xpDone:     { color: C.green },
    claimHint:  { ...Type.labelSm, color: GLOW },
    claimBtn:   { backgroundColor: C.alwaysLight, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 7, minWidth: 78, alignItems: 'center' },
    claimBtnText: { fontFamily: Fonts.semiBold, fontSize: 11, color: C.alwaysDark, letterSpacing: 0.3 },
  });
}
