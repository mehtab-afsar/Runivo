import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, Type, Spacing, type AppColors } from '@theme';
import { PrimaryButton } from './PrimaryButton';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  cta?: { label: string; onPress: () => void };
}

/**
 * The one "nothing here yet" layout — modeled on the app's cleanest existing
 * empty state (History). A screen with a non-standard outer container (e.g.
 * a full-bleed map overlay) keeps that container but renders these same
 * icon/title/body/cta slots inside it, rather than inventing its own copy layout.
 */
export function EmptyState({ icon, title, body, cta }: EmptyStateProps) {
  const C = useTheme();
  const s = mkStyles(C);
  return (
    <View style={s.wrap}>
      {icon && <View style={s.icon}>{icon}</View>}
      <Text style={s.title}>{title}</Text>
      {body && <Text style={s.body}>{body}</Text>}
      {cta && (
        <View style={s.ctaWrap}>
          <PrimaryButton label={cta.label} onPress={cta.onPress} size="sm" />
        </View>
      )}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    wrap:    { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32, gap: 8 },
    icon:    { marginBottom: 4 },
    title:   { ...Type.title, color: C.black, textAlign: 'center' },
    body:    { ...Type.bodySm, color: C.t2, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
    ctaWrap: { marginTop: Spacing.sm },
  });
}
