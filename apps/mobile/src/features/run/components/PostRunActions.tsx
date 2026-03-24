import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { Share2, Bookmark } from 'lucide-react-native';

const C = { black: '#0A0A0A', white: '#FFFFFF', stone: '#F0EDE8', border: '#DDD9D4' };
const FONT_SEMI = 'Barlow_600SemiBold';
const FONT_MED  = 'Barlow_500Medium';

interface PostRunActionsProps {
  onShare: () => void;
  onSave: () => void;
  onDone: () => void;
  canSave?: boolean;
}

export default function PostRunActions({ onShare, onSave, onDone, canSave = true }: PostRunActionsProps) {
  return (
    <View style={ss.col}>
      <View style={ss.row}>
        <Pressable style={ss.doneBtn} onPress={onDone}>
          <Text style={ss.doneBtnText}>Done</Text>
        </Pressable>
        <Pressable style={ss.secondaryBtn} onPress={onShare}>
          <Share2 size={14} strokeWidth={2} color={C.black} />
          <Text style={ss.secondaryBtnText}>Share</Text>
        </Pressable>
      </View>
      {canSave && (
        <Pressable style={ss.saveBtn} onPress={onSave}>
          <Bookmark size={14} strokeWidth={2} color={C.black} />
          <Text style={ss.saveBtnText}>Save Route</Text>
        </Pressable>
      )}
    </View>
  );
}

const ss = StyleSheet.create({
  col:           { marginHorizontal: 16, marginTop: 8, gap: 8 },
  row:           { flexDirection: 'row', gap: 8 },
  doneBtn:       { flex: 1, paddingVertical: 14, backgroundColor: C.black, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  doneBtnText:   { fontFamily: FONT_SEMI, fontSize: 13, color: C.white, letterSpacing: 0.3 },
  secondaryBtn:  { flex: 1, paddingVertical: 14, backgroundColor: C.stone, borderRadius: 3, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, borderWidth: 1, borderColor: C.border },
  secondaryBtnText: { fontFamily: FONT_MED, fontSize: 13, color: C.black },
  saveBtn:       { paddingVertical: 12, backgroundColor: C.stone, borderRadius: 3, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, borderWidth: 1, borderColor: C.border },
  saveBtnText:   { fontFamily: FONT_MED, fontSize: 13, color: C.black },
});
