import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, SafeAreaView,
  Platform, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { Flag } from 'lucide-react-native';
import { useSubscription } from '../hooks/useSubscription';
import { PlanCard } from '../components/PlanCard';
import { CurrentPlanBadge } from '../components/CurrentPlanBadge';
import { FeatureRow } from '../components/FeatureRow';
import { PLANS, FEATURES, FREE_LIMITS } from '../types';
import { Colors } from '@theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const C = Colors;

export default function SubscriptionScreen() {
  const navigation = useNavigation<Nav>();
  const { isPremium, loading, purchasing, rcPrices, purchasePlan, restorePlan, RC_PRODUCT_ANNUAL, RC_PRODUCT_MONTHLY } = useSubscription();
  const [selectedPlan, setSelectedPlan] = React.useState<'monthly' | 'annual'>('annual');

  const activePlan = PLANS.find(p => p.id === selectedPlan)!;
  const trialPrice = selectedPlan === 'annual'
    ? (rcPrices[RC_PRODUCT_ANNUAL]  ? `${rcPrices[RC_PRODUCT_ANNUAL]}/yr`  : '$59.99/yr')
    : (rcPrices[RC_PRODUCT_MONTHLY] ? `${rcPrices[RC_PRODUCT_MONTHLY]}/mo` : '$7.99/mo');

  return (
    <SafeAreaView style={su.root}>
      <View style={su.header}>
        <Pressable onPress={() => navigation.goBack()} style={su.backBtn}><Text style={su.backText}>←</Text></Pressable>
        <Text style={su.title}>Upgrade</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={su.content} showsVerticalScrollIndicator={false}>
        <View style={su.hero}>
          <View style={su.heroEmoji}><Flag size={48} color="#D93518" strokeWidth={1.5} /></View>
          <Text style={su.heroTitle}>Runivo Plus</Text>
          <Text style={su.heroSub}>Dominate more territory. Run smarter.</Text>
        </View>

        {loading ? <ActivityIndicator color={C.red} /> : isPremium ? (
          <CurrentPlanBadge tier="runner-plus" />
        ) : (
          <>
            <View style={su.planRow}>
              {PLANS.map(p => (
                <PlanCard key={p.id} plan={p} isSelected={selectedPlan === p.id} displayPrice={rcPrices[p.rcProductId] ?? p.price} onSelect={() => setSelectedPlan(p.id)} />
              ))}
            </View>
            <Pressable style={[su.subscribeBtn, purchasing && { opacity: 0.6 }]} onPress={() => purchasePlan(activePlan.id, activePlan.rcProductId)} disabled={purchasing}>
              {purchasing ? <ActivityIndicator size="small" color="#fff" /> : (
                <>
                  <Text style={su.subscribeBtnLabel}>Start Free Trial</Text>
                  <Text style={su.subscribeBtnSub}>7 days free, then {trialPrice}</Text>
                </>
              )}
            </Pressable>
            <Pressable style={su.restoreBtn} onPress={restorePlan} disabled={purchasing}>
              <Text style={su.restoreText}>Restore purchases</Text>
            </Pressable>
          </>
        )}

        <Text style={su.sectionLabel}>What you get</Text>
        {FEATURES.map(f => <FeatureRow key={f.name} name={f.name} sub={f.sub} type="check" />)}

        <Text style={su.sectionLabel}>Free plan limits</Text>
        {FREE_LIMITS.map(l => <FeatureRow key={l} name={l} sub="" type="cross" />)}

        <Text style={su.legal}>Cancel anytime. Subscription auto-renews unless cancelled at least 24 hours before the end of the trial or billing period.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const su = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 12 },
  backBtn: { width: 32 },
  backText: { fontFamily: 'Barlow_400Regular', fontSize: 18, color: C.t2 },
  title: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 20, color: C.black },
  content: { paddingHorizontal: 20, paddingBottom: 60, gap: 6 },
  hero: { alignItems: 'center', paddingVertical: 24 },
  heroEmoji: { marginBottom: 8, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 28, color: C.black, marginBottom: 6 },
  heroSub: { fontFamily: 'Barlow_300Light', fontSize: 14, color: C.t2, textAlign: 'center' },
  planRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  subscribeBtn: { backgroundColor: C.red, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  subscribeBtnLabel: { fontFamily: 'Barlow_700Bold', fontSize: 16, color: '#fff', textTransform: 'uppercase', letterSpacing: 1 },
  subscribeBtnSub: { fontFamily: 'Barlow_300Light', fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  restoreBtn: { alignItems: 'center', paddingVertical: 10 },
  restoreText: { fontFamily: 'Barlow_300Light', fontSize: 12, color: C.t2 },
  sectionLabel: { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.t3, textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 16, marginBottom: 8 },
  legal: { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.t3, textAlign: 'center', lineHeight: 16, marginTop: 16 },
});
