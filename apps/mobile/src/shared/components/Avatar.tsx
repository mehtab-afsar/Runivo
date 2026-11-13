import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import type { ViewStyle } from 'react-native';
import { Gear } from 'phosphor-react-native';
import { useTheme, Fonts } from '@theme';
import { RunnerFace, faceLook, FACE_TINTS } from './RunnerFace';

interface AvatarProps {
  uri?: string | null;
  name: string;
  /** Per-user background color (e.g. from avatarColor(name)). Falls back to the
   *  theme accent when omitted — always themed, never a hardcoded hex. */
  color?: string;
  size?: number;
  onPress?: () => void;
  showEditOverlay?: boolean;
  style?: ViewStyle;
  /** Leading characters of `name` shown as initials. Defaults to 2. */
  initialsLength?: 1 | 2;
  /** Stable id for the illustrated face (user id). Defaults to `name`. */
  seed?: string;
  /** Show letters instead of the illustrated face (clubs, organisers). */
  initialsOnly?: boolean;
}

export function Avatar({
  uri, name, color, size = 56, onPress, showEditOverlay, style, initialsLength = 2, seed, initialsOnly,
}: AvatarProps) {
  const C = useTheme();
  const initials = name.trim().slice(0, initialsLength).toUpperCase() || '?';
  const fontSize = Math.round(size * (initialsLength === 1 ? 0.4 : 0.35));
  const overlaySize = Math.round(size * 0.32);

  const inner = (
    <View style={[styles.circle, {
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: uri || !initialsOnly ? 'transparent' : (color ?? C.accent),
    }, style]}>
      {uri
        ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
        : initialsOnly
          ? <Text style={[styles.initial, { fontSize, color: C.alwaysLight }]}>{initials}</Text>
          : <RunnerFace
              seed={seed ?? name}
              size={size}
              look={color && FACE_TINTS.includes(color) ? { ...faceLook(seed ?? name), bg: color } : undefined}
            />
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
