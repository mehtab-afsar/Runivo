/**
 * PlanSelectionStep — step 5 of onboarding.
 * Shows Premium vs Free plan cards matching the web onboarding experience.
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator,
  Modal, ScrollView,
} from 'react-native';
import { Check, Zap, Map, Brain, Shield, Footprints } from 'lucide-react-native';
import { C } from './onboardingStyles';
import {
  getAvailablePackages, purchaseProduct, restorePurchases,
  RC_PRODUCT_MONTHLY,
} from '../../subscription/services/purchaseService';

const PREMIUM_FEATURES = [
  { icon: Map,       text: 'Unlimited territory claims' },
  { icon: Zap,       text: 'Beat Pacer metronome' },
  { icon: Brain,     text: 'AI Coach — personalised plans' },
  { icon: Shield,    text: 'Territory fortify & defend' },
  { icon: Footprints,text: 'Foot scan & shoe recommendations' },
];

const FREE_FEATURES = [
  { text: 'Up to 50 territories' },
  { text: 'Basic run tracking' },
  { text: 'Leaderboard access' },
];

interface Props {
  plan: 'premium' | 'free';
  onSelectPlan: (plan: 'premium' | 'free') => void;
}

export default function PlanSelectionStep({ plan, onSelectPlan }: Props) {
  const [priceString, setPriceString] = useState('$4.99/mo');
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [freeConfirm, setFreeConfirm] = useState(false);
  const [purchaseError, setPurchaseError] = useState('');

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
            ? <ActivityIndicator color="#fff" size="small" />
            : plan === 'premium'
              ? <View style={s.checkBadge}><Check size={12} color={C.black} strokeWidth={2.5} /></View>
              : null
          }
        </View>
        <View style={s.divider} />
        <View style={s.featureList}>
          {PREMIUM_FEATURES.map(({ icon: Icon, text }) => (
            <View key={text} style={s.featureRow}>
              <Icon size={13} color="rgba(255,255,255,0.7)" strokeWidth={1.5} />
              <Text style={s.premiumFeatureText}>{text}</Text>
            </View>
          ))}
        </View>
        {purchaseError ? <Text style={s.errorText}>{purchaseError}</Text> : null}
      </Pressable>

      {/* Free card */}
      <Pressable
        style={[s.card, s.freeCard, plan === 'free' && s.freeCardSelected]}
        onPress={() => setFreeConfirm(true)}
      >
        <View style={s.cardHeader}>
          <View>
            <Text style={s.freeLabel}>Free</Text>
            <Text style={s.freePrice}>$0 / forever</Text>
          </View>
          {plan === 'free' && <View style={s.checkBadgeDark}><Check size={12} color={C.white} strokeWidth={2.5} /></View>}
        </View>
        <View style={[s.divider, { backgroundColor: C.border }]} />
        <View style={s.featureList}>
          {FREE_FEATURES.map(({ text }) => (
            <View key={text} style={s.featureRow}>
              <Check size={13} color={C.t2} strokeWidth={1.5} />
              <Text style={s.freeFeatureText}>{text}</Text>
            </View>
          ))}
        </View>
      </Pressable>

      {/* Restore purchases link */}
      <Pressable onPress={handleRestore} disabled={restoring} style={{ marginTop: 12 }}>
        {restoring
          ? <ActivityIndicator color={C.t3} size="small" />
          : <Text style={s.restoreText}>Restore purchases</Text>}
      </Pressable>

      {/* Free confirmation modal */}
      <Modal
        visible={freeConfirm}
        transparent
        animationType="slide"
        onRequestClose={() => setFreeConfirm(false)}
      >
        <Pressable style={s.overlay} onPress={() => setFreeConfirm(false)}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Continue for free?</Text>
            <Text style={s.sheetSub}>
              You'll have limited territory claims and no AI Coach.
              You can upgrade from Settings anytime.
            </Text>
            <Pressable style={s.sheetConfirm} onPress={() => { setFreeConfirm(false); onSelectPlan('free'); }}>
              <Text style={s.sheetConfirmLabel}>Yes, continue for free</Text>
            </Pressable>
            <Pressable style={s.sheetCancel} onPress={() => setFreeConfirm(false)}>
              <Text style={s.sheetCancelLabel}>Go back</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap:            { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, alignItems: 'stretch' },
  eyebrow:         { fontFamily: 'Barlow_300Light', fontSize: 8, color: C.t3, textTransform: 'uppercase', letterSpacing: 2, textAlign: 'center', marginBottom: 8 },
  title:           { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 22, color: C.black, textAlign: 'center', marginBottom: 6 },
  sub:             { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t2, textAlign: 'center', marginBottom: 20 },

  card:            { borderRadius: 12, padding: 16, marginBottom: 12 },
  cardSelected:    { borderWidth: 1.5, borderColor: '#FFF' },

  premiumCard:     { backgroundColor: C.black },
  cardHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  premiumLabel:    { fontFamily: 'Barlow_600SemiBold', fontSize: 13, color: '#FFFFFF', letterSpacing: 0.5, marginBottom: 2 },
  premiumPrice:    { fontFamily: 'Barlow_300Light', fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  checkBadge:      { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  divider:         { height: 0.5, backgroundColor: 'rgba(255,255,255,0.15)', marginBottom: 12 },
  featureList:     { gap: 8 },
  featureRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  premiumFeatureText: { fontFamily: 'Barlow_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  errorText:       { fontFamily: 'Barlow_400Regular', fontSize: 10, color: '#F87171', marginTop: 10, textAlign: 'center' },

  freeCard:        { backgroundColor: C.white, borderWidth: 0.5, borderColor: C.border },
  freeCardSelected:{ borderColor: C.black, borderWidth: 1 },
  freeLabel:       { fontFamily: 'Barlow_600SemiBold', fontSize: 13, color: C.black, letterSpacing: 0.5, marginBottom: 2 },
  freePrice:       { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t2 },
  checkBadgeDark:  { width: 22, height: 22, borderRadius: 11, backgroundColor: C.black, alignItems: 'center', justifyContent: 'center' },
  freeFeatureText: { fontFamily: 'Barlow_400Regular', fontSize: 12, color: C.t2 },

  restoreText:     { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.t3, textAlign: 'center', textDecorationLine: 'underline' },

  overlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet:           { backgroundColor: C.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40, alignItems: 'center' },
  handle:          { width: 36, height: 3, borderRadius: 2, backgroundColor: C.border, marginBottom: 20 },
  sheetTitle:      { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 20, color: C.black, marginBottom: 8, textAlign: 'center' },
  sheetSub:        { fontFamily: 'Barlow_300Light', fontSize: 12, color: C.t2, textAlign: 'center', lineHeight: 18, marginBottom: 24 },
  sheetConfirm:    { width: '100%', paddingVertical: 13, borderRadius: 4, backgroundColor: C.black, alignItems: 'center', marginBottom: 10 },
  sheetConfirmLabel:{ fontFamily: 'Barlow_500Medium', fontSize: 12, color: '#FFF', textTransform: 'uppercase', letterSpacing: 1 },
  sheetCancel:     { paddingVertical: 8 },
  sheetCancelLabel:{ fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t2 },
});
