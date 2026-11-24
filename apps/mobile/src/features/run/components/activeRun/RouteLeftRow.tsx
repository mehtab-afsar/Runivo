import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, Type, type AppColors } from '@theme';
import { fmtDistShort } from '@mobile/shared/lib/formatters';

/** Distance left on a followed route. */
export default function RouteLeftRow({ distanceRemainingM }: { distanceRemainingM: number }) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  return (
    <View style={ss.metaRow}>
      <Text style={ss.metaTxt}>
        {distanceRemainingM >= 1000
          ? `${fmtDistShort(distanceRemainingM)} km left on route`
          : `${Math.round(distanceRemainingM)} m left on route`}
      </Text>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    metaRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12 },
    metaTxt:     { ...Type.caption, color: C.t2 },
  });
}
