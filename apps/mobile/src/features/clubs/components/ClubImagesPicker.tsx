// Club cover banner with the club picture overlapping its bottom edge, as on
// club pages. Tap either to choose from the library (cropped to 3:1 and 1:1).
import React, { useMemo } from 'react';
import { View, Text, Image, Pressable, StyleSheet, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, ImageSquare } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';

async function pick(aspect: [number, number]): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Photos needed', 'Allow access to your photos in Settings to add a club picture.');
    return null;
  }
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect, quality: 0.8 });
  return !r.canceled && r.assets[0] ? r.assets[0].uri : null;
}

export function ClubImagesPicker({ avatar, banner, onAvatar, onBanner, initials }: {
  avatar: string | null; banner: string | null;
  onAvatar: (uri: string) => void; onBanner: (uri: string) => void;
  /** Shown in the picture circle until one is chosen. */
  initials: string;
}) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  return (
    <View style={s.wrap}>
      <Pressable style={s.banner} onPress={async () => { const u = await pick([3, 1]); if (u) onBanner(u); }} accessibilityRole="button" accessibilityLabel={banner ? 'Change cover photo' : 'Add a cover photo'}>
        {banner
          ? <Image source={{ uri: banner }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          : (
            <View style={s.bannerEmpty}>
              <ImageSquare size={22} color={C.t2} />
              <Text style={s.bannerTxt}>Add a cover photo</Text>
            </View>
          )}
        {!!banner && <View style={s.editPill}><Camera size={14} color="#FFFFFF" weight="bold" /><Text style={s.editPillTxt}>Change</Text></View>}
      </Pressable>
      <Pressable style={s.avatar} onPress={async () => { const u = await pick([1, 1]); if (u) onAvatar(u); }} accessibilityRole="button" accessibilityLabel={avatar ? 'Change club picture' : 'Add a club picture'}>
        {avatar
          ? <Image source={{ uri: avatar }} style={s.avatarImg} />
          : <Text style={s.initials}>{initials || '·'}</Text>}
        <View style={s.camBadge}><Camera size={13} color={C.t1} weight="bold" /></View>
      </Pressable>
    </View>
  );
}

function mk(C: AppColors) {
  return StyleSheet.create({
    wrap:        { paddingBottom: 40 },
    banner:      { height: 120, borderRadius: 22, overflow: 'hidden', backgroundColor: C.card, borderWidth: 1.5, borderColor: C.border, borderStyle: 'dashed' },
    bannerEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
    bannerTxt:   { fontFamily: Fonts.medium, fontSize: 14, color: C.t2 },
    editPill:    { position: 'absolute', right: 10, top: 10, flexDirection: 'row', alignItems: 'center', gap: 5, height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: 'rgba(23,24,26,0.7)' },
    editPillTxt: { fontFamily: Fonts.medium, fontSize: 12, color: '#FFFFFF' },
    avatar:      { position: 'absolute', left: 18, bottom: 0, width: 80, height: 80, borderRadius: 24, backgroundColor: C.alwaysDark, borderWidth: 4, borderColor: C.bg, alignItems: 'center', justifyContent: 'center' },
    avatarImg:   { width: '100%', height: '100%', borderRadius: 20 },
    initials:    { fontFamily: Fonts.semiBold, fontSize: 24, color: C.lime },
    camBadge:    { position: 'absolute', right: -6, bottom: -6, width: 28, height: 28, borderRadius: 14, backgroundColor: C.card, borderWidth: 2, borderColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  });
}
