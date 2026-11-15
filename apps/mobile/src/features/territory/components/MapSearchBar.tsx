import React, { useMemo, useState } from 'react';
import { View, TextInput, Text, StyleSheet, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import { Search } from 'lucide-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';

interface Props {
  /** Called with [lng, lat] of the place found. */
  onFound: (coord: [number, number]) => void;
  /** Shown at the right end of the bar (the Saved button on the map). */
  trailing?: React.ReactNode;
}

/**
 * "Search a street or park": the phone's own geocoder (expo-location), then
 * the map flies there. Nothing typed here is stored.
 */
export function MapSearchBar({ onFound, trailing }: Props) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [miss, setMiss] = useState(false);

  const search = async () => {
    const query = q.trim();
    if (query.length < 2) return;
    setBusy(true); setMiss(false);
    try {
      const results = await Location.geocodeAsync(query);
      const r = results?.[0];
      if (r && Number.isFinite(r.latitude) && Number.isFinite(r.longitude)) onFound([r.longitude, r.latitude]);
      else setMiss(true);
    } catch {
      setMiss(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <View style={ss.field}>
        <View style={ss.lead}><Search size={20} color={C.t1} strokeWidth={1.8} /></View>
        <TextInput
          style={ss.input}
          value={q}
          onChangeText={t => { setQ(t); setMiss(false); }}
          placeholder="Zones near me"
          placeholderTextColor={C.t2}
          returnKeyType="search"
          onSubmitEditing={search}
          autoCorrect={false}
          accessibilityLabel="Search a street or park"
        />
        {busy && <ActivityIndicator size="small" color={C.t2} />}
        {trailing}
      </View>
      {miss && <Text style={ss.miss}>No place found for “{q.trim()}”</Text>}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    field: {
      height: 56, borderRadius: 28, backgroundColor: C.card, flexDirection: 'row', alignItems: 'center',
      gap: 10, overflow: 'hidden',
      shadowColor: '#17181A', shadowOpacity: 0.10, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 4,
    },
    lead:  { height: 56, paddingLeft: 18, paddingRight: 12, justifyContent: 'center', borderRightWidth: 1, borderRightColor: C.border },
    input: { flex: 1, fontFamily: Fonts.regular, fontSize: 16, color: C.t1, paddingVertical: 0, paddingLeft: 4 },
    miss:  { fontFamily: Fonts.medium, fontSize: 12, color: C.t2, marginTop: 6, marginLeft: 6 },
  });
}
