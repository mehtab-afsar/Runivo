import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Modal, View, Text, StyleSheet, Pressable, FlatList,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Send, X } from 'lucide-react-native';
import { useTheme, type AppColors } from '@theme';
import { getComments, addComment } from '../services/feedService';
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
  const [sending, setSending]     = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!postId) { setComments([]); return; }
    setLoading(true);
    getComments(postId).then(data => {
      setComments(data);
      setLoading(false);
    });
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
    } catch {
      setComments(prev => prev.filter(c => c.id !== optimistic.id));
      setText(trimmed);
    } finally {
      setSending(false);
    }
  }, [text, postId, sending, onCommentPosted]);

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
          </View>
          <Text style={s.commentText}>{item.content}</Text>
        </View>
      </View>
    );
  }, [s]);

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
            <X size={18} color={C.t2} strokeWidth={1.5} />
          </Pressable>
        </View>

        {loading ? (
          <View style={s.center}><ActivityIndicator color={C.red} /></View>
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
          <Pressable onPress={handleSend} disabled={!text.trim() || sending} hitSlop={8}>
            <Send
              size={18}
              color={text.trim() ? C.red : C.t3}
              strokeWidth={1.5}
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
    title:        { fontFamily: 'Barlow_600SemiBold', fontSize: 15, color: C.black },
    center:       { height: 120, alignItems: 'center', justifyContent: 'center' },
    list:         { paddingHorizontal: 16, paddingBottom: 8, flexGrow: 1 },
    empty:        { fontFamily: 'Barlow_300Light', fontSize: 13, color: C.t3, textAlign: 'center', marginTop: 32 },
    commentRow:   { flexDirection: 'row', gap: 10, paddingVertical: 8 },
    avatar:       { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    avatarInitial:{ fontFamily: 'Barlow_600SemiBold', fontSize: 12, color: '#fff' },
    commentBody:  { flex: 1 },
    commentTop:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
    commentUser:  { fontFamily: 'Barlow_500Medium', fontSize: 13, color: C.black },
    commentTime:  { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t3 },
    commentText:  { fontFamily: 'Barlow_400Regular', fontSize: 13, color: C.black, lineHeight: 18 },
    inputRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: C.border },
    input:        { flex: 1, fontFamily: 'Barlow_400Regular', fontSize: 14, color: C.black, paddingVertical: 8, maxHeight: 80 },
  });
}
