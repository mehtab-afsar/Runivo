import React, { useMemo } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Platform, Image, ScrollView } from 'react-native';
import { MapPin, InstagramLogo, Camera, Pulse } from 'phosphor-react-native';
import { useTheme, Type, Fonts, type AppColors } from '@theme';

const SWATCHES = ['#0A0A0A', '#D93518', '#3B82F6', '#1A6B40', '#F59E0B', '#8B5CF6'];

// Mirrors the CHECK constraints in 20260810000001_profile_field_limits.sql —
// keep these two in sync; the DB constraint is the real backstop, this is just
// so the user sees the limit before hitting save instead of after.
const DISPLAY_NAME_MAX = 40;
const BIO_MAX = 150;
const LOCATION_MAX = 60;
const INSTAGRAM_MAX = 100;
const STRAVA_MAX = 200;

interface Props {
  editName: string;
  setEditName: (v: string) => void;
  editBio: string;
  setEditBio: (v: string) => void;
  editColor: string;
  setEditColor: (v: string) => void;
  editLocation: string;
  setEditLocation: (v: string) => void;
  editInstagram: string;
  setEditInstagram: (v: string) => void;
  editStrava: string;
  setEditStrava: (v: string) => void;
  editAvatarUri: string | null;
  onPickAvatar: () => void;
  onSave: () => void;
  onCancel: () => void;
}

export function EditProfileSheet({
  editName, setEditName, editBio, setEditBio,
  editColor, setEditColor,
  editLocation, setEditLocation,
  editInstagram, setEditInstagram,
  editStrava, setEditStrava,
  editAvatarUri, onPickAvatar,
  onSave, onCancel,
}: Props) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  return (
    <Pressable style={ss.overlay} onPress={onCancel}>
      <Pressable style={ss.sheet} onPress={() => {}}>
        <Text style={ss.sheetTitle}>Edit Profile</Text>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Avatar upload */}
          <Pressable style={ss.avatarWrap} onPress={onPickAvatar}>
            {editAvatarUri ? (
              <Image source={{ uri: editAvatarUri }} style={ss.avatarPreview} />
            ) : (
              <View style={ss.avatarPlaceholder}>
                <Camera size={22} color={C.t3} weight="light" />
              </View>
            )}
            <View style={ss.cameraOverlay}>
              <Camera size={12} color={C.white} weight="regular" />
            </View>
          </Pressable>

          <Text style={ss.inputLabel}>Display name</Text>
          <TextInput
            style={ss.input} value={editName} onChangeText={setEditName}
            placeholder="Your name" placeholderTextColor={C.t3} maxLength={DISPLAY_NAME_MAX}
          />

          <View style={ss.labelRow}>
            <Text style={ss.inputLabel}>Bio</Text>
            <Text style={ss.charCount}>{editBio.length}/{BIO_MAX}</Text>
          </View>
          <TextInput
            style={[ss.input, { height: 72, textAlignVertical: 'top' }]}
            value={editBio} onChangeText={setEditBio}
            placeholder="Tell your city who you are" placeholderTextColor={C.t3} multiline
            maxLength={BIO_MAX}
          />

          <Text style={ss.inputLabel}>Location</Text>
          <View style={ss.iconInput}>
            <MapPin size={14} color={C.t3} weight="light" style={{ marginRight: 8 }} />
            <TextInput
              style={ss.iconInputText} value={editLocation} onChangeText={setEditLocation}
              placeholder="City, Country" placeholderTextColor={C.t3} maxLength={LOCATION_MAX}
            />
          </View>

          <Text style={ss.inputLabel}>Instagram</Text>
          <View style={ss.iconInput}>
            <InstagramLogo size={14} color={C.t3} weight="light" style={{ marginRight: 8 }} />
            <TextInput
              style={ss.iconInputText} value={editInstagram} onChangeText={setEditInstagram}
              placeholder="@username" placeholderTextColor={C.t3} autoCapitalize="none" maxLength={INSTAGRAM_MAX}
            />
          </View>

          <Text style={ss.inputLabel}>Strava</Text>
          <View style={ss.iconInput}>
            <Pulse size={14} color={C.t3} weight="light" style={{ marginRight: 8 }} />
            <TextInput
              style={ss.iconInputText} value={editStrava} onChangeText={setEditStrava}
              placeholder="Strava profile URL" placeholderTextColor={C.t3} autoCapitalize="none" maxLength={STRAVA_MAX}
            />
          </View>

          <Text style={ss.inputLabel}>Avatar color</Text>
          <View style={ss.swatchRow}>
            {SWATCHES.map(s => (
              <Pressable
                key={s}
                style={[ss.swatch, { backgroundColor: s }, s === editColor && ss.swatchSel]}
                onPress={() => setEditColor(s)}
              />
            ))}
          </View>

          <Pressable style={ss.saveBtn} onPress={onSave}>
            <Text style={ss.saveBtnLabel}>Save</Text>
          </Pressable>
        </ScrollView>
      </Pressable>
    </Pressable>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    overlay: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(10,10,10,0.4)', justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: C.card, borderTopLeftRadius: 16, borderTopRightRadius: 16,
      padding: 24, paddingBottom: Platform.OS === 'ios' ? 36 : 24, maxHeight: '85%',
    },
    sheetTitle: { fontFamily: Fonts.semiBold, fontSize: 16, color: C.black, marginBottom: 20 },
    avatarWrap: { alignSelf: 'center', marginBottom: 20, position: 'relative' },
    avatarPreview: { width: 72, height: 72, borderRadius: 36 },
    avatarPlaceholder: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.stone, alignItems: 'center', justifyContent: 'center' },
    cameraOverlay: { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: C.alwaysDark, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.white },
    inputLabel: { ...Type.overline, color: C.t3, marginBottom: 6 },
    labelRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    charCount:  { fontFamily: Fonts.regular, fontSize: 10, color: C.t3, marginBottom: 6 },
    input: {
      fontFamily: Fonts.regular, fontSize: 14, color: C.black,
      borderWidth: 0.5, borderColor: C.border, borderRadius: 8,
      paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16,
    },
    iconInput: {
      flexDirection: 'row', alignItems: 'center',
      borderWidth: 0.5, borderColor: C.border, borderRadius: 8,
      paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16,
    },
    iconInputText: { flex: 1, fontFamily: Fonts.regular, fontSize: 14, color: C.black },
    swatchRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
    swatch: { width: 32, height: 32, borderRadius: 16 },
    swatchSel: {
      borderWidth: 3, borderColor: C.white,
      shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    },
    saveBtn: { backgroundColor: C.alwaysDark, borderRadius: 4, paddingVertical: 13, alignItems: 'center', marginBottom: 8 },
    saveBtnLabel: { fontFamily: Fonts.medium, fontSize: 12, color: C.alwaysLight, letterSpacing: 1 },
  });
}
