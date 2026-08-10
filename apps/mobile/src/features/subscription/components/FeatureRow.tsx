import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Icon } from 'phosphor-react-native';
import { useTheme, Fonts, Spacing, type AppColors } from '@theme';

interface FeatureRowProps {
  name: string;
  sub: string;
  icon: Icon;
  live: boolean;
}

export function FeatureRow({ name, sub, icon: IconComp, live }: FeatureRowProps) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  return (
    <View style={[ss.card, !live && ss.cardSoon]}>
      <View style={[ss.iconWrap, !live && ss.iconWrapSoon]}>
        <IconComp size={18} color={live ? C.red : C.t3} weight="light" />
      </View>
      <View style={ss.textWrap}>
        <View style={ss.nameRow}>
          <Text style={ss.name} numberOfLines={1}>{name}</Text>
          {!live && (
            <View style={ss.soonBadge}><Text style={ss.soonText}>SOON</Text></View>
          )}
        </View>
        <Text style={ss.sub} numberOfLines={2}>{sub}</Text>
      </View>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row', gap: 10, alignItems: 'flex-start',
      width: '48.5%', backgroundColor: C.card, borderRadius: Spacing.radius.md,
      borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 10,
    },
    cardSoon: { opacity: 0.7 },
    iconWrap: {
      width: 32, height: 32, borderRadius: 9, backgroundColor: C.redLo,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    iconWrapSoon: { backgroundColor: C.surface },
    textWrap: { flex: 1, minWidth: 0 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
    name: { fontFamily: Fonts.semiBold, fontSize: 12.5, color: C.t1, flexShrink: 1 },
    sub:  { fontFamily: Fonts.regular, fontSize: 10.5, color: C.t2, lineHeight: 14 },
    soonBadge: { backgroundColor: C.orange, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
    soonText:  { fontFamily: Fonts.bold, fontSize: 8, color: C.alwaysLight, letterSpacing: 0.4 },
  });
}
