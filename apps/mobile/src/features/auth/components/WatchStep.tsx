/**
 * Optional (PRD O2): connect a running watch so runs recorded on it come in. Apple Watch runs arrive through Apple Health (previous
 * step); Garmin, COROS and Polar connect here.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Platform } from 'react-native';
import { Watch, Check } from 'lucide-react-native';
import { track } from '@shared/services/analytics';
import { connectProvider } from '@features/settings/services/deviceOAuthService';
import { useTheme } from '@theme';
import { mkStep } from './onboardingStyles';

const PROVIDERS: { id: string; name: string; sub: string }[] = [
  { id: 'garmin', name: 'Garmin', sub: 'Forerunner, Fenix, Venu and more' },
  { id: 'coros',  name: 'COROS',  sub: 'Pace, Apex, Vertix' },
  { id: 'polar',  name: 'Polar',  sub: 'Pacer, Vantage, Grit' },
];

export default function WatchStep() {
  const C = useTheme();
  const s = useMemo(() => mkStep(C), [C]);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function connect(id: string) {
    setBusy(id); setError(null);
    try {
      const r = await connectProvider(id);
      if (r === 'connected') { setDone(prev => new Set(prev).add(id)); track('onboarding_watch_connected', { provider: id }); }
    } catch {
      setError("That didn't connect. You can try again here or later in Settings → Connected devices.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={s.content}>
      <Text style={s.eyebrow}>Optional</Text>
      <Text style={s.title}>Run with{'\n'}your watch</Text>
      <Text style={s.sub}>
        Runs from your watch come into Runivo after you sync, so your history and training stay in one place.
        {Platform.OS === 'ios' ? ' Apple Watch runs come through Apple Health.' : ''}
      </Text>

      {PROVIDERS.map(p => {
        const on = done.has(p.id);
        return (
          <Pressable
            key={p.id}
            style={[s.card, on && s.cardOn, { marginBottom: 10 }]}
            onPress={() => !on && !busy && connect(p.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: on, busy: busy === p.id }}
          >
            <View style={[s.cardIcon, on && s.cardIconOn]}>
              {on ? <Check size={22} color={C.red} strokeWidth={2.4} /> : <Watch size={22} color={C.t1} strokeWidth={2} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{p.name}</Text>
              <Text style={s.cardSub}>{on ? 'Connected' : p.sub}</Text>
            </View>
            {busy === p.id ? <ActivityIndicator color={C.red} /> : !on ? <Text style={s.cardSub}>Connect</Text> : null}
          </Pressable>
        );
      })}

      {!!error && <Text style={s.note}>{error}</Text>}
      <Text style={s.note}>No watch? Skip this. Your phone records everything you need.</Text>
    </ScrollView>
  );
}
