import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Crown } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import { useSubscription } from '../hooks/useSubscription';
import { PlanCard } from '../components/PlanCard';
import { CurrentPlanBadge } from '../components/CurrentPlanBadge';
import { FeatureRow } from '../components/FeatureRow';
import { PLANS, FEATURES, FREE_LIMITS } from '../types';
import { useTheme, Fonts, Spacing, type AppColors } from '@theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SubscriptionScreen() {
  const C = useTheme();
  const su = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const {
    currentTier, isPremium, loading, purchasing, rcPrices,
    purchasePlan, restorePlan, RC_PRODUCT_ANNUAL, RC_PRODUCT_MONTHLY,
  } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual');

  const activePlan = PLANS.find(p => p.id === selectedPlan)!;
  const trialPrice = selectedPlan === 'annual'
    ? (rcPrices[RC_PRODUCT_ANNUAL]  ? `${rcPrices[RC_PRODUCT_ANNUAL]}/yr`  : '$59.99/yr')
    : (rcPrices[RC_PRODUCT_MONTHLY] ? `${rcPrices[RC_PRODUCT_MONTHLY]}/mo` : '$7.99/mo');

  return (
    <View style={su.root}>
      <ScrollView contentContainerStyle={[su.scrollContent, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
        {/* ── Hero — full-bleed dark, bleeds behind the status bar ───────────── */}
        <LinearGradient
          colors={['#3A2F0A', C.alwaysDark, C.alwaysDark]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={su.hero}
        >
          <View style={[su.heroTop, { paddingTop: insets.top + (Platform.OS === 'android' ? 12 : 6) }]}>
            <Pressable onPress={() => navigation.goBack()} style={su.closeBtn} hitSlop={8}>
              <X size={16} color="rgba(255,255,255,0.7)" weight="bold" />
            </Pressable>
          </View>

          <View style={su.crownWrap}>
            <View style={su.crownGlow} />
            <Crown size={40} color={C.gold} weight="fill" />
          </View>
          <Text style={su.heroTitle}>Runivo Plus</Text>
          <Text style={su.heroSub}>Own more of your city. Run smarter.</Text>
        </LinearGradient>

        <View style={su.content}>
          {loading ? (
            <ActivityIndicator color={C.red} style={{ marginTop: 8 }} />
          ) : isPremium ? (
            <CurrentPlanBadge tier={currentTier ?? 'premium'} />
          ) : (
            <>
              <View style={su.planRow}>
                {PLANS.map(p => (
                  <PlanCard
                    key={p.id} plan={p} isSelected={selectedPlan === p.id}
                    displayPrice={rcPrices[p.rcProductId] ?? p.price}
                    onSelect={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedPlan(p.id); }}
                  />
                ))}
              </View>

              <Pressable
                style={({ pressed }) => [su.subscribeBtnWrap, pressed && { opacity: 0.9 }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); purchasePlan(activePlan.id, activePlan.rcProductId); }}
                disabled={purchasing}
              >
                <LinearGradient
                  colors={[C.red, '#B82A12']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={[su.subscribeBtn, purchasing && { opacity: 0.6 }]}
                >
                  {purchasing ? <ActivityIndicator size="small" color={C.alwaysLight} /> : (
                    <>
                      <Text style={su.subscribeBtnLabel}>Start Free Trial</Text>
                      <Text style={su.subscribeBtnSub}>7 days free, then {trialPrice} · cancel anytime</Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>

              <Pressable style={su.restoreBtn} onPress={restorePlan} disabled={purchasing}>
                <Text style={su.restoreText}>Restore purchases</Text>
              </Pressable>
            </>
          )}

          <Text style={su.sectionLabel}>What's in Plus</Text>
          <View style={su.grid}>
            {FEATURES.map(f => (
              <FeatureRow key={f.name} name={f.name} sub={f.sub} icon={f.icon} live={f.live} />
            ))}
          </View>

          {!isPremium && (
            <>
              <Text style={su.sectionLabel}>On the free plan</Text>
              <View style={su.freeLimitsRow}>
                {FREE_LIMITS.map(l => (
                  <View key={l} style={su.freeLimitChip}>
                    <Text style={su.freeLimitText}>{l}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          <Text style={su.legal}>
            Cancel anytime. Subscription auto-renews unless cancelled at least 24 hours before the end of the trial or billing period.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function mkStyles(C: AppColors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scrollContent: { paddingBottom: 60 },

  hero: {
    alignItems: 'center', paddingBottom: 32,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  heroTop: { width: '100%', flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, marginBottom: 4 },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  crownWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 14, marginTop: 6 },
  crownGlow: {
    position: 'absolute', width: 84, height: 84, borderRadius: 42,
    backgroundColor: 'rgba(212,162,0,0.18)',
  },
  heroTitle: { fontFamily: Fonts.display, fontSize: 32, color: C.alwaysLight, marginBottom: 8 },
  heroSub: { fontFamily: Fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },

  content: { paddingHorizontal: Spacing.gutter, paddingTop: 20 },

  planRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },

  subscribeBtnWrap: { borderRadius: Spacing.radius.lg, marginBottom: 6 },
  subscribeBtn: {
    borderRadius: Spacing.radius.lg, paddingVertical: 17, alignItems: 'center',
    shadowColor: C.red, shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  subscribeBtnLabel: { fontFamily: Fonts.bold, fontSize: 16, color: C.alwaysLight, letterSpacing: 0.6 },
  subscribeBtnSub: { fontFamily: Fonts.regular, fontSize: 11.5, color: 'rgba(255,255,255,0.75)', marginTop: 3 },
  restoreBtn: { alignItems: 'center', paddingVertical: 12 },
  restoreText: { fontFamily: Fonts.regular, fontSize: 12.5, color: C.t2, textDecorationLine: 'underline' },

  sectionLabel: { fontFamily: Fonts.semiBold, fontSize: 13, color: C.t1, marginTop: 22, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },

  freeLimitsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  freeLimitChip: {
    backgroundColor: C.surface, borderRadius: Spacing.radius.full,
    paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: C.border,
  },
  freeLimitText: { fontFamily: Fonts.medium, fontSize: 11.5, color: C.t2 },

  legal: { fontFamily: Fonts.regular, fontSize: 10, color: C.t3, textAlign: 'center', lineHeight: 16, marginTop: 24 },
}); }
