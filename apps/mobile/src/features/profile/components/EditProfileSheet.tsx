import React, { useMemo } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, Image, ScrollView, Modal, Switch,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Camera } from 'lucide-react-native';
import { useTheme, Fonts, Spacing, type AppColors } from '@theme';
import { RunnerFace, faceLook, FACE_TINTS } from '@mobile/shared/components/RunnerFace';
import { useSettings } from '@features/settings/hooks/useSettings';


// Mirrors the CHECK constraints in 20260810000001_profile_field_limits.sql.
const DISPLAY_NAME_MAX = 40;
const BIO_MAX = 150;
const LOCATION_MAX = 60;

interface Props {
  username?: string;
  editName: string;
  setEditName: (v: string) => void;
  editBio: string;
  setEditBio: (v: string) => void;
  editColor: string;
  setEditColor: (v: string) => void;
  editLocation: string;
  setEditLocation: (v: string) => void;
  // Kept for the profile hook's shape; the mock's editor has no social links.
  editInstagram?: string;
  setEditInstagram?: (v: string) => void;
  editStrava?: string;
  setEditStrava?: (v: string) => void;
  editAvatarUri: string | null;
  onPickAvatar: () => void;
  onSave: () => void;
  onCancel: () => void;
}

/** Full-screen "Edit profile", laid out as in the mock. */
export function EditProfileSheet({
  username, editName, setEditName, editBio, setEditBio,
  editColor, setEditColor, editLocation, setEditLocation,
  editAvatarUri, onPickAvatar, onSave, onCancel,
}: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const { settings, updateSetting } = useSettings();
  const seed = username || editName || 'me';
  const tint = FACE_TINTS.includes(editColor) ? editColor : faceLook(seed).bg;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
      <SafeAreaView style={s.root} edges={['top', 'bottom']}>
        <View style={s.header}>
          <Pressable style={s.close} onPress={onCancel} hitSlop={8} accessibilityLabel="Close">
            <X size={18} color={C.t1} strokeWidth={2} />
          </Pressable>
          <Text style={s.title}>Edit profile</Text>
          <Pressable style={s.save} onPress={onSave} accessibilityRole="button">
            <Text style={s.saveText}>Save</Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Pressable style={s.photoWrap} onPress={onPickAvatar} accessibilityLabel="Change photo">
              <View style={s.photo}>
                {editAvatarUri
                  ? <Image source={{ uri: editAvatarUri }} style={s.photoImg} />
                  : <RunnerFace seed={seed} size={100} look={{ ...faceLook(seed), bg: tint }} />}
              </View>
              <View style={s.camBadge}><Camera size={14} color="#fff" strokeWidth={2.2} /></View>
            </Pressable>
            <Pressable onPress={onPickAvatar} hitSlop={6}><Text style={s.changePhoto}>Change photo</Text></Pressable>

            <View style={s.swatches}>
              {FACE_TINTS.map(t => (
                <Pressable
                  key={t}
                  onPress={() => setEditColor(t)}
                  style={[s.swatch, { backgroundColor: t }, t === tint && s.swatchOn]}
                  accessibilityLabel="Photo background"
                />
              ))}
            </View>

            <Field label="Name" s={s}>
              <TextInput style={s.input} value={editName} onChangeText={setEditName} maxLength={DISPLAY_NAME_MAX}
                placeholder="Your name" placeholderTextColor={C.t3} />
            </Field>
            <Field label="Username" s={s}>
              <Text style={[s.input, { color: C.t2 }]}>{username ?? ''}</Text>
            </Field>
            <Field label="Bio" s={s}>
              <TextInput style={[s.input, s.multiline]} value={editBio} onChangeText={setEditBio} maxLength={BIO_MAX}
                placeholder="Tell your city who you are" placeholderTextColor={C.t3} multiline />
            </Field>
            <Field label="City" s={s}>
              <TextInput style={s.input} value={editLocation} onChangeText={setEditLocation} maxLength={LOCATION_MAX}
                placeholder="Your city" placeholderTextColor={C.t3} />
            </Field>

            <Text style={s.section}>Privacy</Text>
            <View style={s.card}>
              <ToggleRow
                s={s} C={C}
                title="Share my runs live"
                sub="Mutual friends see you on their map while you run. Off when you stop."
                value={settings.liveRunSharingEnabled}
                onChange={v => updateSetting({ liveRunSharingEnabled: v })}
              />
              <ToggleRow
                s={s} C={C} last
                title="Public profile"
                sub="Anyone can see your stats and zones."
                value={settings.privacy === 'public'}
                onChange={v => updateSetting({ privacy: v ? 'public' : 'followers' })}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function Field({ label, children, s }: { label: string; children: React.ReactNode; s: ReturnType<typeof mkStyles> }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function ToggleRow({ title, sub, value, onChange, last, s, C }: {
  title: string; sub: string; value: boolean; onChange: (v: boolean) => void; last?: boolean;
  s: ReturnType<typeof mkStyles>; C: AppColors;
}) {
  return (
    <View style={[s.toggleRow, !last && s.toggleDivider]}>
      <View style={{ flex: 1 }}>
        <Text style={s.toggleTitle}>{title}</Text>
        <Text style={s.toggleSub}>{sub}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: C.red, false: C.border }} thumbColor="#fff" />
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:     { flex: 1, backgroundColor: C.bg },
    header:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.gutter, paddingVertical: 10 },
    close:    { width: 36, height: 36, borderRadius: 18, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
    title:    { flex: 1, textAlign: 'center', fontFamily: Fonts.semiBold, fontSize: 16, color: C.t1 },
    save:     { backgroundColor: C.t1, borderRadius: 18, paddingHorizontal: 16, height: 34, justifyContent: 'center' },
    saveText: { fontFamily: Fonts.semiBold, fontSize: 14, color: C.bg },
    body:     { paddingHorizontal: Spacing.gutter, paddingBottom: 40, alignItems: 'stretch' },
    photoWrap:{ alignSelf: 'center', marginTop: 16 },
    photo:    { width: 100, height: 100, borderRadius: 50, overflow: 'hidden' },
    photoImg: { width: 100, height: 100 },
    camBadge: {
      position: 'absolute', right: -2, bottom: 6, width: 30, height: 30, borderRadius: 15,
      backgroundColor: C.red, borderWidth: 2, borderColor: C.bg, alignItems: 'center', justifyContent: 'center',
    },
    changePhoto: { alignSelf: 'center', marginTop: 10, fontFamily: Fonts.semiBold, fontSize: 13, color: C.red },
    swatches: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 18, marginBottom: 18 },
    swatch:   { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
    swatchOn: { borderWidth: 2, borderColor: C.t1 },
    field:    { backgroundColor: C.card, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10 },
    fieldLabel: { fontFamily: Fonts.regular, fontSize: 11, color: C.t3, marginBottom: 2 },
    input:    { fontFamily: Fonts.regular, fontSize: 15, color: C.t1, paddingVertical: 2 },
    multiline:{ minHeight: 44, textAlignVertical: 'top' },
    section:  { fontFamily: Fonts.medium, fontSize: 13, color: C.t2, marginTop: 14, marginBottom: 8 },
    card:     { backgroundColor: C.card, borderRadius: 16, paddingHorizontal: 14 },
    toggleRow:{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
    toggleDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
    toggleTitle:   { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
    toggleSub:     { fontFamily: Fonts.regular, fontSize: 12, lineHeight: 16, color: C.t2, marginTop: 3 },
  });
}
