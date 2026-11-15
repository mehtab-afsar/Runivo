import React, { useMemo } from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { Bookmark, Download } from 'phosphor-react-native';
import { useTheme, Fonts, Spacing, type AppColors } from '@theme';

interface PostRunActionsProps {
  onSave: () => void;
  onDone: () => void;
  canSave?: boolean;
  onSaveImage?: () => void;
}

/** Big black Done, with saving the card or the route as quieter options. Share lives in the header. */
export default function PostRunActions({ onSave, onDone, canSave = true, onSaveImage }: PostRunActionsProps) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  return (
    <View style={ss.col}>
      <Pressable style={ss.doneBtn} onPress={onDone} accessibilityRole="button">
        <Text style={ss.doneBtnText}>Done</Text>
      </Pressable>
      {(onSaveImage || canSave) && (
        <View style={ss.row}>
          {onSaveImage && (
            <Pressable style={ss.secondaryBtn} onPress={onSaveImage} accessibilityRole="button">
              <Download size={15} color={C.t1} />
              <Text style={ss.secondaryBtnText}>Save image</Text>
            </Pressable>
          )}
          {canSave && (
            <Pressable style={ss.secondaryBtn} onPress={onSave} accessibilityRole="button">
              <Bookmark size={15} color={C.t1} />
              <Text style={ss.secondaryBtnText}>Save route</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    col:              { marginHorizontal: Spacing.gutter, marginTop: 8, gap: 10 },
    row:              { flexDirection: 'row', gap: 10 },
    doneBtn:          { height: 58, backgroundColor: C.alwaysDark, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    doneBtnText:      { fontFamily: Fonts.semiBold, fontSize: 17, color: C.alwaysLight },
    secondaryBtn:     { flex: 1, height: 46, backgroundColor: C.card, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
    secondaryBtnText: { fontFamily: Fonts.medium, fontSize: 14, color: C.t1 },
  });
}
