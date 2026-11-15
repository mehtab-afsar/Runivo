import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Linking, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { X } from 'lucide-react-native';
import * as Haptics from '@theme/hapticsGated';
import { track } from '@shared/services/analytics';
import { useSubscription } from '../hooks/useSubscription';
import { PlanCard } from '../components/PlanCard';
import { CurrentPlanBadge } from '../components/CurrentPlanBadge';
import { PLANS, PAYWALL_COPY } from '../types';
import { paywallRows, displayPrice } from '@shared/engine/entitlements';
import { FEATURES } from '../../../config/features';
import { useTheme, Fonts, Type, Spacing, type AppColors } from '@theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * The Runivo Plus paywall. Opens with copy for the moment that brought the
 * runner here (11th zone, PACE cap, PaceX debrief, events, map styles).
 */
export default function SubscriptionScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'Subscription'>>();
  const reason = route.params?.reason;
  const copy = PAYWALL_COPY[reason ?? 'default'];
  const insets = useSafeAreaInsets();
  const { currentTier, isPremium, loading, purchasing, rcPrices, plansUnavailable, reload, purchasePlan, restorePlan } = useSubscription();
  const [selected, setSelected] = useState<'annual' | 'monthly'>('annual');

  useEffect(() => { track('paywall_viewed', { reason: reason ?? 'direct' }); }, [reason]);

  const plan = PLANS.find(p => p.id === selected)!;
  // Only the store's real price (X5); before it loads, the store shows it at checkout.
  const price = displayPrice(rcPrices[plan.rcProductId]);
  const ctaLabel = plan.trialDays > 0 ? `Start ${plan.trialDays}-day free trial` : price ? `Get Plus · ${price} a month` : 'Get Plus';
  const ctaSub = plan.trialDays > 0
    ? (price ? `Then ${price}${plan.period}.` : 'The store shows the price before you confirm.')
    : 'Renews monthly until cancelled.';

  const onBuy = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    track('paywall_purchase_tapped', { reason: reason ?? 'direct', plan: plan.id });
    purchasePlan(plan.id, plan.rcProductId);
  };

  // Only perks that are live in this build, with the numbers the game enforces.
  const KEY_ROWS = paywallRows({ aiCoach: FEATURES.AI_COACH });

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
        {/* Dark hero */}
        <View style={[s.heroBlock, { paddingTop: insets.top + 12 }]}>
          <View style={s.topRow}>
            <Pressable onPress={() => navigation.goBack()} style={s.close} hitSlop={10} accessibilityLabel="Close">
              <X size={18} color={C.alwaysLight} strokeWidth={2.2} />
            </Pressable>
            {!isPremium && (
              <Pressable style={s.restorePill} onPress={restorePlan} disabled={purchasing} hitSlop={8} accessibilityRole="button">
                <Text style={s.restorePillText}>Restore purchase</Text>
              </Pressable>
            )}
          </View>
          <Text style={s.eyebrow}>Runivo Plus</Text>
          <Text style={s.hero} accessibilityRole="header">{copy.lead} {copy.accent}</Text>
        </View>

        <View style={s.body}>
          {/* Free vs Plus */}
          <View style={s.table}>
            {/* Column headers belong above the values they name. */}
            <View style={s.trFoot} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Text style={s.tdLabel} />
              <Text style={s.footFree}>Free</Text>
              <Text style={s.footPlus}>Plus</Text>
            </View>
            {KEY_ROWS.map(r => (
              <View key={r.label} style={s.tr} accessible accessibilityLabel={`${r.label}. Free: ${r.free}. Plus: ${r.plus}.`}>
                <Text style={s.tdLabel}>{r.label}</Text>
                <Text style={s.tdFree}>{r.free}</Text>
                <Text style={s.tdPlus}>{r.plus}</Text>
              </View>
            ))}
          </View>
          {/* X6: what never goes behind the paywall. */}
          <Text style={s.alwaysFree}>Always free: tracking, claiming and defending zones, clubs, safety sharing, privacy controls and the PACE store.</Text>

          {loading ? (
            <ActivityIndicator color={C.red} style={{ marginVertical: 28 }} />
          ) : isPremium ? (
            <View style={{ marginTop: 16 }}><CurrentPlanBadge tier={currentTier ?? 'premium'} /></View>
          ) : plansUnavailable ? (
            // No plan, no price: the store returned nothing (offline, or the products are not live).
            // A purchase button without a price would break the paywall rules, so offer a retry.
            <View style={s.unavailable}>
              <Text style={s.unavailableTitle}>Plans can't load right now</Text>
              <Text style={s.unavailableBody}>Check your connection and try again. Restore purchase above still works if you already subscribed.</Text>
              <Pressable onPress={reload} style={s.retry} accessibilityRole="button" hitSlop={8}><Text style={s.retryTxt}>Try again</Text></Pressable>
            </View>
          ) : (
            <>
              <View style={s.plans}>
                {PLANS.map(p => (
                  <PlanCard
                    key={p.id}
                    plan={p}
                    isSelected={selected === p.id}
                    displayPrice={displayPrice(rcPrices[p.rcProductId]) ?? 'Price at checkout'}
                    onSelect={() => { Haptics.selectionAsync().catch(() => {}); setSelected(p.id); }}
                  />
                ))}
              </View>
              <Pressable
                onPress={onBuy}
                disabled={purchasing}
                accessibilityRole="button"
                style={({ pressed }) => [s.cta, (pressed || purchasing) && { opacity: 0.88 }]}
              >
                {purchasing ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.ctaLabel}>{ctaLabel}</Text>}
              </Pressable>
              <Text style={s.ctaSub}>{ctaSub} Cancel any time in {Platform.OS === 'ios' ? 'your Apple ID settings' : 'Google Play'}.</Text>
            </>
          )}

          <Text style={s.legal}>
            Payment is charged to your {Platform.OS === 'ios' ? 'Apple ID' : 'Google Play'} account at confirmation of purchase. The subscription renews automatically unless cancelled at least 24 hours before the end of the trial or billing period.
          </Text>
          {/* Apple requires Terms and Privacy on the same screen as the purchase button. */}
          <View style={s.links}>
            <Pressable onPress={() => { Linking.openURL('https://runivo.app/terms').catch(() => {}); }} hitSlop={8} accessibilityRole="link">
              <Text style={s.link}>Terms of Use (EULA)</Text>
            </Pressable>
            <Text style={s.linkSep}>·</Text>
            <Pressable onPress={() => { Linking.openURL('https://runivo.app/privacy').catch(() => {}); }} hitSlop={8} accessibilityRole="link">
              <Text style={s.link}>Privacy Policy</Text>
            </Pressable>
            {!isPremium && (
              <>
                <Text style={s.linkSep}>·</Text>
                <Pressable onPress={restorePlan} disabled={purchasing} hitSlop={8} accessibilityRole="button">
                  <Text style={s.link}>Restore purchase</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    unavailable:      { marginTop: 24, padding: 18, borderRadius: Spacing.radius.lg, backgroundColor: C.card },
    unavailableTitle: { fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1 },
    unavailableBody:  { fontFamily: Fonts.regular, fontSize: 13.5, lineHeight: 19, color: C.t2, marginTop: 6 },
    retry:            { height: 44, borderRadius: 12, backgroundColor: C.t1, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
    retryTxt:         { fontFamily: Fonts.semiBold, fontSize: 14, color: C.bg },
    root:        { flex: 1, backgroundColor: C.bg },
    heroBlock:   { backgroundColor: C.alwaysDark, paddingHorizontal: Spacing.gutter + 2, paddingBottom: 28 },
    topRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 },
    close:       { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
    restorePill: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
    restorePillText: { fontFamily: Fonts.semiBold, fontSize: 12.5, color: C.alwaysLight },
    eyebrow:     { fontFamily: Fonts.medium, fontSize: 13, color: '#FF9B80' },
    hero:        { ...Type.hero, fontSize: 52, lineHeight: 50, color: C.alwaysLight, marginTop: 10 },
    body:        { paddingHorizontal: Spacing.gutter, paddingTop: 18 },
    table:       {
      backgroundColor: C.card, borderRadius: Spacing.radius.lg, paddingHorizontal: 16, paddingTop: 4,
      shadowColor: C.t1, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1,
    },
    tr:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.border },
    trFoot:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
    tdLabel:     { flex: 1, fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
    tdFree:      { width: 64, textAlign: 'center', fontFamily: Fonts.regular, fontSize: 13, color: C.t2 },
    tdPlus:      { width: 86, textAlign: 'right', fontFamily: Fonts.bold, fontSize: 16, color: C.red },
    footFree:    { width: 64, textAlign: 'center', fontFamily: Fonts.regular, fontSize: 12, color: C.t2 },
    footPlus:    { width: 86, textAlign: 'right', fontFamily: Fonts.medium, fontSize: 12, color: C.t1 },
    plans:       { flexDirection: 'row', gap: 10, marginTop: 16 },
    cta:         { marginTop: 14, height: 56, borderRadius: 999, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' },
    ctaLabel:    { fontFamily: Fonts.semiBold, fontSize: 16, color: '#FFFFFF' },
    ctaSub:      { fontFamily: Fonts.regular, fontSize: 12.5, lineHeight: 18, color: C.t2, textAlign: 'center', marginTop: 10 },
    legal:       { fontFamily: Fonts.regular, fontSize: 11.5, lineHeight: 16, color: C.t3, textAlign: 'center', marginTop: 18 },
    links:       { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 10 },
    link:        { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, textDecorationLine: 'underline' },
    linkSep:     { fontFamily: Fonts.regular, fontSize: 12, color: C.t3 },
    alwaysFree: { fontFamily: Fonts.regular, fontSize: 12.5, color: C.t2, marginTop: 10, lineHeight: 18 },
  });
}
