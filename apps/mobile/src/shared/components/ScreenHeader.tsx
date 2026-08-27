import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import type { ViewStyle } from 'react-native';
import { ArrowLeft } from 'phosphor-react-native';
import { useTheme, Type, type AppColors } from '@theme';

const SLOT = 40;

interface ScreenHeaderProps {
  title: string;
  /** Omit to render a header with no back button (e.g. a tab root). */
  onBack?: () => void;
  /** Right-side slot — icon button, text action, or omitted for symmetry. */
  right?: React.ReactNode;
  /** Bottom hairline + card background, for screens whose content sits on `C.bg`. */
  bordered?: boolean;
  style?: ViewStyle;
}

/**
 * The one top-of-screen header. Left/right slots are a fixed width so the
 * title is genuinely centered regardless of whether `right` is present —
 * screens used to each pick their own spacer width (30 vs 32) which meant
 * "centered" wasn't even consistent with itself from screen to screen.
 */
export function ScreenHeader({ title, onBack, right, bordered, style }: ScreenHeaderProps) {
  const C = useTheme();
  const s = mkStyles(C);
  return (
    <View style={[s.header, bordered && s.bordered, style]}>
      <View style={s.slot}>
        {onBack && (
          <Pressable onPress={onBack} hitSlop={8} style={s.backBtn}>
            <ArrowLeft size={18} color={C.t2} weight="regular" />
          </Pressable>
        )}
      </View>
      <Text style={s.title} numberOfLines={1}>{title}</Text>
      <View style={[s.slot, s.rightSlot]}>{right}</View>
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 12,
      backgroundColor: C.bg,
    },
    bordered: {
      backgroundColor: C.card, borderBottomWidth: 0.5, borderBottomColor: C.border,
    },
    slot:     { width: SLOT, alignItems: 'flex-start', justifyContent: 'center' },
    rightSlot:{ alignItems: 'flex-end' },
    backBtn:  { width: SLOT, height: SLOT, alignItems: 'flex-start', justifyContent: 'center' },
    title:    { ...Type.title, flex: 1, textAlign: 'center', color: C.black },
  });
}
