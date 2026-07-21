import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Lock } from 'phosphor-react-native';
import { useTheme, Type, Spacing, type AppColors } from '@theme';
import { PrimaryButton } from '@mobile/shared/components/PrimaryButton';

interface Props {
  ownedCount: number;
  territoryLimit: number;
  onUpgrade: () => void;
}

export function TerritoryCapBanner({ ownedCount, territoryLimit, onUpgrade }: Props) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);

  return (
    <View style={ss.wrap}>
      <View style={ss.iconWrap}>
        <Lock size={16} color={C.accent} weight="light" />
      </View>
      <View style={ss.textBlock}>
        <Text style={ss.title}>Free plan limit reached</Text>
        <Text style={ss.body}>
          You own {ownedCount}/{territoryLimit} zones. Upgrade to keep claiming territory.
        </Text>
      </View>
      <PrimaryButton label="Upgrade" onPress={onUpgrade} size="sm" variant="accent" />
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    wrap: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      marginHorizontal: Spacing.gutter, marginBottom: 16,
      backgroundColor: C.accentMuted, borderWidth: 0.5, borderColor: C.border,
      borderRadius: 16, padding: 14,
    },
    iconWrap: {
      width: 32, height: 32, borderRadius: 16, backgroundColor: C.card,
      alignItems: 'center', justifyContent: 'center',
    },
    textBlock: { flex: 1 },
    title: { ...Type.label, color: C.t1, marginBottom: 2 },
    body:  { ...Type.caption, color: C.t2, lineHeight: 16 },
  });
}
