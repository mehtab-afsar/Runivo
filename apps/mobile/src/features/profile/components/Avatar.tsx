import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts } from '@theme';

interface AvatarProps {
  name: string;
  color: string;
  size?: number;
}

export function Avatar({ name, color, size = 56 }: AvatarProps) {
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <View
      style={[
        ss.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
      ]}
    >
      <Text style={[ss.avatarText, { fontSize: size * 0.35 }]}>{initials}</Text>
    </View>
  );
}

const ss = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  // White initials on a fixed saturated avatar color — same in both themes.
  avatarText: { fontFamily: Fonts.semiBold, color: Colors.alwaysLight },
});
