/**
 * The one bottom sheet shown over everything (a Modal): dimmed backdrop that
 * closes it, 28 pt top corners, a grab handle, optional title row with a close
 * button, and bottom padding that clears the home indicator.
 *
 * Use it for menus, pickers and short forms. (BottomSheet is the in-screen,
 * draggable sheet used over maps.)
 */
import React, { useMemo } from 'react';
import { View, Text, Pressable, Modal, KeyboardAvoidingView, Platform, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';

export function ModalSheet({
  visible, onClose, title, subtitle, showClose, children, keyboard, padded = true, tone = 'card', style,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  /** A round close button on the title row. */
  showClose?: boolean;
  children: React.ReactNode;
  /** Lift the sheet above the keyboard (sheets with a text field). */
  keyboard?: boolean;
  /** 20 pt side padding (off for full-width lists of rows). */
  padded?: boolean;
  /** 'card' white sheet; 'page' the app background (sheets made of cards). */
  tone?: 'card' | 'page';
  style?: StyleProp<ViewStyle>;
}) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const insets = useSafeAreaInsets();
  const body = (
    <>
      <Pressable style={s.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      <View style={[s.sheet, tone === 'page' && { backgroundColor: C.bg }, padded && s.padded, { paddingBottom: Math.max(insets.bottom, 16) + 8 }, style]}>
        <View style={s.grab} />
        {(!!title || showClose) && (
          <View style={[s.titleRow, !padded && s.padded]}>
            <View style={{ flex: 1 }}>
              {!!title && <Text style={s.title} accessibilityRole="header">{title}</Text>}
              {!!subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
            </View>
            {showClose && (
              <Pressable style={s.close} onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
                <X size={14} color={C.t2} weight="bold" />
              </Pressable>
            )}
          </View>
        )}
        {children}
      </View>
    </>
  );
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {keyboard
        ? <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>{body}</KeyboardAvoidingView>
        : <View style={{ flex: 1 }}>{body}</View>}
    </Modal>
  );
}

function mk(C: AppColors) {
  return StyleSheet.create({
    scrim:    { flex: 1, backgroundColor: 'rgba(23,24,26,0.38)' },
    sheet:    { backgroundColor: C.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, maxHeight: '92%' },
    padded:   { paddingHorizontal: 20 },
    grab:     { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 12 },
    titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
    title:    { fontFamily: Fonts.semiBold, fontSize: 20, letterSpacing: -0.4, color: C.t1 },
    subtitle: { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 20, color: C.t2, marginTop: 4 },
    close:    { width: 32, height: 32, borderRadius: 16, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  });
}
