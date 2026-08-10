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
      <Text style={ss.label}>MISSIONS COMPLETED</Text>
      {completedMissions.map((m, i) => {
        const template = ACTIVE_MISSION_TEMPLATES.find(t => t.title === m.title);
        const pace = template?.rewards.pace ?? 0;
        const state = rowStates[m.id] ?? 'idle';
        return (
          <View key={m.id} style={[ss.row, i > 0 && ss.rowBorder]}>
            <View style={[ss.iconBox, state === 'claimed' && ss.iconBoxDone]}>
              {state === 'claimed'
                ? <Check size={14} color="#6DE8A8" weight="bold" />
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
                  ? <ActivityIndicator size="small" color={C.alwaysDark} />
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
    card:      { marginHorizontal: Spacing.gutter, marginBottom: 12, borderRadius: 12, padding: 16, backgroundColor: C.alwaysDark },
    label:     { ...Type.overline, letterSpacing: 1.5, color: 'rgba(255,255,255,0.45)', marginBottom: 10 },
    row:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    rowBorder: { borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.08)' },
    iconBox:   { width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
    iconBoxDone: { backgroundColor: 'rgba(26,107,64,0.3)' },
    emoji:     { fontSize: 14 },
    title:     { fontFamily: Fonts.medium, fontSize: 13, color: C.alwaysLight },
    retryHint: { fontFamily: Fonts.light, fontSize: 10.5, color: '#EF9F27', marginTop: 2 },
    claimedText: { fontFamily: Fonts.medium, fontSize: 12, color: '#6DE8A8' },
    claimBtn:  { backgroundColor: C.alwaysLight, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8, minWidth: 84, alignItems: 'center' },
    claimBtnText: { fontFamily: Fonts.semiBold, fontSize: 11, color: C.alwaysDark, letterSpacing: 0.3 },
  });
}
