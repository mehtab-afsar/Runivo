import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import { Hexagon } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import type { LiveBanner } from '../../utils/activeRunTypes';

interface Props {
  gpsError: string | null | undefined;
  isRunning: boolean;
  backgroundWarning: string | null | undefined;
  banner: LiveBanner | null;
  bannerColor: string;
}

/** GPS / background-location problems (tappable, they are fixed in Settings) and the live territory banner. */
export default function ActiveRunBannerStack({ gpsError, isRunning, backgroundWarning, banner, bannerColor }: Props) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  return (
    <View style={ss.bannerStack} pointerEvents="box-none">
      {gpsError && (
        // Tappable: a permission/location-services problem is fixed in Settings, so
        // say so and take them there instead of showing a dead-end message.
        <Pressable
          style={ss.banner}
          onPress={() => { Linking.openSettings().catch(() => {}); }}
          accessibilityRole="button"
          accessibilityHint="Opens Settings"
        >
          <Text style={ss.bannerTxt}>{gpsError}{'\n'}Tap to open Settings</Text>
        </Pressable>
      )}
      {isRunning && backgroundWarning && (
        <Pressable
          style={ss.banner}
          onPress={() => { Linking.openSettings().catch(() => {}); }}
          accessibilityRole="button"
          accessibilityHint="Opens Settings"
        >
          <Text style={ss.bannerTxt}>{backgroundWarning}</Text>
        </Pressable>
      )}
      {banner && (
        <View style={ss.banner}>
          <View style={[ss.bannerDot, { backgroundColor: bannerColor, alignItems: 'center', justifyContent: 'center' }]}><Hexagon size={14} color={C.alwaysDark} weight="bold" /></View>
          <Text style={ss.bannerTxt}>{banner.text}</Text>
        </View>
      )}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    bannerStack: { position: 'absolute', left: 16, right: 16, bottom: 28, gap: 8 },
    banner:      { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.alwaysDark, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 5 },
    bannerDot:   { width: 28, height: 28, borderRadius: 14 },
    bannerTxt:   { fontFamily: Fonts.regular, fontSize: 14, color: C.alwaysLight, flex: 1 },
  });
}
