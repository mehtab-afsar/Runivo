import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { ShieldAlert } from '@mobile/shared/icons/lucideCompat';
import { territoryPalette } from '@theme/territory';
import { useTheme, useIsDark, Fonts } from '@theme';
import { mkStep } from './onboardingStyles';

/** Asked with the real reason, before the system prompt. */
export default function NotificationsStep() {
  const C = useTheme();
  const z = territoryPalette(useIsDark());
  const s = useMemo(() => mkStep(C), [C]);
  return (
    <ScrollView contentContainerStyle={s.content}>
      <Text style={s.eyebrow}>Alerts</Text>
      <Text style={s.title}>Know when{'\n'}they come{'\n'}for your zone</Text>
      <Text style={s.sub}>We’ll tell you when someone takes your zone, when one is about to fade, and when your streak is at risk. Never between 10 pm and 7 am.</Text>

      <View style={[st.push, { backgroundColor: C.card }]}>
        <View style={[st.icon, { backgroundColor: C.bg }]}>
          <ShieldAlert size={20} color={z.rival} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={st.row}>
            <Text style={[st.app, { color: C.t2 }]}>runivo</Text>
            <Text style={[st.app, { color: C.t3 }]}>now</Text>
          </View>
          <Text style={[st.title, { color: C.t1 }]}>Your zone is under attack</Text>
          <Text style={[st.body, { color: C.t2 }]}>maya_runs took part of your block near the park. Run it to take it back.</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  push:  {
    flexDirection: 'row', gap: 12, padding: 14, borderRadius: 20, marginTop: 6,
    shadowColor: '#14120F', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 4,
  },
  icon:  { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  row:   { flexDirection: 'row', justifyContent: 'space-between' },
  app:   { fontFamily: Fonts.medium, fontSize: 12 },
  title: { fontFamily: Fonts.semiBold, fontSize: 15, marginTop: 2 },
  body:  { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 19, marginTop: 2 },
});
