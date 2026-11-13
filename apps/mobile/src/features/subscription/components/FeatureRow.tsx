import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Icon } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';

interface FeatureRowProps {
  name: string;
  sub: string;
  icon: Icon;
  live: boolean;
  isLast?: boolean;
}

// One flowing list, not a grid of bordered boxes — six near-identical little
// cards in a 2-up wrap read like a SaaS pricing table. A single accent (gold,
// reserved for Plus across the app) instead of red-icons/orange-badges/
// gray-borders all competing at once.
export function FeatureRow({ name, sub, icon: IconComp, live, isLast }: FeatureRowProps) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  return (
    <View style={[ss.row, !isLast && ss.rowBorder]}>
      <View style={[ss.iconWrap, !live && ss.iconWrapSoon]}>
        <IconComp size={17} color={live ? C.gold : C.t3} weight="light" />
      </View>
      <View style={ss.textWrap}>
        <Text style={ss.name}>{name}</Text>
        <Text style={ss.sub}>{sub}</Text>
      </View>
      {!live && <Text style={ss.soon}>Soon</Text>}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 14 },
    rowBorder: { borderBottomWidth: 0.5, borderBottomColor: C.border },
    iconWrap: {
      width: 34, height: 34, borderRadius: 17, backgroundColor: `${C.gold}1F`,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
    },
    iconWrapSoon: { backgroundColor: C.surface },
    textWrap: { flex: 1, minWidth: 0 },
    name: { fontFamily: Fonts.semiBold, fontSize: 13.5, color: C.t1, marginBottom: 2 },
    sub:  { fontFamily: Fonts.regular, fontSize: 11.5, color: C.t2, lineHeight: 16 },
    soon: { fontFamily: Fonts.medium, fontSize: 11.5, color: C.t3, marginTop: 2 },
  });
}
