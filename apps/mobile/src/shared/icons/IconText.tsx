import React from 'react';
import { View, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import type { Icon, IconWeight } from 'phosphor-react-native';

/** An icon before a label, one gap, both centred. Use instead of an emoji in front of text. */
export function IconText({ Icon, text, color, size = 18, weight = 'fill', textStyle, style, gap = 8 }: {
  Icon: Icon; text: string; color: string; size?: number; weight?: IconWeight;
  textStyle?: StyleProp<TextStyle>; style?: StyleProp<ViewStyle>; gap?: number;
}) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap }, style]}>
      <Icon size={size} color={color} weight={weight} />
      <Text style={[textStyle, { color }]}>{text}</Text>
    </View>
  );
}
