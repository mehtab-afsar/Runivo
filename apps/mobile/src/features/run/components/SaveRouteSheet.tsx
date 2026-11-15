import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  Modal, ScrollView, Switch, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from '@theme/hapticsGated';
import { X } from 'phosphor-react-native';
import { saveSavedRoute, type StoredSavedRoute } from '@shared/services/store';
import { pushSavedRoutes } from '@shared/services/sync';
import { useTheme, Type, Fonts, type AppColors } from '@theme';
import { fmtDist } from '@mobile/shared/lib/formatters';
import { ROUTE_ICON_OPTIONS as ICON_OPTIONS } from '@mobile/shared/constants/routeIcons';

interface SaveRouteSheetProps {
  visible: boolean;
  gpsPoints: { lat: number; lng: number }[];
  distanceM: number;
  durationSec: number | null;
  sourceRunId: string | null;
  onClose: () => void;
}

export default function SaveRouteSheet({
  visible, gpsPoints, distanceM, durationSec, sourceRunId, onClose,
}: SaveRouteSheetProps) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const [name, setName]         = useState('');
  const [emoji, setEmoji]       = useState('run');
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving]     = useState(false);

  const handleSave = async () => {
    if (!name.trim() || gpsPoints.length < 2) return;
    setSaving(true);
    const route: StoredSavedRoute = {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      name: name.trim(),
      emoji,
      distanceM,
      durationSec,
      gpsPoints,
      isPublic,
      sourceRunId,
      synced: false,
      createdAt: Date.now(),
    };
    try {
      await saveSavedRoute(route);
    } catch {
      // `saving` used to stay true forever here, leaving the button dead.
      setSaving(false);
      Alert.alert("Couldn't save the route", 'Please try again.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    pushSavedRoutes().catch(() => {});
    setSaving(false);
    setName('');
    setEmoji('run');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Lifts the sheet above the keyboard (its name field autofocuses). */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable style={ss.backdrop} onPress={onClose} />
      <View style={[ss.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        {/* Handle */}
        <View style={ss.handle} />

        {/* Header */}
        <View style={ss.header}>
          <Text style={ss.title}>Save Route</Text>
          <Pressable style={ss.closeBtn} onPress={onClose} hitSlop={8}>
            <X size={14} weight="regular" color={C.t2} />
          </Pressable>
        </View>

        {/* Route info */}
        <View style={ss.infoRow}>
          <View style={ss.infoIconWrap}>{ICON_OPTIONS.find(o => o.key === emoji) ? (() => { const { Icon, color } = ICON_OPTIONS.find(o => o.key === emoji)!; return <Icon size={22} color={color} weight="light" />; })() : null}</View>
          <View>
            <Text style={ss.infoDistance}>{fmtDist(distanceM)} km</Text>
            {durationSec != null && (
              <Text style={ss.infoDuration}>
                {Math.floor(durationSec / 60)}m {durationSec % 60}s · {gpsPoints.length} points
              </Text>
            )}
          </View>
        </View>

        {/* Name input */}
        <TextInput
          style={ss.input}
          value={name}
          onChangeText={setName}
          placeholder="Route name (e.g. Morning Loop)"
          placeholderTextColor={C.t3}
          maxLength={50}
          autoFocus
          returnKeyType="done"
        />

        {/* Emoji picker */}
        <Text style={ss.sectionLabel}>ICON</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          <View style={ss.emojiRow}>
            {ICON_OPTIONS.map(({ key, Icon, color }) => (
              <Pressable hitSlop={8}
                key={key}
                style={[ss.emojiBtn, emoji === key && ss.emojiBtnActive]}
                onPress={() => { setEmoji(key); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                accessibilityRole="radio"
                accessibilityState={{ selected: emoji === key }}
                accessibilityLabel={`Route icon: ${key}`}
              >
                <Icon size={18} color={emoji === key ? color : C.t2} weight="light" />
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* Public toggle */}
        <View style={ss.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={ss.toggleLabel}>{isPublic ? 'Public' : 'Private'}</Text>
            <Text style={ss.toggleSub}>
              {isPublic ? 'Others can discover this route nearby' : 'Only visible to you'}
            </Text>
          </View>
          <Switch
            value={isPublic}
            onValueChange={setIsPublic}
            trackColor={{ true: C.red, false: C.border }}
            thumbColor={C.white}
          />
        </View>

        {/* Save button */}
        <Pressable
          style={[ss.saveBtn, (!name.trim() || saving) && ss.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!name.trim() || saving}
        >
          {saving
            ? <ActivityIndicator color={C.white} size="small" />
            : <Text style={ss.saveBtnText}>Save Route</Text>
          }
        </Pressable>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    backdrop:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
    sheet:         { backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 12 },
    handle:        { width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
    header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
    title:         { fontFamily: Fonts.semiBold, fontSize: 16, color: C.black },
    closeBtn:      { width: 28, height: 28, borderRadius: 14, backgroundColor: C.stone, alignItems: 'center', justifyContent: 'center' },
    infoRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.stone, borderRadius: 12, padding: 12, marginBottom: 14 },
    infoIconWrap:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    infoDistance:  { fontFamily: Fonts.semiBold, fontSize: 13, color: C.black, fontVariant: ['tabular-nums'] },
    infoDuration:  { fontFamily: Fonts.light, fontSize: 11, color: C.t3, marginTop: 2 },
    input:         { borderWidth: 0.5, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: Fonts.regular, fontSize: 14, color: C.black, marginBottom: 14, backgroundColor: C.card },
    sectionLabel:  { ...Type.overline, color: C.t3, marginBottom: 8 },
    emojiRow:      { flexDirection: 'row', gap: 8 },
    emojiBtn:      { width: 42, height: 42, borderRadius: 10, backgroundColor: C.stone, borderWidth: 0.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
    emojiBtnActive:{ backgroundColor: C.accentMuted, borderWidth: 2, borderColor: C.red },
    toggleRow:     { flexDirection: 'row', alignItems: 'center', borderWidth: 0.5, borderColor: C.border, borderRadius: 12, padding: 12, marginBottom: 16 },
    toggleLabel:   { fontFamily: Fonts.medium, fontSize: 13, color: C.black },
    toggleSub:     { fontFamily: Fonts.regular, fontSize: 11, color: C.t3, marginTop: 2 },
    saveBtn:       { backgroundColor: C.red, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
    saveBtnDisabled:{ backgroundColor: C.border },
    saveBtnText:   { fontFamily: Fonts.semiBold, fontSize: 14, color: C.white },
  });
}
