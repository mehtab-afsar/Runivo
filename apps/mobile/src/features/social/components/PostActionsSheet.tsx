import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { ShareNetwork, Trash, Flag, Check, SpeakerSlash } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';

interface Props {
  visible: boolean;
  isOwnPost: boolean;
  onClose: () => void;
  onShare: () => void;
  onDelete: () => void;
  onReport: () => Promise<void> | void;
  /** Mute the post's author: their activities leave your feed. */
  onMute?: () => void;
  authorName?: string;
}

export default function PostActionsSheet({ visible, isOwnPost, onClose, onShare, onDelete, onReport, onMute, authorName }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    if (visible) setReported(false);
  }, [visible]);

  const handleShare = useCallback(() => { onClose(); onShare(); }, [onClose, onShare]);
  const handleDelete = useCallback(() => {
    // Deleting is permanent (and removes the post's kudos and comments), so ask first.
    // Asked while the sheet is still up: presenting an alert mid-dismiss can be dropped on iOS.
    Alert.alert('Delete this post?', 'This can\'t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { onClose(); onDelete(); } },
    ]);
  }, [onClose, onDelete]);
  const handleReport = useCallback(async () => {
    try {
      await onReport();
      setReported(true);
    } catch {
      Alert.alert("Couldn't send the report", 'Check your connection and try again.');
    }
  }, [onReport]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.handle} />

        <Pressable style={s.row} onPress={handleShare}>
          <ShareNetwork size={18} color={C.black} weight="light" />
          <Text style={s.rowText}>Share</Text>
        </Pressable>

        {!isOwnPost && onMute && (
          <Pressable style={s.row} onPress={() => { onClose(); onMute(); }} accessibilityRole="button">
            <SpeakerSlash size={18} color={C.black} weight="light" />
            <Text style={s.rowText}>Mute {authorName ?? 'this runner'}</Text>
          </Pressable>
        )}

        {isOwnPost ? (
          <Pressable style={s.row} onPress={handleDelete}>
            <Trash size={18} color={C.red} weight="light" />
            <Text style={[s.rowText, { color: C.red }]}>Delete post</Text>
          </Pressable>
        ) : reported ? (
          <View style={s.row}>
            <Check size={18} color={C.green} weight="bold" />
            <Text style={[s.rowText, { color: C.green }]}>Reported — thanks, we'll take a look</Text>
          </View>
        ) : (
          <Pressable style={s.row} onPress={handleReport}>
            <Flag size={18} color={C.t2} weight="light" />
            <Text style={s.rowText}>Report post</Text>
          </Pressable>
        )}

        <Pressable style={s.cancel} onPress={onClose}>
          <Text style={s.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
    sheet:    { backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 28, paddingTop: 8 },
    handle:   { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 8 },
    row:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 22, paddingVertical: 16 },
    rowText:  { fontFamily: Fonts.medium, fontSize: 14, color: C.black },
    cancel:   { marginTop: 6, marginHorizontal: 16, paddingVertical: 14, borderRadius: 12, backgroundColor: C.stone, alignItems: 'center' },
    cancelText: { fontFamily: Fonts.medium, fontSize: 14, color: C.t2 },
  });
}
