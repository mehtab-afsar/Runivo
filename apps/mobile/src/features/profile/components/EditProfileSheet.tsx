import React, { useMemo, useState } from 'react';
import { appAlert } from '@mobile/shared/components/AppAlert';
import { View, Text, TextInput, Pressable, StyleSheet, Image, ScrollView, Modal, Switch, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Camera, LockSimple, WarningCircle } from 'phosphor-react-native';
import { useTheme, Fonts, Spacing, type AppColors } from '@theme';
import { RunnerFace, faceLook, FACE_TINTS } from '@mobile/shared/components/RunnerFace';
import { useSettings } from '@features/settings/hooks/useSettings';
import { SegmentedControl } from '@features/settings/components/SettingToggle';
import { AlertLayer } from '@mobile/shared/components/AppAlert';

// Mirrors the CHECK constraints on profiles (20260810000001_profile_field_limits.sql and later).
const NAME_MAX = 40;
const BIO_MAX = 150;
const CITY_MAX = 60;
const LINK_MAX = 100;

export type Gender = 'male' | 'female' | 'other' | null;

export interface ProfileForm {
  displayName: string;
  bio: string;
  location: string;
  instagram: string;
  strava: string;
  avatarColor: string;
  gender: Gender;
  age: string;      // kept as typed; parsed on save
  heightCm: string;
  weightKg: string;
}

/** What happens to the photo on save: a new picture, removed, or left as it is. */
export type PhotoChange = { kind: 'new'; uri: string } | { kind: 'remove' } | null;

interface Props {
  username?: string;
  initial: ProfileForm;
  photoUri: string | null;
  /** Saves everything; throws with a message the runner can read if it fails. */
  onSave: (form: ProfileForm, photo: PhotoChange) => Promise<void>;
  onClose: () => void;
}

const GENDERS: { id: Exclude<Gender, null>; label: string }[] = [
  { id: 'female', label: 'Female' },
  { id: 'male', label: 'Male' },
  { id: 'other', label: 'Other' },
];

function numberProblem(raw: string, label: string, min: number, max: number, unit: string): string | null {
  if (raw.trim() === '') return null;
  const n = Number(raw.replace(',', '.'));
  if (!Number.isFinite(n) || n < min || n > max) return `${label} should be between ${min} and ${max} ${unit}.`;
  return null;
}

