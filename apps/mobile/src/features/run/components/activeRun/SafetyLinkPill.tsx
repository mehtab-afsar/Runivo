import React, { useMemo } from 'react';
import { Text, Pressable } from 'react-native';
import { ShieldCheck } from 'phosphor-react-native';
import { useTheme } from '@theme';
import { mkPillStyles } from './activeRunPillStyles';

interface Props {
  top: number;
  safetyOn: boolean;
  onPress: () => void;
}

/** Safety link (R2): share your live position with anyone, no app needed. */
export default function SafetyLinkPill({ top, safetyOn, onPress }: Props) {
  const C = useTheme();
  const ss = useMemo(() => mkPillStyles(C), [C]);
  return (
    <Pressable hitSlop={8}
      style={[ss.pill, ss.safetyPill, { top }, safetyOn && { backgroundColor: C.green }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={safetyOn ? 'Safety link on. Send it again' : 'Share a live safety link'}
    >
      <ShieldCheck size={14} color={safetyOn ? C.alwaysLight : C.t1} weight={safetyOn ? 'fill' : 'bold'} />
      <Text style={[ss.pillTxt, safetyOn && { color: C.alwaysLight }]}>{safetyOn ? 'Safety link on' : 'Safety link'}</Text>
    </Pressable>
  );
}
