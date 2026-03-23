import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';

interface ColorSwatchProps {
  selected: string | null;
  colors: string[];
  onSelect: (color: string) => void;
}

export function ColorSwatch({ selected, colors, onSelect }: ColorSwatchProps) {
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

const s = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1, borderColor: 'transparent',
  },
  swatchSelected: {
    borderWidth: 2, borderColor: '#0A0A0A',
  },
});
