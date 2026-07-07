import React, { useRef, useEffect, useMemo } from 'react';
import {
  Modal, View, Text, StyleSheet, FlatList, Pressable,
  Platform, KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'phosphor-react-native';
import { useTheme, Fonts, type AppColors } from '@theme';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { CoachFloatingInput } from './CoachFloatingInput';
import type { CoachMessage } from '../services/coachService';

interface Props {
  visible: boolean;
  onClose: () => void;
  messages: CoachMessage[];
  sending: boolean;
  error: string | null;
  inputText: string;
  setInputText: (t: string) => void;
  onSend: (text?: string) => void;
  onRetry: () => void;
  onOpenCapabilities: () => void;
}

export function PaceChatModal({
  visible, onClose, messages, sending, error,
  inputText, setInputText, onSend, onRetry, onOpenCapabilities,
}: Props) {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const insets  = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (messages.length > 0 && visible) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length, visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={[s.root, { backgroundColor: C.bg }]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={[s.inner, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={[s.header, { borderBottomColor: C.border }]}>
              <Text>
                <Text style={[s.pace, { color: C.black }]}>Pace</Text>
                <Text style={[s.x, { color: C.red }]}>X</Text>
              </Text>
              <Pressable style={[s.closeBtn, { backgroundColor: C.stone, borderColor: C.border }]} onPress={onClose} hitSlop={8}>
                <X size={16} color={C.t2} weight="light" />
              </Pressable>
            </View>

            {/* Messages */}
            <FlatList
              ref={listRef}
              style={{ flex: 1 }}
              data={messages}
              keyExtractor={m => m.id}
              renderItem={({ item }) => (
                <>
                  {item.auto_triggered && (
                    <Text style={s.autoLabel}>✨ After your run</Text>
                  )}
                  <MessageBubble role={item.role} content={item.content} type={item.type} />
                </>
              )}
              contentContainerStyle={s.listContent}
              showsVerticalScrollIndicator={false}
              ListFooterComponent={sending ? <TypingIndicator /> : null}
              ListEmptyComponent={
                <View style={s.emptyWrap}>
                  <Text style={[s.emptyText, { color: C.t3 }]}>Start a conversation…</Text>
                </View>
              }
            />

            {/* Error banner */}
            {!!error && (
              <View style={s.errorBanner}>
                <Text style={[s.errorText, { color: C.red }]}>{error}</Text>
                <Pressable onPress={onRetry}>
                  <Text style={[s.errorRetry, { color: C.red }]}>Retry</Text>
                </Pressable>
              </View>
            )}

            <CoachFloatingInput
              value={inputText}
              onChangeText={setInputText}
              onSend={() => onSend()}
              sending={sending}
              onOpenCapabilities={onOpenCapabilities}
            />
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:        { flex: 1 },
    inner:       { flex: 1 },
    header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5 },
    pace:        { fontFamily: Fonts.semiBold, fontSize: 20 },
    x:           { fontFamily: Fonts.bold, fontSize: 21 },
    closeBtn:    { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5 },
    listContent: { paddingVertical: 12 },
    autoLabel:   { fontFamily: Fonts.regular, fontSize: 11, color: C.t3, textAlign: 'center', marginTop: 16, marginBottom: 4 },
    emptyWrap:   { flex: 1, alignItems: 'center', paddingTop: 48 },
    emptyText:   { fontFamily: Fonts.regular, fontSize: 14 },
    errorBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(220,38,38,0.06)', borderTopWidth: 0.5, borderTopColor: 'rgba(220,38,38,0.18)', paddingHorizontal: 16, paddingVertical: 8 },
    errorText:   { fontFamily: Fonts.regular, fontSize: 13, flex: 1 },
    errorRetry:  { fontFamily: Fonts.medium, fontSize: 13, marginLeft: 12 },
  });
}
