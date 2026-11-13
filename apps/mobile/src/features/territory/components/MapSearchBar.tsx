import React, { useMemo, useState } from 'react';
import { View, TextInput, Text, StyleSheet, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import { Search } from 'lucide-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';

interface Props {
  /** Called with [lng, lat] of the place found. */
  onFound: (coord: [number, number]) => void;
}

/**
 * "Search a street or park": the phone's own geocoder (expo-location), then
 * the map flies there. Nothing typed here is stored.
 */
export function MapSearchBar({ onFound }: Props) {
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
        <Search size={16} color={C.t2} strokeWidth={1.8} />
        <TextInput
          style={ss.input}
          value={q}
          onChangeText={t => { setQ(t); setMiss(false); }}
          placeholder="Search a street or park"
          placeholderTextColor={C.t2}
          returnKeyType="search"
          onSubmitEditing={search}
          autoCorrect={false}
          accessibilityLabel="Search a street or park"
        />
        {busy && <ActivityIndicator size="small" color={C.t2} />}
      </View>
      {miss && <Text style={ss.miss}>No place found for “{q.trim()}”</Text>}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    field: {
      height: 46, borderRadius: 16, backgroundColor: C.card, flexDirection: 'row', alignItems: 'center',
      gap: 10, paddingHorizontal: 14,
      shadowColor: '#14120F', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1,
    },
    input: { flex: 1, fontFamily: Fonts.regular, fontSize: 14, color: C.t1, paddingVertical: 0 },
    miss:  { fontFamily: Fonts.medium, fontSize: 12, color: C.t2, marginTop: 6, marginLeft: 6 },
  });
}
