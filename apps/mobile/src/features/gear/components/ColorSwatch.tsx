import React, { useMemo } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTheme, type AppColors } from '@theme';

interface ColorSwatchProps {
  selected: string | null;
  colors: string[];
  onSelect: (color: string) => void;
}

export function ColorSwatch({ selected, colors, onSelect }: ColorSwatchProps) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  return (
    <View style={s.row}>
      {colors.map(color => (
        <Pressable
          key={color}
          style={[
            s.swatch,
            { backgroundColor: color },
            selected === color && s.swatchSelected,
          ]}
          onPress={() => onSelect(color)}
        />
      ))}
    </View>
  );
}

function mkStyles(C: AppColors) { return StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 0.5, borderColor: 'transparent',
  },
  swatchSelected: {
    borderWidth: 2, borderColor: C.t1,
  },
}); }
