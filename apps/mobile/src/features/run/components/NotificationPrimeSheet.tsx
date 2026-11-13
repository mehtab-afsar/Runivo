import React, { useMemo } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { Shield, Fire, Lightning, Heart, type Icon } from 'phosphor-react-native';
import * as Notifications from 'expo-notifications';
import { useTheme, Fonts, type AppColors } from '@theme';
import { PrimaryButton } from '@mobile/shared/components/PrimaryButton';
import { TextButton } from '@mobile/shared/components/TextButton';

const BENEFITS: Array<{ Icon: Icon; text: string }> = [
  { Icon: Shield,    text: 'Territory alerts when rivals attack your zones' },
  { Icon: Fire,      text: 'Streak reminders to keep your run days on track' },
  { Icon: Lightning, text: 'Mission resets every morning at 6 AM' },
  { Icon: Heart,     text: 'Weekly training summary every Sunday' },
];

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

/**
 * Shown once, the first time a run summary appears after signup — not during
 * onboarding, where there's nothing at stake yet to notify about. Framed
 * around the run that just happened rather than a blank permission ask.
 */
export function NotificationPrimeSheet({ visible, onDismiss }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);

  async function handleEnable() {
    try {
      await Notifications.requestPermissionsAsync();
    } catch { /* user can enable later from Settings */ }
    onDismiss();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <Pressable style={s.overlay} onPress={onDismiss}>
        <Pressable style={s.sheet} onPress={e => e.stopPropagation()}>
          <View style={s.handle} />
          <Text style={s.eyebrow}>Nice run</Text>
          <Text style={s.title}>Stay in the loop.</Text>
          <Text style={s.sub}>Get notified when someone's closing in on a street you just claimed.</Text>

          <View style={{ gap: 12, marginVertical: 20 }}>
            {BENEFITS.map(({ Icon, text }) => (
              <View key={text} style={s.row}>
                <Icon size={16} color={C.t3} weight="light" />
                <Text style={s.rowText}>{text}</Text>
              </View>
            ))}
          </View>

          <PrimaryButton label="Turn on notifications" onPress={handleEnable} variant="dark" fullWidth />
          <View style={{ marginTop: 10 }}>
            <TextButton label="Not now" onPress={onDismiss} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet:   { backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
    handle:  { width: 36, height: 3, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 20 },
    eyebrow: { fontFamily: Fonts.medium, fontSize: 11, color: C.red, marginBottom: 8 },
    title:   { fontFamily: Fonts.display, fontSize: 24, color: C.t1, marginBottom: 8 },
    sub:     { fontSize: 13, color: C.t2, lineHeight: 19 },
    row:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
    rowText: { fontSize: 13, color: C.t2, flex: 1, lineHeight: 18 },
  });
}
