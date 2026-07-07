import React, { useMemo } from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { ShareNetwork, Bookmark, Download } from 'phosphor-react-native';
import { useTheme, Fonts, Spacing, type AppColors } from '@theme';

interface PostRunActionsProps {
  onShare: () => void;
  onSave: () => void;
  onDone: () => void;
  canSave?: boolean;
  onSaveImage?: () => void;
}

export default function PostRunActions({ onShare, onSave, onDone, canSave = true, onSaveImage }: PostRunActionsProps) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  return (
    <View style={ss.col}>
      <View style={ss.row}>
        <Pressable style={ss.doneBtn} onPress={onDone}>
          <Text style={ss.doneBtnText}>Done</Text>
        </Pressable>
        <Pressable style={ss.secondaryBtn} onPress={onShare}>
          <ShareNetwork size={14} weight="regular" color={C.black} />
          <Text style={ss.secondaryBtnText}>Share</Text>
        </Pressable>
        {onSaveImage && (
          <Pressable style={ss.secondaryBtn} onPress={onSaveImage}>
            <Download size={14} weight="regular" color={C.black} />
            <Text style={ss.secondaryBtnText}>Save</Text>
          </Pressable>
        )}
      </View>
      {canSave && (
        <Pressable style={ss.saveBtn} onPress={onSave}>
          <Bookmark size={14} weight="regular" color={C.black} />
          <Text style={ss.saveBtnText}>Save Route</Text>
        </Pressable>
      )}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    col:           { marginHorizontal: Spacing.gutter, marginTop: 8, gap: 8 },
    row:           { flexDirection: 'row', gap: 8 },
    doneBtn:       { flex: 1, paddingVertical: 14, backgroundColor: C.alwaysDark, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
    doneBtnText:   { fontFamily: Fonts.semiBold, fontSize: 13, color: C.alwaysLight, letterSpacing: 0.3 },
    secondaryBtn:  { flex: 1, paddingVertical: 14, backgroundColor: C.stone, borderRadius: 3, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, borderWidth: 0.5, borderColor: C.border },
    secondaryBtnText: { fontFamily: Fonts.medium, fontSize: 13, color: C.black },
    saveBtn:       { paddingVertical: 12, backgroundColor: C.stone, borderRadius: 3, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, borderWidth: 0.5, borderColor: C.border },
    saveBtnText:   { fontFamily: Fonts.medium, fontSize: 13, color: C.black },
  });
}
