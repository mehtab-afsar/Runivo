import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Modal, View, Text, StyleSheet, Pressable, FlatList,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { PaperPlaneTilt, X, DotsThree } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import { getComments, addComment } from '../services/feedService';
import { blockUser } from '@mobile/shared/services/safetyService';
import { promptReport } from '@mobile/shared/lib/promptReport';
import { useAuth } from '@shared/hooks/useAuth';
import { supabase } from '@shared/services/supabase';
import type { Comment } from '../types';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

interface Props {
  postId: string | null;
  onClose: () => void;
  onCommentPosted?: (postId: string) => void;
}

export default function CommentSheet({ postId, onClose, onCommentPosted }: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);

  const [comments, setComments]   = useState<Comment[]>([]);
  const [text, setText]           = useState('');
  const [loading, setLoading]     = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [sending, setSending]     = useState(false);
  const inputRef = useRef<TextInput>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!postId) { setComments([]); return; }
    setLoading(true);
    setLoadError(false);
    getComments(postId)
      .then(data => setComments(data))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [postId]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || !postId || sending) return;

    const optimistic: Comment = {
      id: `opt-${Date.now()}`,
      userId: '',
      username: 'You',
      avatarColor: '#888888',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    setText('');
    setSending(true);
    setComments(prev => [...prev, optimistic]);

    try {
      await addComment(postId, trimmed);
      onCommentPosted?.(postId);
    } catch (e) {
      setComments(prev => prev.filter(c => c.id !== optimistic.id));
      setText(trimmed);
      const msg = (e as { message?: string } | null)?.message ?? '';
      if (msg.includes('content_not_allowed')) Alert.alert("That can't be posted", "It contains language that isn't allowed in Runivo. Please reword it.");
      else if (msg.includes('account_suspended')) Alert.alert('Commenting is turned off', 'This account is suspended. Contact support if you think that is a mistake.');
      else Alert.alert("Couldn't post your comment", 'Check your connection and try again. Your text is still in the box.');
    } finally {
      setSending(false);
    }
  }, [text, postId, sending, onCommentPosted]);

  const openMenu = useCallback((item: Comment) => {
    const mine = !!user && item.userId === user.id;
    if (mine) {
      Alert.alert('Your comment', undefined, [
        { text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('feed_post_comments').delete().eq('id', item.id);
          if (error) Alert.alert("Couldn't delete it", 'Try again in a moment.');
          else setComments(prev => prev.filter(c => c.id !== item.id));
        } },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    Alert.alert(`Comment by ${item.username}`, undefined, [
      { text: 'Report comment', onPress: () => promptReport('comment', item.id, 'comment') },
      { text: `Block ${item.username}`, style: 'destructive', onPress: () => {
        Alert.alert(`Block ${item.username}?`, "You won't see their posts or comments, and they won't see yours.", [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Block', style: 'destructive', onPress: async () => {
            try { await blockUser(item.userId); setComments(prev => prev.filter(c => c.userId !== item.userId)); }
            catch { Alert.alert("Couldn't block", 'Check your connection and try again.'); }
          } },
        ]);
      } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [user]);

  const renderItem = useCallback(({ item }: { item: Comment }) => {
    const initial = (item.username?.[0] ?? '?').toUpperCase();
    return (
      <View style={s.commentRow}>
        <View style={[s.avatar, { backgroundColor: item.avatarColor }]}>
          <Text style={s.avatarInitial}>{initial}</Text>
        </View>
        <View style={s.commentBody}>
          <View style={s.commentTop}>
            <Text style={s.commentUser}>{item.username}</Text>
            <Text style={s.commentTime}>{timeAgo(item.createdAt)}</Text>
            {!item.id.startsWith('opt-') && (
              <Pressable onPress={() => openMenu(item)} hitSlop={12} style={s.more}
                accessibilityRole="button" accessibilityLabel={`More options for ${item.username}'s comment`}>
                <DotsThree size={20} color={C.t2} weight="bold" />
              </Pressable>
            )}
          </View>
          <Text style={s.commentText}>{item.content}</Text>
        </View>
      </View>
    );
  }, [s, C, openMenu]);

  return (
    <Modal
      visible={postId !== null}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={s.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.sheet}
      >
        <View style={s.handle} />

        <View style={s.titleRow}>
          <Text style={s.title}>Comments{comments.length > 0 ? ` · ${comments.length}` : ''}</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={18} color={C.t2} weight="light" />
          </Pressable>
        </View>

        {loading ? (
          <View style={s.center}><ActivityIndicator color={C.red} /></View>
        ) : loadError ? (
          <View style={s.center}><Text style={s.empty}>Couldn't load comments.</Text></View>
        ) : (
          <FlatList
            data={comments}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={s.list}
            ListEmptyComponent={
              <Text style={s.empty}>No comments yet. Be first.</Text>
            }
          />
        )}

        <View style={s.inputRow}>
          <TextInput
            ref={inputRef}
            style={s.input}
            placeholder="Add a comment…"
            placeholderTextColor={C.t3}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={280}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <Pressable onPress={handleSend} disabled={!text.trim() || sending} hitSlop={8} accessibilityRole="button" accessibilityLabel="Send comment">
            <PaperPlaneTilt
              size={18}
              color={text.trim() ? C.red : C.t3}
              weight="light"
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    backdrop:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
    sheet:        { backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '75%', paddingBottom: 24 },
    handle:       { width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
    titleRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
    title:        { fontFamily: Fonts.semiBold, fontSize: 15, color: C.black },
    center:       { height: 120, alignItems: 'center', justifyContent: 'center' },
    list:         { paddingHorizontal: 16, paddingBottom: 8, flexGrow: 1 },
    empty:        { fontFamily: Fonts.regular, fontSize: 13, color: C.t3, textAlign: 'center', marginTop: 32 },
    more:         { marginLeft: 'auto', minWidth: 28, minHeight: 28, alignItems: 'center', justifyContent: 'center' },
    commentRow:   { flexDirection: 'row', gap: 10, paddingVertical: 8 },
    avatar:       { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    avatarInitial:{ fontFamily: Fonts.semiBold, fontSize: 12, color: C.white },
    commentBody:  { flex: 1 },
    commentTop:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
    commentUser:  { fontFamily: Fonts.medium, fontSize: 13, color: C.black },
    commentTime:  { fontFamily: Fonts.regular, fontSize: 11, color: C.t3 },
    commentText:  { fontFamily: Fonts.regular, fontSize: 13, color: C.black, lineHeight: 18 },
    inputRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: C.border },
    input:        { flex: 1, fontFamily: Fonts.regular, fontSize: 14, color: C.black, paddingVertical: 8, maxHeight: 80 },
  });
}
