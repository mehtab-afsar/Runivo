import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ShareNetwork, PathIcon, Play, Heart, ChatCircle } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import type { RunPost } from '../../utils/runSummaryTypes';

interface Props {
  post: RunPost | null;
  onOpenComments: () => void;
  onShareStory: () => void;
  onShareSticker: () => void;
  onReplay?: () => void;
}

/** Story share row (mock: kudos · comments · story · sticker · replay). */
export default function RunShareActions({ post, onOpenComments, onShareStory, onShareSticker, onReplay }: Props) {
  const C = useTheme();
  const ss = useMemo(() => mkStyles(C), [C]);
  return (
    <View style={ss.actRow}>
      {post && (
        <>
          <View style={ss.actBtn} accessibilityLabel={`${post.likes} kudos`}>
            <Heart size={20} color={C.t1} />
            <Text style={ss.actTxt}>{post.likes}</Text>
          </View>
          <Pressable style={ss.actBtn} onPress={onOpenComments} accessibilityRole="button" accessibilityLabel={`${post.comments} comments`}>
            <ChatCircle size={20} color={C.t1} />
            <Text style={ss.actTxt}>{post.comments}</Text>
          </Pressable>
        </>
      )}
      <Pressable style={ss.actBtn} onPress={onShareStory} accessibilityRole="button">
        <ShareNetwork size={20} color={C.t1} />
        <Text style={ss.actTxt}>Story</Text>
      </Pressable>
      <Pressable style={ss.actBtn} onPress={onShareSticker} accessibilityRole="button">
        <PathIcon size={20} color={C.t1} />
        <Text style={ss.actTxt}>Sticker</Text>
      </Pressable>
      {onReplay && (
        <Pressable style={ss.actBtn} onPress={onReplay} accessibilityRole="button">
          <Play size={18} color={C.t1} weight="fill" />
          <Text style={ss.actTxt}>Replay</Text>
        </Pressable>
      )}
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    actRow: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: 4 },
    actBtn: { height: 52, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10 },
    actTxt: { fontFamily: Fonts.regular, fontSize: 14, color: C.t1 },
  });
}
