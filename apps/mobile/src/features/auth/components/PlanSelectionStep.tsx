/**
 * PlanSelectionStep — step 5 of onboarding.
 * Shows Premium vs Free plan cards matching the web onboarding experience.
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator,
  Animated, ScrollView,
} from 'react-native';
import { Check, Lightning, MapTrifold, Brain, Calendar, BellRinging } from 'phosphor-react-native';
import { mkD, type OnboardingD } from './onboardingStyles';
import { useTheme, Fonts } from '@theme';
import { GAME_CONFIG } from '@shared/services/config';
import {
  getAvailablePackages, purchaseProduct, restorePurchases,
  RC_PRODUCT_MONTHLY,
} from '../../subscription/services/purchaseService';

// Kept in sync with subscription/types.ts's FEATURES — same 5 claims, same
// live/soon split. Beat Pacer, territory fortify/defend, and foot scan used
// to be listed here too, but none of the three are actually gated anywhere
// in the app (free for everyone), so advertising them as a Plus perk here
// was simply false.
const PREMIUM_FEATURES = [
  { icon: MapTrifold,   text: 'Unlimited territory claims' },
  { icon: Lightning,    text: `Higher PACE cap (${GAME_CONFIG.PACE_WEEKLY_CAP_PREMIUM}/week)` },
  { icon: Calendar,     text: 'Host events' },
  { icon: Brain,        text: 'AI Coach — personalised plans (soon)' },
  { icon: BellRinging,  text: 'Territory alerts (soon)' },
];

const FREE_FEATURES = [
  { text: `Up to ${GAME_CONFIG.MAX_TERRITORIES_FREE} territories` },
  { text: `${GAME_CONFIG.PACE_WEEKLY_CAP_FREE} PACE/week cap` },
  { text: 'Basic run tracking' },
];

interface Props {
  plan: 'premium' | 'free';
  onSelectPlan: (plan: 'premium' | 'free') => void;
}

export default function PlanSelectionStep({ plan, onSelectPlan }: Props) {
  const C = useTheme();
  const D = useMemo(() => mkD(C), [C]);
  const s = useMemo(() => mkStyles(D), [D]);
  const [priceString, setPriceString] = useState('$4.99/mo');
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [freeConfirm, setFreeConfirm] = useState(false);
  const [purchaseError, setPurchaseError] = useState('');
  const overlayAnim = useRef(new Animated.Value(0)).current;

  const openFreeConfirm = () => {
    setFreeConfirm(true);
    Animated.timing(overlayAnim, { toValue: 1, duration: 380, useNativeDriver: true }).start();
  };

  const closeFreeConfirm = (cb?: () => void) => {
    Animated.timing(overlayAnim, { toValue: 0, duration: 240, useNativeDriver: true }).start(() => {
      setFreeConfirm(false);
      cb?.();
    });
  };

  useEffect(() => {
    // Try to fetch real price from RevenueCat
    getAvailablePackages().then(pkgs => {
      const monthly = pkgs.find(p => p.product.identifier === RC_PRODUCT_MONTHLY);
      if (monthly) setPriceString(monthly.product.priceString + '/mo');
    }).catch(() => {});
  }, []);

  const handlePremium = async () => {
    setPurchasing(true);
    setPurchaseError('');
    try {
      const result = await purchaseProduct(RC_PRODUCT_MONTHLY);
      if (result.success) {
        onSelectPlan('premium');
      } else if (!result.cancelled) {
        setPurchaseError(result.error ?? 'Purchase failed. Try again.');
      }
    } catch {
      setPurchaseError('Purchase failed. Try again.');
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const ok = await restorePurchases();
      if (ok) onSelectPlan('premium');
      else setPurchaseError('No active subscription found.');
    } catch {
      setPurchaseError('Restore failed. Try again.');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={s.wrap}
      showsVerticalScrollIndicator={false}
    >
      <Text style={s.eyebrow}>Choose your plan</Text>
      <Text style={s.title}>Unlock your full potential</Text>
      <Text style={s.sub}>Start free. Upgrade anytime.</Text>

      {/* Premium card */}
      <Pressable
        style={[s.card, s.premiumCard, plan === 'premium' && s.cardSelected]}
        onPress={handlePremium}
        disabled={purchasing}
      >
        <View style={s.cardHeader}>
          <View>
            <Text style={s.premiumLabel}>Runner Plus</Text>
            <Text style={s.premiumPrice}>{priceString}</Text>
          </View>
          {purchasing
            ? <ActivityIndicator color={D.alwaysLight} size="small" />
            : plan === 'premium'
              ? <View style={s.checkBadge}><Check size={12} color={D.alwaysDark} weight="bold" /></View>
              : null
          }
        </View>
        <View style={s.divider} />
        <View style={s.featureList}>
          {PREMIUM_FEATURES.map(({ icon: Icon, text }) => (
            <View key={text} style={s.featureRow}>
              <Icon size={13} color="rgba(255,255,255,0.7)" weight="light" />
              <Text style={s.premiumFeatureText}>{text}</Text>
            </View>
          ))}
        </View>
        {purchaseError ? <Text style={s.errorText}>{purchaseError}</Text> : null}
      </Pressable>

      {/* Free card */}
      <Pressable
        style={[s.card, s.freeCard, plan === 'free' && s.freeCardSelected]}
        onPress={openFreeConfirm}
      >
        <View style={s.cardHeader}>
          <View>
            <Text style={s.freeLabel}>Free</Text>
            <Text style={s.freePrice}>$0 / forever</Text>
          </View>
          {plan === 'free' && <View style={s.checkBadgeDark}><Check size={12} color={D.bg} weight="bold" /></View>}
        </View>
        <View style={[s.divider, { backgroundColor: D.div }]} />
        <View style={s.featureList}>
          {FREE_FEATURES.map(({ text }) => (
            <View key={text} style={s.featureRow}>
              <Check size={13} color={D.t2} weight="light" />
              <Text style={s.freeFeatureText}>{text}</Text>
            </View>
          ))}
        </View>
      </Pressable>

      {/* Restore purchases link */}
      <Pressable onPress={handleRestore} disabled={restoring} style={{ marginTop: 12 }}>
        {restoring
          ? <ActivityIndicator color={D.t3} size="small" />
          : <Text style={s.restoreText}>Restore purchases</Text>}
      </Pressable>

    </ScrollView>

      {/* Free confirmation — fade overlay outside ScrollView so it covers the full screen */}
      {freeConfirm && (
        <Animated.View style={[s.overlay, { opacity: overlayAnim }]} pointerEvents="auto">
          <Pressable style={s.overlayBackdrop} onPress={() => closeFreeConfirm()} />
          <View style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Continue for free?</Text>
            <Text style={s.sheetSub}>
              You'll have limited territory claims and no AI Coach.
              You can upgrade from Settings anytime.
            </Text>
            <Pressable style={s.sheetConfirm} onPress={() => closeFreeConfirm(() => onSelectPlan('free'))}>
              <Text style={s.sheetConfirmLabel}>Yes, continue for free</Text>
            </Pressable>
            <Pressable style={s.sheetCancel} onPress={() => closeFreeConfirm()}>
              <Text style={s.sheetCancelLabel}>Go back</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

function mkStyles(D: OnboardingD) {
  return StyleSheet.create({
    wrap:            { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, alignItems: 'stretch' },
    eyebrow:         { fontSize: 8, color: D.t3, textTransform: 'uppercase', letterSpacing: 2, textAlign: 'center', marginBottom: 8 },
    title:           { fontFamily: Fonts.display, fontSize: 22, color: D.t1, textAlign: 'center', marginBottom: 6 },
    sub:             { fontSize: 11, color: D.t2, textAlign: 'center', marginBottom: 20 },

    card:            { borderRadius: 12, padding: 16, marginBottom: 12 },
    // Premium card is a fixed bold-dark surface regardless of theme (its own brand
    // moment), so its accessories (badge, divider, selected border, label colors)
    // are fixed alwaysDark/alwaysLight pairs, not adapting ink/bg tokens.
    cardSelected:    { borderWidth: 1.5, borderColor: D.alwaysLight },

    premiumCard:     { backgroundColor: D.alwaysDark },
    cardHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    premiumLabel:    { fontFamily: Fonts.medium, fontSize: 13, color: D.alwaysLight, letterSpacing: 0.5, marginBottom: 2 },
    premiumPrice:    { fontSize: 11, color: 'rgba(255,255,255,0.6)' },
    checkBadge:      { width: 22, height: 22, borderRadius: 11, backgroundColor: D.alwaysLight, alignItems: 'center', justifyContent: 'center' },
    divider:         { height: 0.5, backgroundColor: 'rgba(255,255,255,0.15)', marginBottom: 12 },
    featureList:     { gap: 8 },
    featureRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
    premiumFeatureText: { fontSize: 12, color: 'rgba(255,255,255,0.85)' },
    errorText:       { fontSize: 10, color: '#F87171', marginTop: 10, textAlign: 'center' },

    // Free card is a normal adapting surface.
    freeCard:        { backgroundColor: D.card, borderWidth: 0.5, borderColor: D.div },
    freeCardSelected:{ borderColor: D.t1, borderWidth: 0.5 },
    freeLabel:       { fontFamily: Fonts.medium, fontSize: 13, color: D.t1, letterSpacing: 0.5, marginBottom: 2 },
    freePrice:       { fontSize: 11, color: D.t2 },
    // Sits on the adapting freeCard, so it pairs with ink/bg (guaranteed to
    // contrast against each other by construction) rather than a fixed pair.
    checkBadgeDark:  { width: 22, height: 22, borderRadius: 11, backgroundColor: D.t1, alignItems: 'center', justifyContent: 'center' },
    freeFeatureText: { fontSize: 12, color: D.t2 },

    restoreText:     { fontSize: 10, color: D.t3, textAlign: 'center', textDecorationLine: 'underline' },

    overlay:         { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end', zIndex: 10 },
    overlayBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(17,17,16,0.88)' },
    sheet:           { backgroundColor: D.surf, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 48, alignItems: 'center' },
    handle:          { width: 36, height: 3, borderRadius: 2, backgroundColor: D.div, marginBottom: 20 },
    sheetTitle:      { fontFamily: Fonts.display, fontSize: 20, color: D.t1, marginBottom: 8, textAlign: 'center' },
    sheetSub:        { fontSize: 12, color: D.t2, textAlign: 'center', lineHeight: 18, marginBottom: 24 },
    sheetConfirm:    { width: '100%', paddingVertical: 14, borderRadius: 10, backgroundColor: D.alwaysDark, alignItems: 'center', marginBottom: 10 },
    sheetConfirmLabel:{ fontFamily: Fonts.medium, fontSize: 12, color: D.alwaysLight, letterSpacing: 1 },
    sheetCancel:     { paddingVertical: 8 },
    sheetCancelLabel:{ fontSize: 11, color: D.t2 },
  });
}
