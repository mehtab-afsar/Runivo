import React, { useMemo } from 'react';
import { View, Text, Pressable, Switch, StyleSheet } from 'react-native';
import { useTheme, Fonts, Spacing, type AppColors } from '@theme';
import { radiusLabel, effectiveRadius } from '@shared/services/mapVisibility';

interface Props {
  /** The runner's rule: every map hidden. */
  hideAll: boolean;
  hideRadiusM?: number | null;
  /** This activity's own switch; null until loaded. */
  mapHidden: boolean | null;
  saving: boolean;
  onToggleHidden: (hide: boolean) => void;
  onOpenSettings: () => void;
}

/** Who sees this activity's map. */
export default function RunMapVisibilityRow({ hideAll, hideRadiusM, mapHidden, saving, onToggleHidden, onOpenSettings }: Props) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  return (
    <>
      <View style={[ss.card, ss.panel, ss.mapRow]}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={ss.mapRowTitle}>Show map to others</Text>
          <Text style={ss.mapRowSub}>
            {hideAll
              ? 'All maps are hidden in Map visibility'
              : `First and last ${radiusLabel(effectiveRadius(hideRadiusM))} always private`}
          </Text>
        </View>
        <Switch
          value={!hideAll && mapHidden === false}
          disabled={hideAll || mapHidden === null || saving}
          onValueChange={show => onToggleHidden(!show)}
          trackColor={{ true: C.black, false: C.border }}
          thumbColor={C.white}
          accessibilityLabel="Show this activity's map to others"
        />
      </View>
      <Pressable onPress={onOpenSettings} hitSlop={6} accessibilityRole="button">
        <Text style={ss.mapLink}>Map visibility settings</Text>
      </Pressable>
    </>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card:        { marginHorizontal: Spacing.gutter, marginBottom: 12 },
    panel:       { backgroundColor: C.card, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 14 },
    mapRow:      { flexDirection: 'row', alignItems: 'center' },
    mapRowTitle: { fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1 },
    mapRowSub:   { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, marginTop: 2 },
    mapLink:     { fontFamily: Fonts.medium, fontSize: 12.5, color: C.t2, textAlign: 'center', marginTop: -2, marginBottom: 4 },
  });
}
