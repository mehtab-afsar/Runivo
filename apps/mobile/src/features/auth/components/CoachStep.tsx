import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import * as Haptics from '@theme/hapticsGated';
import { useTheme } from '@theme';
import type { PaceXTone } from '@shared/engine/onboarding';
import { mkStep } from './onboardingStyles';
import WhyPaceX from './WhyPaceX';

const TONES: { key: PaceXTone; label: string; sample: string }[] = [
  { key: 'encouraging', label: 'Encouraging', sample: 'Nice work getting out. 3 km today counts, and your zone is fresh again.' },
  { key: 'structured',  label: 'Structured',  sample: 'Tuesday: 6 × 400 m at 4:55, 90 s jog. Hit 4 of 6 and we move on.' },
  { key: 'competitive', label: 'Competitive', sample: 'Someone just took your street. 5 km tonight and it’s yours again.' },
  { key: 'friendly',    label: 'Friendly',    sample: 'Your club runs at 6 tomorrow. Fancy joining them round the lake?' },
];

/** How PaceX should talk. The default comes from the goal; this overrides it. */
export default function CoachStep({ tone, onTone }: { tone: PaceXTone; onTone: (t: PaceXTone) => void }) {
  const C = useTheme();
  const s = useMemo(() => mkStep(C), [C]);
  return (
    <ScrollView contentContainerStyle={s.content}>
      <Text style={s.title}>How should{'\n'}PaceX talk?</Text>
      <Text style={s.sub}>Same coaching, different voice. Change it any time in Settings.</Text>
      {TONES.map(t => {
        const on = t.key === tone;
        return (
          <Pressable key={t.key} style={[s.card, on && s.cardOn, { alignItems: 'flex-start' }]}
            onPress={() => { Haptics.selectionAsync().catch(() => {}); onTone(t.key); }}
            accessibilityRole="radio" accessibilityState={{ selected: on }}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{t.label}</Text>
              <Text style={s.cardSub}>"{t.sample}"</Text>
            </View>
          </Pressable>
        );
      })}
      <WhyPaceX>it also decides what PaceX nudges you about first: progress, the plan, rivals or friends.</WhyPaceX>
    </ScrollView>
  );
}
