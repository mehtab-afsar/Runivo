import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check } from 'phosphor-react-native';
import { ACTIVE_MISSION_TEMPLATES } from '@shared/services/missions';
import { claimMissionReward } from '@shared/services/missionStore';
import { useTheme, Type, Fonts, Spacing, type AppColors } from '@theme';

interface Props {
  completedMissions: { id: string; title: string }[];
}

type RowState = 'idle' | 'claiming' | 'claimed' | 'retry';

// The run summary only carries {id, title} for a newly completed mission (see
// runNavigationHelper.ts) — reward amounts are looked up here from the template
// catalogue for display, but the actual credit is decided server-side by
// claim_mission_reward regardless of what's shown.
export default function RunSummaryMissionsCard({ completedMissions }: Props) {
  const C  = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});

  const handleClaim = useCallback(async (missionId: string) => {
    setRowStates(prev => ({ ...prev, [missionId]: 'claiming' }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await claimMissionReward(missionId);
    setRowStates(prev => ({ ...prev, [missionId]: result ? 'claimed' : 'retry' }));
    if (result) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, []);

  if (completedMissions.length === 0) return null;

  return (
    <View style={[ss.card]}>
      <Text style={ss.label}>Missions completed</Text>
      {completedMissions.map((m, i) => {
        const template = ACTIVE_MISSION_TEMPLATES.find(t => t.title === m.title);
        const pace = template?.rewards.pace ?? 0;
        const state = rowStates[m.id] ?? 'idle';
        return (
          <View key={m.id} style={[ss.row, i > 0 && ss.rowBorder]}>
            <View style={[ss.iconBox, state === 'claimed' && ss.iconBoxDone]}>
              {state === 'claimed'
                ? <Check size={14} color={C.green} weight="bold" />
                : <Text style={ss.emoji}>{template?.icon ?? '🎯'}</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ss.title}>{m.title}</Text>
              {state === 'retry' && <Text style={ss.retryHint}>Not credited yet — try again shortly</Text>}
            </View>
            {state === 'claimed' ? (
              <Text style={ss.claimedText}>+{pace} PACE</Text>
            ) : (
              <Pressable
                onPress={() => handleClaim(m.id)}
                disabled={state === 'claiming'}
                style={({ pressed }) => [ss.claimBtn, pressed && { opacity: 0.85 }]}
              >
                {state === 'claiming'
                  ? <ActivityIndicator size="small" color={C.bg} />
                  : <Text style={ss.claimBtnText}>{state === 'retry' ? 'Retry' : `Claim +${pace}`}</Text>}
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card:      { marginHorizontal: Spacing.gutter, marginBottom: 12, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 14, backgroundColor: C.card, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
    label:     { ...Type.overline, color: C.t2, marginBottom: 6 },
    row:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
    iconBox:   { width: 36, height: 36, borderRadius: 12, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
    iconBoxDone: { backgroundColor: C.greenBg },
    emoji:     { fontSize: 16 },
    title:     { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
    retryHint: { fontFamily: Fonts.regular, fontSize: 12, color: C.amber, marginTop: 2 },
    claimedText: { fontFamily: Fonts.numeric, fontSize: 18, color: C.green, fontVariant: ['tabular-nums'] },
    claimBtn:  { backgroundColor: C.t1, borderRadius: 999, paddingHorizontal: 14, height: 34, minWidth: 88, alignItems: 'center', justifyContent: 'center' },
    claimBtnText: { fontFamily: Fonts.semiBold, fontSize: 13, color: C.bg },
  });
}
