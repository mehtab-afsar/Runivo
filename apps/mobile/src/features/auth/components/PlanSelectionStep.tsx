/**
 * PlanSelectionStep — step 5 of onboarding, rebuilt against current
 * conventions (useTheme/Type/Fonts, phosphor icons, PrimaryButton/TextButton).
 * A soft, skippable gate: shown after First Mission, once the user has
 * already seen a preview of the game — never blocks progression, the shared
 * footer "Continue" still works if neither card is tapped (defaults to free).
 */
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Modal } from 'react-native';
import { Check, Lightning, MapTrifold, Brain, ShieldCheck, Footprints } from 'phosphor-react-native';
import { mkD, mkShared, type OnboardingD } from './onboardingStyles';
import { useTheme, Type, Fonts } from '@theme';
import { PrimaryButton } from '@mobile/shared/components/PrimaryButton';
import { TextButton } from '@mobile/shared/components/TextButton';
import {
  getAvailablePackages, purchaseProduct, restorePurchases, RC_PRODUCT_MONTHLY,
} from '@features/subscription/services/purchaseService';

const PREMIUM_FEATURES = [
  { icon: MapTrifold,  text: 'Unlimited territory claims' },
  { icon: Lightning,   text: 'Beat Pacer metronome' },
  { icon: Brain,       text: 'AI Coach — personalised plans' },
  { icon: ShieldCheck, text: 'Territory fortify & defend' },
  { icon: Footprints,  text: 'Foot scan & shoe recommendations' },
];

const FREE_FEATURES = [
  'Up to 50 territories',
  'Basic run tracking',
  'Leaderboard access',
];

interface Props {
  plan: 'premium' | 'free';
  onSelectPlan: (plan: 'premium' | 'free') => void;
}

