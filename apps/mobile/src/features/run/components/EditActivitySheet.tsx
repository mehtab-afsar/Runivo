/**
 * Edit an activity, Strava-style: title, description, how it felt, private
 * notes, who can see it, and delete.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal, View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, Image, Switch,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { X, Check, Trash, LockSimple, Plus } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import {
  AUDIENCES, MAX_PHOTOS, fetchActivityEdit, saveActivityEdit, deleteActivity, appealFlag, type ActivityEdit,
} from '../services/activityEditService';

const EFFORT_WORDS = ['', 'Very easy', 'Easy', 'Easy', 'Moderate', 'Moderate', 'Hard', 'Hard', 'Very hard', 'Very hard', 'Max'];

interface Props {
  visible: boolean;
  runId: string;
  /** Shown as the title's placeholder, e.g. "Morning run". */
  defaultTitle: string;
  onClose: () => void;
  onSaved: (e: ActivityEdit) => void;
  onDeleted: () => void;
}

export default function EditActivitySheet({ visible, runId, defaultTitle, onClose, onSaved, onDeleted }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const [form, setForm] = useState<ActivityEdit | null>(null);
  const [saving, setSaving] = useState(false);
  // The form as it was loaded, to tell real edits from an untouched sheet.
  const initialJson = useRef<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setForm(null);
    initialJson.current = null;
    const loaded = (f: ActivityEdit) => { initialJson.current = JSON.stringify(f); setForm(f); };
    fetchActivityEdit(runId)
      .then(loaded)
      .catch(() => loaded({ title: '', description: '', privateNotes: '', perceivedEffort: null, visibility: 'everyone', photos: [], excluded: false, integrityStatus: 'ok', integrityReason: null }));
  }, [visible, runId]);

  // Close X, swipe-down and Android back all land here: edits are never dropped silently.
  const requestClose = () => {
    const dirty = form != null && initialJson.current != null && JSON.stringify(form) !== initialJson.current;
    if (!dirty || saving) { onClose(); return; }
    Alert.alert('Discard changes?', 'Your edits to this activity haven\'t been saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onClose },
    ]);
  };

  const set = (patch: Partial<ActivityEdit>) => setForm(f => (f ? { ...f, ...patch } : f));

  const addPhotos = async () => {
    if (!form) return;
    const room = MAX_PHOTOS - form.photos.length;
    if (room <= 0) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photos are off', 'Allow photo access for Runivo in Settings to add pictures.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: room, quality: 0.75,
    });
    if (res.canceled) return;
    set({ photos: [...form.photos, ...res.assets.slice(0, room).map(a => ({ uri: a.uri }))] });
  };

  const appeal = () => {
    const send = async (note: string) => {
      try { await appealFlag(runId, note); set({ integrityStatus: 'appealed' }); }
      catch { Alert.alert("Couldn't send", 'Check your connection and try again.'); }
    };
    if (Platform.OS === 'ios') {
      Alert.prompt('Ask for a review', 'What happened? For example a tunnel, a ferry, or GPS lost between tall buildings.',
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Send', onPress: (note?: string) => { void send(note ?? ''); } }], 'plain-text');
    } else {
      Alert.alert('Ask for a review', 'We will check the GPS trace and put it back on the boards if it was a glitch.',
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Send', onPress: () => { void send(''); } }]);
    }
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await saveActivityEdit(runId, form);
      onSaved(form);
      onClose();
    } catch (e) {
      Alert.alert(
        "Couldn't save",
        e instanceof Error && e.message === 'not_synced'
          ? 'This activity is still uploading. Try again in a moment.'
          : 'Check your connection and try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete this activity?',
      "It's removed from your history and the feed. Zones it claimed and PACE it earned stay yours. This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            setSaving(true);
            try { await deleteActivity(runId); onClose(); onDeleted(); }
            catch { Alert.alert("Couldn't delete", 'Check your connection and try again.'); }
            finally { setSaving(false); }
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={requestClose}>
      <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.header}>
          <Pressable onPress={requestClose} style={s.iconBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
            <X size={18} color={C.t1} weight="regular" />
          </Pressable>
          <Text style={s.title}>Edit activity</Text>
          <Pressable hitSlop={8} onPress={save} style={[s.saveBtn, (!form || saving) && { opacity: 0.5 }]} disabled={!form || saving} accessibilityRole="button">
            {saving ? <ActivityIndicator size="small" color={C.bg} /> : <Check size={16} color={C.bg} weight="bold" />}
            <Text style={s.saveTxt}>Save</Text>
          </Pressable>
        </View>

        {!form ? (
          <View style={s.center}><ActivityIndicator color={C.t2} /></View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            {(form.integrityStatus === 'flagged' || form.integrityStatus === 'appealed') && (
              <View style={s.flag}>
                <Text style={s.flagTitle}>Not on leaderboards</Text>
                <Text style={s.flagText}>
                  {form.integrityReason === 'vehicle'
                    ? 'Part of this activity moved faster than anyone on foot, like a car or train.'
                    : 'The GPS jumped a long way in a few seconds.'}
                  {form.integrityStatus === 'appealed' ? " You asked for a review; we'll let you know." : ' It still counts for you; only the boards leave it out.'}
                </Text>
                {form.integrityStatus === 'flagged' && (
                  <Pressable onPress={appeal} hitSlop={6} accessibilityRole="button">
                    <Text style={s.flagLink}>Ask for a review</Text>
                  </Pressable>
                )}
              </View>
            )}
            <Text style={s.label}>Title</Text>
            <TextInput
              style={s.input}
              value={form.title}
              onChangeText={t => set({ title: t })}
              placeholder={defaultTitle}
              placeholderTextColor={C.t3}
              maxLength={80}
              returnKeyType="done"
            />

            <Text style={s.label}>Description</Text>
            <TextInput
              style={[s.input, s.multi]}
              value={form.description}
              onChangeText={t => set({ description: t })}
              placeholder="How did it go? Shown with your post."
              placeholderTextColor={C.t3}
              maxLength={2000}
              multiline
            />

            <Text style={s.label}>Photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.photoRow}>
              {form.photos.map((p, i) => (
                <View key={p.path ?? p.uri} style={s.photo}>
                  <Image source={{ uri: p.uri }} style={s.photoImg} accessibilityIgnoresInvertColors />
                  <Pressable
                    style={s.photoX}
                    hitSlop={8}
                    onPress={() => set({ photos: form.photos.filter((_, j) => j !== i) })}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove photo ${i + 1}`}
                  >
                    <X size={12} color={C.alwaysLight} weight="bold" />
                  </Pressable>
                </View>
              ))}
              {form.photos.length < MAX_PHOTOS && (
                <Pressable style={[s.photo, s.photoAdd]} onPress={addPhotos} accessibilityRole="button" accessibilityLabel="Add photos">
                  <Plus size={20} color={C.t2} weight="bold" />
                  <Text style={s.photoAddTxt}>Add</Text>
                </Pressable>
              )}
            </ScrollView>
            <Text style={s.hint}>Up to {MAX_PHOTOS}. Shown with your post to whoever can see it.</Text>

            <Text style={s.label}>How did it feel?</Text>
            <View style={s.effortRow}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
                const on = form.perceivedEffort === n;
                return (
                  <Pressable
                    key={n}
                    style={[s.effort, on && s.effortOn]}
                    onPress={() => set({ perceivedEffort: on ? null : n })}
                    accessibilityRole="button"
                    accessibilityLabel={`Effort ${n} of 10, ${EFFORT_WORDS[n]}`}
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[s.effortTxt, on && s.effortTxtOn]}>{n}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={s.hint}>{form.perceivedEffort ? `${form.perceivedEffort}/10 · ${EFFORT_WORDS[form.perceivedEffort]}` : 'Optional. Only you see it.'}</Text>

            <View style={s.labelRow}>
              <Text style={s.label}>Private notes</Text>
              <LockSimple size={12} color={C.t3} weight="bold" />
            </View>
            <TextInput
              style={[s.input, s.multi]}
              value={form.privateNotes}
              onChangeText={t => set({ privateNotes: t })}
              placeholder="Shoes, aches, how you slept. Only you see these."
              placeholderTextColor={C.t3}
              maxLength={2000}
              multiline
            />

            <Text style={s.label}>Who can see this activity</Text>
            <View style={s.card}>
              {AUDIENCES.map((a, i) => {
                const on = form.visibility === a.id;
                return (
                  <Pressable
                    key={a.id}
                    style={[s.audRow, i > 0 && s.audBorder]}
                    onPress={() => set({ visibility: a.id })}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.audTitle}>{a.label}</Text>
                      <Text style={s.audSub}>{a.sub}</Text>
                    </View>
                    <View style={[s.radio, on && s.radioOn]}>{on && <View style={s.radioDot} />}</View>
                  </Pressable>
                );
              })}
            </View>

            <View style={[s.card, s.excludeRow]}>
              <View style={{ flex: 1 }}>
                <Text style={s.audTitle}>Don't count this</Text>
                <Text style={s.audSub}>For a GPS glitch or a forgotten stop. It stays in your history but leaves your stats, leaderboards and records. Zones and PACE stay.</Text>
              </View>
              <Switch value={form.excluded} onValueChange={v => set({ excluded: v })} accessibilityLabel="Don't count this activity" />
            </View>

            <Pressable style={s.delete} onPress={confirmDelete} disabled={saving} accessibilityRole="button">
              <Trash size={16} color={C.red} weight="regular" />
              <Text style={s.deleteTxt}>Delete activity</Text>
            </Pressable>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:     { flex: 1, backgroundColor: C.bg },
    header:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14 },
    iconBtn:  { width: 36, height: 36, borderRadius: 18, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
    title:    { fontFamily: Fonts.semiBold, fontSize: 17, color: C.t1 },
    saveBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: C.t1 },
    saveTxt:  { fontFamily: Fonts.semiBold, fontSize: 13.5, color: C.bg },
    center:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll:   { paddingHorizontal: 18, paddingBottom: 48 },
    label:    { fontFamily: Fonts.medium, fontSize: 12, color: C.t2, marginTop: 18, marginBottom: 8 },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18, marginBottom: 8 },
    input:    { backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: Fonts.regular, fontSize: 15, color: C.t1 },
    multi:    { minHeight: 88, textAlignVertical: 'top' },
    effortRow:{ flexDirection: 'row', gap: 4 },
    effort:   { flex: 1, height: 36, borderRadius: 8, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
    effortOn: { backgroundColor: C.red },
    effortTxt:{ fontFamily: Fonts.semiBold, fontSize: 13, color: C.t2 },
    effortTxtOn: { color: C.alwaysLight },
    hint:     { fontFamily: Fonts.regular, fontSize: 12, color: C.t3, marginTop: 6 },
    card:     { backgroundColor: C.card, borderRadius: 16 },
    audRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
    audBorder:{ borderTopWidth: 1, borderTopColor: C.border },
    audTitle: { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
    audSub:   { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, marginTop: 2 },
    radio:    { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: C.t3, alignItems: 'center', justifyContent: 'center' },
    radioOn:  { borderColor: C.t1 },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.t1 },
    delete:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 28, height: 46, borderRadius: 12, borderWidth: 1, borderColor: C.border },
    flag:     { backgroundColor: C.amberBg, borderRadius: 12, padding: 12, marginTop: 8 },
    flagTitle:{ fontFamily: Fonts.semiBold, fontSize: 14, color: C.amber },
    flagText: { fontFamily: Fonts.regular, fontSize: 12.5, color: C.t1, marginTop: 4, lineHeight: 18 },
    flagLink: { fontFamily: Fonts.semiBold, fontSize: 13, color: C.t1, textDecorationLine: 'underline', marginTop: 8 },
    photoRow: { gap: 8 },
    photo:    { width: 84, height: 84, borderRadius: 12, overflow: 'hidden', backgroundColor: C.card },
    photoImg: { width: '100%', height: '100%' },
    photoX:   { position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
    photoAdd: { alignItems: 'center', justifyContent: 'center', gap: 2, borderWidth: 1, borderStyle: 'dashed', borderColor: C.border },
    photoAddTxt: { fontFamily: Fonts.medium, fontSize: 12, color: C.t2 },
    excludeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginTop: 18 },
    deleteTxt:{ fontFamily: Fonts.semiBold, fontSize: 14, color: C.red },
  });
}
