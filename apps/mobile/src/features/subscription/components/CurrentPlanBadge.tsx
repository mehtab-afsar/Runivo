import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Linking } from 'react-native';
import { BadgeCheck, ChevronRight } from '@mobile/shared/icons/lucideCompat';
import { useTheme, Fonts, Spacing, type AppColors } from '@theme';

interface CurrentPlanBadgeProps {
  tier: string;
}

// Subscription management lives in the platform store, not in the app
// (App Store Review requires this), so deep-link there.
function openManageSubscription() {
  const url = Platform.OS === 'ios'
    ? 'itms-apps://apps.apple.com/account/subscriptions'
    : 'https://play.google.com/store/account/subscriptions?package=com.mehtabafsar.runivo';
  Linking.openURL(url).catch(() => {});
}

export function CurrentPlanBadge({ tier }: CurrentPlanBadgeProps) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const label = tier === 'admin' ? 'Runivo team' : 'Runivo Plus';

  return (
    <View style={ss.card}>
      <View style={ss.row}>
        <View style={ss.icon}><BadgeCheck size={20} color={C.red} strokeWidth={2.2} /></View>
        <View style={{ flex: 1 }}>
          <Text style={ss.title}>You're on {label}</Text>
          <Text style={ss.sub}>Unlimited zones, a 150 PACE weekly cap, PaceX and event hosting are unlocked.</Text>
        </View>
      </View>
      {tier !== 'admin' && (
        <Pressable onPress={openManageSubscription} style={ss.manage} accessibilityRole="link">
          <Text style={ss.manageText}>Manage subscription</Text>
          <ChevronRight size={16} color={C.t2} />
        </Pressable>
      )}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card:       { backgroundColor: C.card, borderRadius: Spacing.radius.lg, padding: 16, borderWidth: 1.5, borderColor: C.red },
    row:        { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
    icon:       { width: 36, height: 36, borderRadius: 10, backgroundColor: C.redLo, alignItems: 'center', justifyContent: 'center' },
    title:      { fontFamily: Fonts.semiBold, fontSize: 16, color: C.t1 },
    sub:        { fontFamily: Fonts.regular, fontSize: 13, lineHeight: 18, color: C.t2, marginTop: 3 },
    manage:     {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginTop: 14, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border,
    },
    manageText: { fontFamily: Fonts.medium, fontSize: 14, color: C.t1 },
  });
}
