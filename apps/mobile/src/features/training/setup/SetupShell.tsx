/**
 * The frame of every plan setup screen (PRD mocks 1–8): back circle, progress
 * bars, close circle, a two-tone title, the step's content and a footer
 * pinned to the bottom.
 */
import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CaretLeft, X } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import { FooterFade } from '@mobile/shared/components/FooterFade';

export default function SetupShell({
  step, steps, onBack, onClose, title, accent, subtitle, children, footer,
}: {
  step: number; steps: number;
  onBack: () => void; onClose: () => void;
  title: string; accent?: string; subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={[s.root, { paddingTop: insets.top + 6 }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.nav}>
        <Pressable style={s.circle} onPress={onBack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
          <CaretLeft size={18} color={C.t1} weight="bold" />
        </Pressable>
        <View style={s.prog} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: steps, now: step }}>
          {Array.from({ length: steps }, (_, i) => <View key={i} style={[s.bar, i < step && s.barOn]} />)}
        </View>
        <Pressable style={s.circle} onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
          <X size={18} color={C.t1} weight="bold" />
        </Pressable>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}>
        <Text style={s.title} accessibilityRole="header">
          {title}{accent ? <Text style={{ color: C.green }}> {accent}</Text> : null}
        </Text>
        {!!subtitle && <Text style={s.sub}>{subtitle}</Text>}
        <View style={s.content}>{children}</View>
      </ScrollView>
      {!!footer && <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 16) + 4 }]}><FooterFade />{footer}</View>}
    </KeyboardAvoidingView>
  );
}

function mk(C: AppColors) {
  return StyleSheet.create({
    root:    { flex: 1, backgroundColor: C.bg },
    nav:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, height: 52, gap: 14 },
    circle:  { width: 44, height: 44, borderRadius: 22, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
    prog:    { flex: 1, flexDirection: 'row', gap: 5 },
    bar:     { flex: 1, height: 4, borderRadius: 2, backgroundColor: C.border },
    barOn:   { backgroundColor: C.brandGreen },
    body:    { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 32 },
    title:   { fontFamily: Fonts.semiBold, fontSize: 32, lineHeight: 38, letterSpacing: -1, color: C.t1 },
    sub:     { fontFamily: Fonts.regular, fontSize: 15, lineHeight: 21, color: C.t2, marginTop: 8 },
    content: { marginTop: 22, gap: 18 },
    footer:  { paddingHorizontal: 22, paddingTop: 10, gap: 10, backgroundColor: C.bg },
  });
}
