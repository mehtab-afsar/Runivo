/**
 * The one bottom sheet shown over everything (a Modal): dimmed backdrop that
 * closes it, 28 pt top corners, a grab handle, optional title row with a close
 * button, and bottom padding that clears the home indicator.
 *
 * Use it for menus, pickers and short forms. (BottomSheet is the in-screen,
 * draggable sheet used over maps.)
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, KeyboardAvoidingView, Platform, StyleSheet, Animated, Easing, Dimensions, type StyleProp, type ViewStyle } from 'react-native';
import { AlertLayer } from './AppAlert';
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

  // Our own open/close motion. The Modal's built-in "slide" moved the whole
  // screen, dimmed backdrop included, so a dark band swept up from the bottom.
  // Now the backdrop fades in place and only the sheet rises, quickly.
  const [mounted, setMounted] = useState(visible);
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(Dimensions.get('window').height * 0.5)).current;
  useEffect(() => {
    if (visible) {
      setMounted(true);
      fade.setValue(0); rise.setValue(Dimensions.get('window').height * 0.5);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.timing(rise, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(fade, { toValue: 0, duration: 140, useNativeDriver: true }),
        Animated.timing(rise, { toValue: Dimensions.get('window').height * 0.5, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const body = (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
        <Pressable style={s.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      </Animated.View>
      <View style={{ flex: 1 }} pointerEvents="none" />
      <Animated.View style={[s.sheet, { transform: [{ translateY: rise }] }, tone === 'page' && { backgroundColor: C.bg }, padded && s.padded, { paddingBottom: Math.max(insets.bottom, 16) + 8 }, style]}>
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
      </Animated.View>
      <AlertLayer />
    </>
  );
  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
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
