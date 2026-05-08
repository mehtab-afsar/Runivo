import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Platform, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Sparkles } from 'lucide-react-native';
import { supabase } from '@shared/services/supabase';
import { useTheme, type AppColors } from '@theme';
import { useCoachNav } from '@navigation/CoachNavContext';
import { useCoachChat } from '../hooks/useCoachChat';
import { getQuickPrompts, type QuickPrompt } from '../services/coachService';
import { MessageBubble } from '../components/MessageBubble';
import { TypingIndicator } from '../components/TypingIndicator';
import { CoachFloatingInput } from '../components/CoachFloatingInput';
import { CoachSidebar } from '../components/CoachSidebar';
import { CoachWelcome } from '../components/CoachWelcome';

const STATIC_PROMPTS: QuickPrompt[] = [
  { label: 'How can I improve my pace?',    message: 'How can I improve my pace?' },
  { label: 'Build me a 5K training plan',   message: 'Build me a 5K training plan' },
  { label: 'Analyse my last run',           message: 'Analyse my most recent run' },
  { label: 'What to eat before a long run?',message: 'What should I eat before a long run?' },
];

export default function CoachScreen() {
  const C    = useTheme();
  const ss   = useMemo(() => mkStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);
  const coach   = useCoachChat();
  const { setCoachActive } = useCoachNav();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [quickPrompts, setQuickPrompts] = useState<QuickPrompt[]>(STATIC_PROMPTS);

  // useFocusEffect (not useEffect) because tab screens persist in the tree —
  // they don't unmount when you switch tabs, they just blur/focus.
  useFocusEffect(
    useCallback(() => {
      setCoachActive(true);
      // Fetch contextual quick prompts on focus, fall back to statics
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) return;
        getQuickPrompts(session.access_token).then(setQuickPrompts).catch(() => {});
      }).catch(() => {});
      return () => setCoachActive(false);
    }, [setCoachActive])
  );

  useEffect(() => {
    if (coach.messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [coach.messages.length]);

  return (
    <View style={[ss.screen, { backgroundColor: C.bg }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={[ss.root, { paddingTop: insets.top }]}>

          {/* ── Header ─────────────────────────────────────────────── */}
          <View style={[ss.header, { borderBottomColor: C.border }]}>
            <View style={ss.avatar}>
              <Sparkles size={16} color="#7C3AED" strokeWidth={1.5} />
            </View>
            <View>
              <Text style={[ss.title, { color: C.black }]}>AI Coach</Text>
              <Text style={ss.subtitle}>Powered by Claude</Text>
            </View>
          </View>

          {/* ── Messages / welcome ─────────────────────────────────── */}
          {coach.messages.length === 0 ? (
            <View style={{ flex: 1 }}>
              <CoachWelcome />
              <View style={ss.promptsWrap}>
                {quickPrompts.map(p => (
                  <Pressable
                    key={p.message}
                    style={({ pressed }) => [
                      ss.promptChip,
                      { borderColor: C.border, backgroundColor: pressed ? C.mid : C.white },
                    ]}
                    onPress={() => coach.sendMessage(p.message)}
                  >
                    <Text style={[ss.promptText, { color: C.black }]}>{p.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              style={{ flex: 1 }}
              data={coach.messages}
              keyExtractor={m => m.id}
              renderItem={({ item }) => <MessageBubble role={item.role} content={item.content} type={item.type} />}
              contentContainerStyle={{ paddingVertical: 12 }}
              showsVerticalScrollIndicator={false}
              ListFooterComponent={coach.sending ? <TypingIndicator /> : null}
            />
          )}

          {/* ── Error banner ───────────────────────────────────────── */}
          {!!coach.error && (
            <View style={ss.errorBanner}>
              <Text style={ss.errorText}>{coach.error}</Text>
              <Pressable onPress={() => coach.sendMessage(coach.inputText || undefined)}>
                <Text style={[ss.errorRetry, { color: C.red }]}>Retry</Text>
              </Pressable>
            </View>
          )}

          {/* ── Floating curved input ──────────────────────────────── */}
          <CoachFloatingInput
            value={coach.inputText}
            onChangeText={coach.setInputText}
            onSend={() => coach.sendMessage()}
            sending={coach.sending}
            onOpenSidebar={() => setSidebarOpen(true)}
          />
        </View>
      </KeyboardAvoidingView>

      {/* Sidebar lives outside KAV so keyboard movement doesn't shift it */}
      <CoachSidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelectCapability={(message) => coach.sendMessage(message)}
      />
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    screen:      { flex: 1 },
    root:        { flex: 1 },
    header:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5 },
    avatar:      { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(124,58,237,0.08)', alignItems: 'center', justifyContent: 'center' },
    title:       { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 18 },
    subtitle:    { fontFamily: 'DMSans_300Light', fontSize: 10, color: C.t3, marginTop: 1 },
    promptsWrap: { paddingHorizontal: 16, gap: 8, paddingBottom: 12 },
    promptChip:  { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 0.5 },
    promptText:  { fontFamily: 'DMSans_400Regular', fontSize: 13 },
    errorBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(220,38,38,0.06)', borderTopWidth: 0.5, borderTopColor: 'rgba(220,38,38,0.18)', paddingHorizontal: 16, paddingVertical: 8 },
    errorText:   { fontFamily: 'DMSans_400Regular', fontSize: 13, color: C.red, flex: 1 },
    errorRetry:  { fontFamily: 'DMSans_500Medium', fontSize: 13, marginLeft: 12 },
  });
}
