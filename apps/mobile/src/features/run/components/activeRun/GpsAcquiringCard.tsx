import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme, Type, Fonts, type AppColors } from '@theme';

/** Centered "Finding GPS…" card shown while a running session has no fix yet. */
export default function GpsAcquiringCard() {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  return (
    <View style={ss.gpsAcquiring}>
      <ActivityIndicator size="small" color={C.red} />
      <Text style={ss.gpsAcquiringText}>Finding GPS…</Text>
      <Text style={ss.gpsAcquiringSub}>Step outside for a better signal</Text>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    gpsAcquiring:     { position: 'absolute', top: '35%', alignSelf: 'center', alignItems: 'center', gap: 6, backgroundColor: C.card, paddingHorizontal: 24, paddingVertical: 16, borderRadius: 22, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 14, elevation: 6 },
    gpsAcquiringText: { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
    gpsAcquiringSub:  { ...Type.caption, color: C.t2 },
  });
}
