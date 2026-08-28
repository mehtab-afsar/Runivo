import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Platform, ActivityIndicator, Linking,
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
        {/* ── Hero — full-bleed dark, one accent (gold), the real tagline as the
             editorial moment instead of a generic "App Name + crown" pattern ── */}
        <LinearGradient
          colors={['#201D19', C.alwaysDark]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={su.hero}
        >
          <View style={[su.heroTop, { paddingTop: insets.top + (Platform.OS === 'android' ? 12 : 6) }]}>
            <Pressable onPress={() => navigation.goBack()} style={su.closeBtn} hitSlop={8}>
              <X size={16} color="rgba(255,255,255,0.7)" weight="bold" />
            </Pressable>
          </View>

          <View style={su.kicker}>
            <Crown size={12} color={C.gold} weight="fill" />
            <Text style={su.kickerText}>RUNIVO PLUS</Text>
          </View>
          <Text style={su.heroTitle}>Own more{'\n'}of your city.</Text>
          <Text style={su.heroSub}>Run smarter, claim faster, never hit a cap.</Text>
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
          <View style={su.featureCard}>
            {FEATURES.map((f, i) => (
              <FeatureRow key={f.name} name={f.name} sub={f.sub} icon={f.icon} live={f.live} isLast={i === FEATURES.length - 1} />
            ))}
          </View>

          {!isPremium && (
            <Text style={su.freeLimitsText}>
              Free plan: {FREE_LIMITS.join(' · ')}
            </Text>
          )}

          <Text style={su.legal}>
            Cancel anytime. Subscription auto-renews unless cancelled at least 24 hours before the end of the trial or billing period.
          </Text>

          {/* Apple requires Terms + Privacy visible on the same screen as the
              purchase button, not just reachable from Settings. */}
          <View style={su.legalLinksRow}>
            <Pressable onPress={() => Linking.openURL('https://runivo.app/terms')} hitSlop={8}>
              <Text style={su.legalLink}>Terms of Service</Text>
            </Pressable>
            <Text style={su.legalLinkSep}>·</Text>
            <Pressable onPress={() => Linking.openURL('https://runivo.app/privacy')} hitSlop={8}>
              <Text style={su.legalLink}>Privacy Policy</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function mkStyles(C: AppColors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scrollContent: { paddingBottom: 60 },

  hero: {
    alignItems: 'center', paddingBottom: 36, paddingHorizontal: 32,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  heroTop: { width: '100%', flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, marginBottom: 18 },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  kickerText: { fontFamily: Fonts.semiBold, fontSize: 11, color: C.gold, letterSpacing: 2 },
  // Thin Barlow, not the italic display face — a light, spacious weight
  // instead of an editorial-serif or heavy-bold moment.
  heroTitle: { fontFamily: Fonts.light, fontSize: 36, lineHeight: 40, letterSpacing: -0.3, color: C.alwaysLight, textAlign: 'center', marginBottom: 12 },
  heroSub: { fontFamily: Fonts.regular, fontSize: 13.5, color: 'rgba(255,255,255,0.55)', textAlign: 'center' },

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

  sectionLabel: { fontFamily: Fonts.semiBold, fontSize: 11, color: C.t3, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 26, marginBottom: 4 },
  featureCard: {
    backgroundColor: C.card, borderRadius: Spacing.radius.lg, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 16, marginTop: 8,
  },

  freeLimitsText: { fontFamily: Fonts.regular, fontSize: 11.5, color: C.t3, marginTop: 12, textAlign: 'center' },

  legal: { fontFamily: Fonts.regular, fontSize: 10, color: C.t3, textAlign: 'center', lineHeight: 16, marginTop: 24 },
  legalLinksRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 10 },
  legalLink: { fontFamily: Fonts.regular, fontSize: 10.5, color: C.t2, textDecorationLine: 'underline' },
  legalLinkSep: { fontFamily: Fonts.regular, fontSize: 10.5, color: C.t3 },
}); }
