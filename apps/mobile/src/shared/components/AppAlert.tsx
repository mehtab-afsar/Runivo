/**
 * appAlert: the app's own alert and action menu, in Runivo's design, instead
 * of the grey system sheet. Same call shape as React Native's Alert.alert:
 *
 *   appAlert('Comment by Moo', undefined, [
 *     { text: 'Report comment', onPress: … },
 *     { text: 'Block Moo', style: 'destructive', onPress: … },
 *     { text: 'Cancel', style: 'cancel' },
 *   ]);
 *
 * It draws in an overlay layer, not a second native Modal: iOS can't present a
 * modal over one that's already up (a menu opened from a sheet would silently
 * not show). The app root has a layer, and so does every ModalSheet and
 * full-screen Modal; the alert opens in the topmost layer that is on screen.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, Pressable, StyleSheet, Text, View, type AlertButton } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Fonts, type AppColors } from '@theme';

interface Req { id: number; title: string; message?: string; buttons: AlertButton[] }
type Show = (r: Req) => void;

const layers: { id: number; show: Show }[] = [];
let nextId = 1;

export function appAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  const req: Req = { id: nextId++, title, message, buttons: buttons?.length ? buttons : [{ text: 'OK' }] };
  const top = layers[layers.length - 1];
  if (top) top.show(req);
  else Alert.alert(title, message, buttons); // no layer mounted yet (very early start-up)
}

/** Put one inside every screen root, sheet and full-screen Modal. */
export function AlertLayer() {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const insets = useSafeAreaInsets();
  const [req, setReq] = useState<Req | null>(null);
  const fade = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    const id = nextId++;
    layers.push({ id, show: setReq });
    return () => { const i = layers.findIndex(l => l.id === id); if (i >= 0) layers.splice(i, 1); };
  }, []);

  useEffect(() => {
    if (!req) return;
    fade.setValue(0); lift.setValue(40);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 140, useNativeDriver: true }),
      Animated.timing(lift, { toValue: 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [req, fade, lift]);

  if (!req) return null;
  const cancel = req.buttons.find(b => b.style === 'cancel');
  const actions = req.buttons.filter(b => b !== cancel);
  const close = (b?: AlertButton) => {
    setReq(null);
    // Run after the layer is gone, so a follow-up alert (a confirm) can open.
    if (b?.onPress) setTimeout(() => b.onPress?.(), 0);
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, s.scrim, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => close(cancel)} accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8, opacity: fade, transform: [{ translateY: lift }] }]}
        accessibilityViewIsModal>
        <Text style={s.title} accessibilityRole="header">{req.title}</Text>
        {!!req.message && <Text style={s.message}>{req.message}</Text>}
        <View style={s.group}>
          {actions.map((b, i) => (
            <Pressable key={i} onPress={() => close(b)} accessibilityRole="button"
              style={({ pressed }) => [s.row, i > 0 && s.rowBorder, pressed && s.pressed]}>
              <Text style={[s.rowTxt, b.style === 'destructive' && { color: C.danger }]}>{b.text}</Text>
            </Pressable>
          ))}
        </View>
        {cancel && (
          <Pressable onPress={() => close(cancel)} accessibilityRole="button" style={({ pressed }) => [s.cancel, pressed && s.pressed]}>
            <Text style={s.cancelTxt}>{cancel.text ?? 'Cancel'}</Text>
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}

function mk(C: AppColors) {
  return StyleSheet.create({
    scrim:     { backgroundColor: 'rgba(23,24,26,0.38)' },
    sheet:     { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 22, paddingHorizontal: 18, gap: 12 },
    title:     { fontFamily: Fonts.semiBold, fontSize: 18, color: C.t1, textAlign: 'center', paddingHorizontal: 12 },
    message:   { fontFamily: Fonts.regular, fontSize: 14.5, lineHeight: 20, color: C.t2, textAlign: 'center', paddingHorizontal: 12, marginTop: -4 },
    group:     { backgroundColor: C.card, borderRadius: 20, overflow: 'hidden' },
    row:       { minHeight: 54, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
    rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
    rowTxt:    { fontFamily: Fonts.semiBold, fontSize: 16, color: C.t1 },
    cancel:    { minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: C.card },
    cancelTxt: { fontFamily: Fonts.medium, fontSize: 16, color: C.t2 },
    pressed:   { opacity: 0.6 },
  });
}
