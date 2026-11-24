import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme, Fonts, Spacing, type AppColors } from '@theme';

/** Free runner at the 10-zone cap: this run's loop was not claimed. */
export default function RunZoneLimitCard({ onUpgrade }: { onUpgrade: () => void }) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  return (
    <View style={[ss.card, ss.surface, ss.limitCard]}>
      <Text style={ss.limitTitle}>Your loop wasn't claimed</Text>
      <Text style={ss.limitBody}>
        Free runners hold 10 zones at once, and you hold 10. Runivo Plus has no limit, so every loop you close stays yours.
      </Text>
      <Pressable style={ss.limitBtn} onPress={onUpgrade} accessibilityRole="button">
        <Text style={ss.limitBtnText}>Hold more zones with Plus</Text>
      </Pressable>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card:         { marginHorizontal: Spacing.gutter, marginBottom: 12 },
    surface:      { backgroundColor: C.card, borderRadius: 24 },
    limitCard:    { padding: 16, borderWidth: 1.5, borderColor: C.red },
    limitTitle:   { fontFamily: Fonts.semiBold, fontSize: 16, color: C.t1 },
    limitBody:    { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 20, color: C.t2, marginTop: 6 },
    limitBtn:     { marginTop: 14, height: 46, borderRadius: 999, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' },
    limitBtnText: { fontFamily: Fonts.semiBold, fontSize: 15, color: '#FFFFFF' },
  });
}
