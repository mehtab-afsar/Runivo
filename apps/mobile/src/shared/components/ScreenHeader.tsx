/**
 * The one screen header (final app mock): a 44 pt round back button, the
 * title, and an optional action on the right.
 *
 *   nav   (default)  centred 17 pt title, for screens you drill into
 *   large            big left-aligned title, for section screens (Clubs, Events)
 *
 * It sits inside the screen's SafeAreaView, so it never handles insets itself.
 */
import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { CaretLeft, X } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';

export function ScreenHeader({
  title, onBack, right, variant = 'nav', backIcon = 'back', subtitle, style, backLabel,
}: {
  title?: string;
  /** Omit for no back button (a tab's root screen). */
  onBack?: () => void;
  right?: React.ReactNode;
  variant?: 'nav' | 'large';
  backIcon?: 'back' | 'close';
  /** Small line under a large title. */
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
  backLabel?: string;
}) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  const Icon = backIcon === 'close' ? X : CaretLeft;
  const back = onBack ? (
    <Pressable style={s.circle} onPress={onBack} hitSlop={6} accessibilityRole="button" accessibilityLabel={backLabel ?? (backIcon === 'close' ? 'Close' : 'Back')}>
      <Icon size={18} color={C.t1} weight="bold" />
    </Pressable>
  ) : null;

  if (variant === 'large') {
    return (
      <View style={[s.row, s.largeRow, style]}>
        {back}
        <View style={{ flex: 1 }}>
          {!!title && <Text style={s.large} numberOfLines={1} accessibilityRole="header">{title}</Text>}
          {!!subtitle && <Text style={s.sub} numberOfLines={1}>{subtitle}</Text>}
        </View>
        {right}
      </View>
    );
  }
  return (
    <View style={[s.row, style]}>
      <View style={s.side}>{back}</View>
      <Text style={s.title} numberOfLines={1} accessibilityRole="header">{title}</Text>
      <View style={[s.side, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

/** A round 44 pt icon button for a header's right slot. */
export function HeaderButton({ onPress, label, children }: { onPress: () => void; label: string; children: React.ReactNode }) {
  const C = useTheme();
  const s = useMemo(() => mk(C), [C]);
  return (
    <Pressable style={s.circle} onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={label}>
      {children}
    </Pressable>
  );
}

function mk(C: AppColors) {
  return StyleSheet.create({
    row:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: Platform.OS === 'android' ? 12 : 4, paddingBottom: 12, gap: 10 },
    largeRow: { gap: 12 },
    // At least 44 pt each side (so a centred title stays centred); a wider action ("Invite") grows it.
    side:     { minWidth: 44, minHeight: 44, justifyContent: 'center', flexShrink: 0 },
    circle:   { width: 44, height: 44, borderRadius: 22, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
    title:    { flex: 1, textAlign: 'center', fontFamily: Fonts.semiBold, fontSize: 17, color: C.t1 },
    large:    { fontFamily: Fonts.bold, fontSize: 28, lineHeight: 32, letterSpacing: -0.7, color: C.t1 },
    sub:      { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, marginTop: 1 },
  });
}