export default function PlanSelectionStep({ plan, onSelectPlan }: Props) {
  const C = useTheme();
  const D = useMemo(() => mkD(C), [C]);
  const shared = useMemo(() => mkShared(C), [C]);
  const s = useMemo(() => mkStyles(D), [D]);

  const [priceString, setPriceString]   = useState('$4.99/mo');
  const [purchasing, setPurchasing]     = useState(false);
  const [restoring, setRestoring]       = useState(false);
  const [freeConfirm, setFreeConfirm]   = useState(false);
  const [purchaseError, setPurchaseError] = useState('');

  useEffect(() => {
    getAvailablePackages().then(pkgs => {
      const monthly = pkgs.find(p => p.product.identifier === RC_PRODUCT_MONTHLY);
      if (monthly) setPriceString(monthly.product.priceString + '/mo');
    }).catch(() => {});
  }, []);

  async function handlePremium() {
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
  }

  async function handleRestore() {
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
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={shared.stepContent}>
        <Text style={[shared.eyebrow, { textAlign: 'center' }]}>Choose your plan</Text>
        <Text style={[shared.heroTitle, { textAlign: 'center', fontSize: 30 }]}>Unlock your full potential.</Text>
        <Text style={[shared.subtitle, { textAlign: 'center', maxWidth: undefined, marginBottom: 24 }]}>
          Start free. Upgrade anytime.
        </Text>

        {/* Premium card — deliberately custom-branded (always-dark), not the generic Card primitive */}
        <Pressable
          style={[s.premiumCard, plan === 'premium' && s.cardSelected]}
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
          <View style={s.premiumDivider} />
          <View style={{ gap: 10 }}>
            {PREMIUM_FEATURES.map(({ icon: Icon, text }) => (
              <View key={text} style={s.featureRow}>
                <Icon size={14} color="rgba(255,255,255,0.7)" weight="light" />
                <Text style={s.premiumFeatureText}>{text}</Text>
              </View>
            ))}
          </View>
          {purchaseError ? <Text style={s.errorText}>{purchaseError}</Text> : null}
        </Pressable>

        {/* Free card */}
        <Pressable
          style={[s.freeCard, plan === 'free' && s.freeCardSelected]}
          onPress={() => setFreeConfirm(true)}
        >
          <View style={s.cardHeader}>
            <View>
              <Text style={s.freeLabel}>Free</Text>
              <Text style={s.freePrice}>$0 / forever</Text>
            </View>
            {plan === 'free' && <View style={s.checkBadgeDark}><Check size={12} color={D.alwaysLight} weight="bold" /></View>}
          </View>
          <View style={s.freeDivider} />
          <View style={{ gap: 10 }}>
            {FREE_FEATURES.map(text => (
              <View key={text} style={s.featureRow}>
                <Check size={14} color={D.t3} weight="light" />
                <Text style={s.freeFeatureText}>{text}</Text>
              </View>
            ))}
          </View>
        </Pressable>

        <View style={{ marginTop: 14, alignItems: 'center' }}>
          <TextButton
            label={restoring ? 'Restoring…' : 'Restore purchases'}
            onPress={handleRestore}
            disabled={restoring}
          />
        </View>
      </View>

      <Modal visible={freeConfirm} transparent animationType="slide" onRequestClose={() => setFreeConfirm(false)}>
        <Pressable style={s.overlay} onPress={() => setFreeConfirm(false)}>
          <Pressable style={s.sheet} onPress={e => e.stopPropagation()}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Continue for free?</Text>
            <Text style={s.sheetSub}>
              You'll have limited territory claims and no AI Coach. You can upgrade from Settings anytime.
            </Text>
            <PrimaryButton
              label="Yes, continue for free"
              onPress={() => { setFreeConfirm(false); onSelectPlan('free'); }}
              variant="dark" fullWidth
            />
            <View style={{ marginTop: 10 }}>
              <TextButton label="Go back" onPress={() => setFreeConfirm(false)} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function mkStyles(D: OnboardingD) {
  return StyleSheet.create({
    cardHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    featureRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
    cardSelected: { borderWidth: 1.5, borderColor: D.alwaysLight },

    premiumCard:    { borderRadius: 14, padding: 18, marginBottom: 12, backgroundColor: D.alwaysDark },
    premiumLabel:   { fontFamily: Fonts.semiBold, fontSize: 14, color: D.alwaysLight, letterSpacing: 0.3, marginBottom: 2 },
    premiumPrice:   { fontFamily: Fonts.light, fontSize: 12, color: 'rgba(255,255,255,0.6)' },
    premiumDivider: { height: 0.5, backgroundColor: 'rgba(255,255,255,0.15)', marginBottom: 12 },
    premiumFeatureText: { fontFamily: Fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.85)' },
    checkBadge:     { width: 22, height: 22, borderRadius: 11, backgroundColor: D.alwaysLight, alignItems: 'center', justifyContent: 'center' },
    errorText:      { ...Type.caption, color: '#F87171', marginTop: 10, textAlign: 'center' },

    freeCard:        { borderRadius: 14, padding: 18, backgroundColor: D.card, borderWidth: 0.5, borderColor: D.div },
    freeCardSelected:{ borderColor: D.alwaysDark, borderWidth: 1 },
    freeLabel:       { fontFamily: Fonts.semiBold, fontSize: 14, color: D.t1, letterSpacing: 0.3, marginBottom: 2 },
    freePrice:       { fontFamily: Fonts.light, fontSize: 12, color: D.t2 },
    freeDivider:     { height: 0.5, backgroundColor: D.div, marginBottom: 12 },
    freeFeatureText: { fontFamily: Fonts.regular, fontSize: 13, color: D.t2 },
    checkBadgeDark:  { width: 22, height: 22, borderRadius: 11, backgroundColor: D.alwaysDark, alignItems: 'center', justifyContent: 'center' },

    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet:   { backgroundColor: D.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40, alignItems: 'center' },
    handle:  { width: 36, height: 3, borderRadius: 2, backgroundColor: D.div, marginBottom: 20 },
    sheetTitle: { fontFamily: Fonts.display, fontSize: 20, color: D.t1, marginBottom: 8, textAlign: 'center' },
    sheetSub:   { fontFamily: Fonts.light, fontSize: 13, color: D.t2, textAlign: 'center', lineHeight: 19, marginBottom: 24 },
  });
}