/** Full-screen "Edit profile": grouped rows, Save only when something changed. */
export function EditProfileSheet({ username, initial, photoUri, onSave, onClose }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const { settings, updateSetting } = useSettings();
  const [form, setForm] = useState<ProfileForm>(initial);
  const [photo, setPhoto] = useState<PhotoChange>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof ProfileForm>(k: K, v: ProfileForm[K]) => { setForm(f => ({ ...f, [k]: v })); setError(null); };
  const seed = username || form.displayName || 'me';
  const tint = FACE_TINTS.includes(form.avatarColor) ? form.avatarColor : faceLook(seed).bg;
  const shownPhoto = photo?.kind === 'new' ? photo.uri : photo?.kind === 'remove' ? null : photoUri;

  const dirty = photo !== null || (Object.keys(initial) as (keyof ProfileForm)[]).some(k => (initial[k] ?? '') !== (form[k] ?? ''));
  const problem =
    numberProblem(form.age, 'Age', 10, 120, 'years') ??
    numberProblem(form.heightCm, 'Height', 100, 250, 'cm') ??
    numberProblem(form.weightKg, 'Weight', 20, 500, 'kg');

  const save = async () => {
    if (!dirty || saving) return;
    if (problem) { setError(problem); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({ ...form, displayName: form.displayName.trim(), bio: form.bio.trim(), location: form.location.trim() }, photo);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Couldn't save. Check your connection and try again.");
      setSaving(false);
    }
  };

  const close = () => {
    if (!dirty || saving) { if (!saving) onClose(); return; }
    appAlert('Discard changes?', "Your edits to your profile won't be saved.", [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onClose },
    ]);
  };

  const pick = async (from: 'camera' | 'library') => {
    const perm = from === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      appAlert(from === 'camera' ? 'Camera is off for Runivo' : 'Photos are off for Runivo', 'You can allow it in Settings.');
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 };
    const res = from === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!res.canceled && res.assets[0]) { setPhoto({ kind: 'new', uri: res.assets[0].uri }); setError(null); }
  };

  const editPhoto = () => {
    const hasPhoto = !!shownPhoto;
    const run = (i: number) => {
      if (i === 0) pick('camera');
      else if (i === 1) pick('library');
      else if (hasPhoto && i === 2) setPhoto({ kind: 'remove' });
    };
    {
      appAlert('Profile photo', undefined, [
        { text: 'Take photo', onPress: () => run(0) },
        { text: 'Choose from library', onPress: () => run(1) },
        ...(hasPhoto ? [{ text: 'Remove photo', style: 'destructive' as const, onPress: () => run(2) }] : []),
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <SafeAreaView style={s.root} edges={['top', 'bottom']}>
        <View style={s.header}>
          <Pressable onPress={close} hitSlop={10} accessibilityRole="button" style={s.headerSide}>
            <Text style={s.cancel}>Cancel</Text>
          </Pressable>
          <Text style={s.title} accessibilityRole="header">Edit profile</Text>
          <Pressable
            onPress={save} hitSlop={10} disabled={!dirty || saving} accessibilityRole="button"
            accessibilityState={{ disabled: !dirty || saving }} style={[s.headerSide, { alignItems: 'flex-end' }]}
          >
            {saving ? <ActivityIndicator size="small" color={C.red} /> : <Text style={[s.saveText, (!dirty) && s.saveOff]}>Save</Text>}
          </Pressable>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Photo */}
            <View style={s.hero}>
              <Pressable onPress={editPhoto} accessibilityRole="button" accessibilityLabel="Change profile photo">
                <View style={s.photo}>
                  {shownPhoto
                    ? <Image source={{ uri: shownPhoto }} style={s.photoImg} />
                    : <RunnerFace seed={seed} size={112} look={{ ...faceLook(seed), bg: tint }} />}
                </View>
                <View style={s.camBadge}><Camera size={15} color={C.white} weight="bold" /></View>
              </Pressable>
              <Pressable onPress={editPhoto} hitSlop={8} accessibilityRole="button">
                <Text style={s.photoLink}>{shownPhoto ? 'Change photo' : 'Add a photo'}</Text>
              </Pressable>
              {!shownPhoto && (
                <View style={s.swatches} accessibilityLabel="Background colour">
                  {FACE_TINTS.map(t => (
                    <Pressable
                      key={t} onPress={() => set('avatarColor', t)} hitSlop={4}
                      style={[s.swatch, { backgroundColor: t }, t === tint && s.swatchOn]}
                      accessibilityRole="button" accessibilityState={{ selected: t === tint }} accessibilityLabel="Background colour"
                    />
                  ))}
                </View>
              )}
            </View>

            {error && (
              <View style={s.errorBox} accessibilityLiveRegion="polite">
                <WarningCircle size={18} color={C.danger} weight="fill" />
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}

            {/* About you */}
            <Text style={s.section}>About you</Text>
            <View style={s.group}>
              <Row label="Name" s={s}>
                <TextInput style={s.input} value={form.displayName} onChangeText={v => set('displayName', v)} maxLength={NAME_MAX}
                  placeholder="Your name" placeholderTextColor={C.t3} autoCapitalize="words" returnKeyType="done" />
              </Row>
              <Row label="Username" s={s}>
                <View style={s.lockedRow}>
                  <Text style={[s.input, { color: C.t2, flex: 1 }]} numberOfLines={1}>@{username ?? ''}</Text>
                  <LockSimple size={14} color={C.t3} />
                </View>
              </Row>
              <Row label="City" s={s}>
                <TextInput style={s.input} value={form.location} onChangeText={v => set('location', v)} maxLength={CITY_MAX}
                  placeholder="Where you run" placeholderTextColor={C.t3} autoCapitalize="words" returnKeyType="done" />
              </Row>
              <Row label="Bio" s={s} last top>
                <View style={{ flex: 1 }}>
                  <TextInput style={[s.input, s.multiline]} value={form.bio} onChangeText={v => set('bio', v)} maxLength={BIO_MAX}
                    placeholder="A line about how you run" placeholderTextColor={C.t3} multiline />
                  <Text style={s.counter}>{form.bio.length}/{BIO_MAX}</Text>
                </View>
              </Row>
            </View>

            {/* Links */}
            <Text style={s.section}>Links</Text>
            <View style={s.group}>
              <Row label="Instagram" s={s}>
                <TextInput style={s.input} value={form.instagram} onChangeText={v => set('instagram', v.replace(/^@/, ''))} maxLength={LINK_MAX}
                  placeholder="username" placeholderTextColor={C.t3} autoCapitalize="none" autoCorrect={false} />
              </Row>
              <Row label="Strava" s={s} last>
                <TextInput style={s.input} value={form.strava} onChangeText={v => set('strava', v)} maxLength={LINK_MAX}
                  placeholder="Profile link or name" placeholderTextColor={C.t3} autoCapitalize="none" autoCorrect={false} />
              </Row>
            </View>

            {/* Body */}
            <Text style={s.section}>Body</Text>
            <View style={s.group}>
              <Row label="Gender" s={s}>
                <View style={s.segment}>
                  {GENDERS.map(g => {
                    const on = form.gender === g.id;
                    return (
                      <Pressable
                        key={g.id} onPress={() => set('gender', on ? null : g.id)} style={[s.segItem, on && s.segOn]}
                        accessibilityRole="button" accessibilityState={{ selected: on }}
                      >
                        <Text style={[s.segText, on && s.segTextOn]}>{g.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Row>
              <Row label="Age" s={s}>
                <TextInput style={s.input} value={form.age} onChangeText={v => set('age', v.replace(/[^0-9]/g, ''))} maxLength={3}
                  placeholder="Years" placeholderTextColor={C.t3} keyboardType="number-pad" />
              </Row>
              <Row label="Height" s={s}>
                <TextInput style={s.input} value={form.heightCm} onChangeText={v => set('heightCm', v.replace(/[^0-9]/g, ''))} maxLength={3}
                  placeholder="cm" placeholderTextColor={C.t3} keyboardType="number-pad" />
              </Row>
              <Row label="Weight" s={s} last>
                <TextInput style={s.input} value={form.weightKg} onChangeText={v => set('weightKg', v.replace(/[^0-9.,]/g, ''))} maxLength={5}
                  placeholder="kg" placeholderTextColor={C.t3} keyboardType="decimal-pad" />
              </Row>
            </View>
            <Text style={s.note}>Private. Only used to estimate calories and effort; never shown on your profile.</Text>

            {/* Privacy: these save straight away, like the switches in Settings. */}
            <Text style={s.section}>Privacy</Text>
            <View style={s.group}>
              {/* Same three choices and wording as Settings. This used to be a Public on/off
                  toggle, so a Private profile showed as "off: only followers" and could not
                  be set back to Private from here. */}
              <View style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
                <Text style={s.toggleTitle}>Who can see your profile</Text>
                <Text style={s.toggleSub}>Stats, zones and awards. You can hide runs one by one in Privacy.</Text>
                <View style={{ marginTop: 10 }}>
                  <SegmentedControl
                    options={['Everyone', 'Followers', 'Only me']}
                    value={settings.privacy === 'public' ? 'Everyone' : settings.privacy === 'followers' ? 'Followers' : 'Only me'}
                    onChange={v => updateSetting({ privacy: v === 'Everyone' ? 'public' : v === 'Followers' ? 'followers' : 'private' })}
                  />
                </View>
              </View>
              <ToggleRow
                s={s} C={C} last
                title="Share my runs live"
                sub="Mutual friends see you on their map while you run."
                value={settings.liveRunSharingEnabled}
                onChange={v => updateSetting({ liveRunSharingEnabled: v })}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      <AlertLayer />
    </Modal>
  );
}

function Row({ label, children, s, last, top }: { label: string; children: React.ReactNode; s: ReturnType<typeof mkStyles>; last?: boolean; top?: boolean }) {
  return (
    <View style={[s.row, top && { alignItems: 'flex-start' }, !last && s.divider]}>
      <Text style={[s.rowLabel, top && { paddingTop: 2 }]}>{label}</Text>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

function ToggleRow({ title, sub, value, onChange, last, s, C }: {
  title: string; sub: string; value: boolean; onChange: (v: boolean) => void; last?: boolean;
  s: ReturnType<typeof mkStyles>; C: AppColors;
}) {
  return (
    <View style={[s.toggleRow, !last && s.divider]}>
      <View style={{ flex: 1 }}>
        <Text style={s.toggleTitle}>{title}</Text>
        <Text style={s.toggleSub}>{sub}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: C.red, false: C.border }} thumbColor="#fff" accessibilityLabel={title} />
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:       { flex: 1, backgroundColor: C.bg },
    header:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.gutter, height: 52, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
    headerSide: { width: 72, minHeight: 44, justifyContent: 'center' },
    cancel:     { fontFamily: Fonts.regular, fontSize: 16, color: C.t1 },
    title:      { flex: 1, textAlign: 'center', fontFamily: Fonts.semiBold, fontSize: 16, color: C.t1 },
    saveText:   { fontFamily: Fonts.semiBold, fontSize: 16, color: C.red },
    saveOff:    { color: C.t3 },
    body:       { paddingHorizontal: Spacing.gutter, paddingBottom: 48 },
    hero:       { alignItems: 'center', paddingTop: 24, paddingBottom: 8 },
    photo:      { width: 112, height: 112, borderRadius: 56, overflow: 'hidden', backgroundColor: C.card },
    photoImg:   { width: 112, height: 112 },
    camBadge:   { position: 'absolute', right: 0, bottom: 4, width: 34, height: 34, borderRadius: 17, backgroundColor: C.t1, borderWidth: 3, borderColor: C.bg, alignItems: 'center', justifyContent: 'center' },
    photoLink:  { marginTop: 12, fontFamily: Fonts.semiBold, fontSize: 14, color: C.red },
    swatches:   { flexDirection: 'row', gap: 12, marginTop: 16 },
    swatch:     { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
    swatchOn:   { borderWidth: 2.5, borderColor: C.t1 },
    errorBox:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: 12, padding: 12, marginTop: 16 },
    errorText:  { flex: 1, fontFamily: Fonts.medium, fontSize: 13, lineHeight: 18, color: C.t1 },
    section:    { fontFamily: Fonts.semiBold, fontSize: 12, color: C.t2, marginTop: 26, marginBottom: 8, marginLeft: 4 },
    group:      { backgroundColor: C.card, borderRadius: 22, paddingHorizontal: 16 },
    row:        { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingVertical: 10, gap: 12 },
    divider:    { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
    rowLabel:   { width: 84, fontFamily: Fonts.medium, fontSize: 15, color: C.t1 },
    input:      { fontFamily: Fonts.regular, fontSize: 15, color: C.t1, paddingVertical: 4 },
    multiline:  { minHeight: 60, textAlignVertical: 'top' },
    counter:    { alignSelf: 'flex-end', fontFamily: Fonts.regular, fontSize: 11, color: C.t3, marginTop: 2 },
    lockedRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
    segment:    { flexDirection: 'row', backgroundColor: C.bg, borderRadius: 10, padding: 3, alignSelf: 'flex-start' },
    segItem:    { paddingHorizontal: 12, minHeight: 32, justifyContent: 'center', borderRadius: 8 },
    segOn:      { backgroundColor: C.t1 },
    segText:    { fontFamily: Fonts.medium, fontSize: 13, color: C.t2 },
    segTextOn:  { color: C.bg },
    note:       { fontFamily: Fonts.regular, fontSize: 12, lineHeight: 17, color: C.t2, marginTop: 8, marginHorizontal: 4 },
    toggleRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
    toggleTitle:{ fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1 },
    toggleSub:  { fontFamily: Fonts.regular, fontSize: 12, lineHeight: 16, color: C.t2, marginTop: 3 },
  });
}
