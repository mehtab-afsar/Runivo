import React, { useMemo } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme, Fonts, Spacing, type AppColors } from '@theme';
import type { ConfirmState } from '../../utils/runSummaryTypes';

interface Props {
  ride: boolean;
  /** The run arrived with fresh data from the run screen (not opened from History). */
  fromRunScreen: boolean;
  /** The phone's preview claims ground or took an action. */
  hasGroundAction: boolean;
  confirm: ConfirmState;
  /** Why the run earned no new ground, when the server says so. */
  noGainReason: string | null;
  rejected: boolean;
}

/** The notices under the header: server confirmation, "no new ground" and the tracked-ride note. */
export default function RunVerdictNotices({ ride, fromRunScreen, hasGroundAction, confirm, noGainReason, rejected }: Props) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  return (
    <>
      {/* L6: zones count once the server confirms them. */}
      {!ride && fromRunScreen && confirm !== 'confirmed' && hasGroundAction && (
        <View style={{ marginHorizontal: 18, marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {confirm === 'checking' && <ActivityIndicator size="small" color={C.t2} />}
          <Text style={{ flex: 1, fontFamily: Fonts.medium, fontSize: 12.5, color: C.t2 }}>
            {confirm === 'checking' ? 'Confirming your ground…' : "Can't reach Runivo right now. Your ground is confirmed as soon as you're back online."}
          </Text>
        </View>
      )}

      {!ride && noGainReason && (
        <View style={[ss.card, ss.surface]} accessibilityRole="text">
          <Text style={ss.cardTitle}>{rejected ? 'Why this run earned nothing' : 'No new ground this time'}</Text>
          <Text style={ss.rideNote}>{noGainReason}</Text>
        </View>
      )}

      {ride && (
        <View style={[ss.card, ss.surface]}>
          <Text style={ss.cardTitle}>Tracked ride</Text>
          <Text style={ss.rideNote}>Rides are saved to your history. Only runs, walks and hikes claim zones and earn PACE.</Text>
        </View>
      )}
    </>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card:      { marginHorizontal: Spacing.gutter, marginBottom: 12 },
    surface:   { backgroundColor: C.card, borderRadius: 24 },
    cardTitle: { fontFamily: Fonts.semiBold, fontSize: 17, color: C.t1 },
    rideNote:  { fontFamily: Fonts.regular, fontSize: 13.5, lineHeight: 19, color: C.t2, marginTop: 6 },
  });
}
