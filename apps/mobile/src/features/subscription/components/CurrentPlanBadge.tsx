import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SealCheck, CaretRight } from 'phosphor-react-native';
import { useTheme, Fonts, Spacing, type AppColors } from '@theme';

interface CurrentPlanBadgeProps {
  tier: string;
}

// iOS/Android both keep subscription management in the platform Store, not
// inside the app itself (App Store Review requires this) — deep-link there
// rather than build a redundant in-app cancel flow.
function openManageSubscription() {
  const url = Platform.OS === 'ios'
    ? 'itms-apps://apps.apple.com/account/subscriptions'
    : 'https://play.google.com/store/account/subscriptions?package=com.mehtabafsar.runivo';
  Linking.openURL(url).catch(() => {});
}

export function CurrentPlanBadge({ tier }: CurrentPlanBadgeProps) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const label = tier === 'admin' ? 'Runivo Team' : 'Runivo Plus';

  return (
    <LinearGradient
      colors={['#3A2F0A', C.alwaysDark]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={ss.card}
    >
      <View style={ss.iconWrap}>
        <SealCheck size={22} color={C.gold} weight="fill" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={ss.title}>You're a {label} member</Text>
        <Text style={ss.sub}>Unlimited territory, higher PACE cap, and event hosting are unlocked.</Text>
      </View>

      {tier !== 'admin' && (
        <Pressable onPress={openManageSubscription} style={ss.manageRow}>
          <Text style={ss.manageText}>Manage subscription</Text>
          <CaretRight size={12} color="rgba(255,255,255,0.5)" weight="bold" />
        </Pressable>
      )}
    </LinearGradient>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card: {
      borderRadius: Spacing.radius.lg, padding: 20, marginBottom: 8,
      shadowColor: '#D4A200', shadowOpacity: 0.25, shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 }, elevation: 6,
    },
    iconWrap: { marginBottom: 10 },
    title: { fontFamily: Fonts.semiBold, fontSize: 17, color: C.alwaysLight, marginBottom: 5 },
    sub: { fontFamily: Fonts.regular, fontSize: 12.5, color: 'rgba(255,255,255,0.6)', lineHeight: 18 },
    manageRow: {
      flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
      marginTop: 16, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.12)', paddingTop: 14, width: '100%',
      justifyContent: 'space-between',
    },
    manageText: { fontFamily: Fonts.medium, fontSize: 12.5, color: 'rgba(255,255,255,0.75)' },
  });
}
