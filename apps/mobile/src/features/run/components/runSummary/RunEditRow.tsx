import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { CaretRight, PencilSimple } from 'phosphor-react-native';
import { useTheme, Fonts, Spacing, type AppColors } from '@theme';
import { AUDIENCES } from '../../services/activityEditService';
import type { EditedMeta } from '../../utils/runSummaryTypes';

interface Props {
  edited: EditedMeta | null;
  /** Time-of-day title shown until the runner names the run. */
  defaultTitle: string;
  onPress: () => void;
}

/** Name and notes first (asked for): straight after the hero, so the runner can title the run while it's fresh. */
export default function RunEditRow({ edited, defaultTitle, onPress }: Props) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  return (
    <Pressable style={[ss.card, ss.panel, ss.editRow]} onPress={onPress} accessibilityRole="button" accessibilityLabel="Name this run and add notes">
      <View style={ss.editIcon}><PencilSimple size={18} color={C.t1} weight="regular" /></View>
      <View style={{ flex: 1 }}>
        <Text style={ss.editTitle} numberOfLines={1}>
          {edited?.title || defaultTitle}
        </Text>
        <Text style={ss.editSub} numberOfLines={2}>
          {edited?.description
            || `Name it, add notes and how it felt · ${AUDIENCES.find(a => a.id === (edited?.visibility ?? 'everyone'))?.label ?? 'Everyone'}`}
        </Text>
      </View>
      <CaretRight size={14} color={C.t3} weight="bold" />
    </Pressable>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    card:      { marginHorizontal: Spacing.gutter, marginBottom: 12 },
    panel:     { backgroundColor: C.card, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 14 },
    editRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
    editIcon:  { width: 40, height: 40, borderRadius: 20, backgroundColor: C.mint, alignItems: 'center', justifyContent: 'center' },
    editTitle: { fontFamily: Fonts.semiBold, fontSize: 16, color: C.t1 },
    editSub:   { fontFamily: Fonts.regular, fontSize: 13, lineHeight: 18, color: C.t2, marginTop: 2 },
  });
}
