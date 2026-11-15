import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, Type, Spacing, type AppColors } from '@theme';
import { PrimaryButton } from './PrimaryButton';

interface ErrorStateProps {
  title?: string;
  body?: string;
  onRetry?: () => void;
}

/**
 * A failed load. Use this instead of an EmptyState when a fetch threw, so "couldn't
 * load" never reads as "you have nothing here" (e.g. "You haven't blocked anyone").
 */
export function ErrorState({
  title = "Couldn't load this",
  body = 'Check your connection and try again.',
  onRetry,
}: ErrorStateProps) {
  const C = useTheme();
  const s = mkStyles(C);
  return (
    <View style={s.wrap} accessibilityRole="alert">
      <Text style={s.title}>{title}</Text>
      <Text style={s.body}>{body}</Text>
      {onRetry && (
        <View style={s.ctaWrap}>
          <PrimaryButton label="Try again" onPress={onRetry} size="sm" variant="dark" />
        </View>
      )}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    wrap:    { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32, gap: 8 },
    title:   { ...Type.title, color: C.black, textAlign: 'center' },
    body:    { ...Type.bodySm, color: C.t2, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
    ctaWrap: { marginTop: Spacing.sm },
  });
}
