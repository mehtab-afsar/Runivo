import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import type { ViewStyle } from 'react-native';
import { Gear } from 'phosphor-react-native';
import { useTheme, Fonts } from '@theme';


interface AvatarProps {
  uri?: string | null;
  name: string;
  size?: number;
  onPress?: () => void;
  showEditOverlay?: boolean;
  style?: ViewStyle;
}

export function Avatar({ uri, name, size = 44, onPress, showEditOverlay, style }: AvatarProps) {
  const C = useTheme();
  const initial  = (name.trim()[0] ?? '?').toUpperCase();
  const fontSize = Math.round(size * 0.4);
  const overlaySize = Math.round(size * 0.32);

  const inner = (
    <View style={[styles.circle, {
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: uri ? 'transparent' : C.accent,
    }, style]}>
      {uri
        ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
        : <Text style={[styles.initial, { fontSize, color: C.alwaysLight }]}>{initial}</Text>
      }
      {showEditOverlay && (
        <View style={[styles.overlay, {
          width: overlaySize, height: overlaySize, borderRadius: overlaySize / 2,
          backgroundColor: C.surface, borderColor: C.border,
        }]}>
          <Gear size={overlaySize * 0.55} color={C.t2} weight="light" />
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} hitSlop={8}>
        {inner}
      </Pressable>
    );
  }
  return inner;
}

const styles = StyleSheet.create({
  circle:  { alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: Fonts.semiBold },
  overlay: {
    position: 'absolute', bottom: 0, right: 0,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
});
