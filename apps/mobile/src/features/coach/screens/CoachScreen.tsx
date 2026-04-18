import React, { useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, SafeAreaView, Platform, TextInput, KeyboardAvoidingView } from 'react-native';
import { Send, Activity, ArrowLeft } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useTheme, type AppColors } from '@theme';
import { useCoachChat } from '../hooks/useCoachChat';
import { MessageBubble } from '../components/MessageBubble';
import { TypingIndicator } from '../components/TypingIndicator';
import { QuickPrompts } from '../components/QuickPrompts';
import { TrainingPlanAccordion } from '../components/TrainingPlanAccordion';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const PROMPTS = ['How can I improve my pace?', 'Build me a 5K training plan', 'How should I warm up before a run?', 'Tips for running in the heat?'];

export default function CoachScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const listRef    = useRef<FlatList>(null);
  const coach      = useCoachChat();

  useEffect(() => {
    if (coach.messages.length > 0) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [coach.messages.length]);

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
          <ArrowLeft size={18} color={C.t2} strokeWidth={2} />
        </Pressable>
        <View style={{ flex: 1 }}><Text style={s.title}>AI Coach</Text><Text style={s.subtitle}>Powered by Claude</Text></View>
        <View style={s.aiIcon}><Activity size={16} color={C.red} strokeWidth={1.5} /></View>
      </View>
      <TrainingPlanAccordion plan={coach.trainingPlan} open={coach.planOpen} onToggle={coach.togglePlanOpen}
        goalInput={coach.goalInput} onGoalChange={coach.setGoalInput} onGenerate={coach.generatePlan} loading={coach.planLoading} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        {coach.messages.length === 0 ? (
          <View style={{ flex: 1 }}>
            <View style={s.welcome}>
              <View style={s.welcomeIcon}><Activity size={32} color={C.red} strokeWidth={1.5} /></View>
              <Text style={s.welcomeTitle}>Your AI Running Coach</Text>
              <Text style={s.welcomeText}>Ask me anything about training, nutrition, form, recovery, or race strategy.</Text>
            </View>
            <QuickPrompts prompts={PROMPTS} onSelect={coach.sendMessage} />
          </View>
        ) : (
          <FlatList ref={listRef} data={coach.messages} keyExtractor={m => m.id}
            renderItem={({ item }) => <MessageBubble role={item.role} content={item.content} />}
            contentContainerStyle={{ paddingVertical: 12 }} showsVerticalScrollIndicator={false}
            ListFooterComponent={coach.sending ? <TypingIndicator /> : null} />
        )}
        {coach.error ? (
          <View style={s.errorBanner}>
            <Text style={s.errorText}>{coach.error}</Text>
            <Pressable onPress={() => coach.sendMessage(coach.inputText || undefined)}><Text style={s.errorRetry}>Retry</Text></Pressable>
          </View>
        ) : null}
        <View style={s.inputBar}>
          <TextInput style={s.input} value={coach.inputText} onChangeText={coach.setInputText}
            placeholder="Ask your coach..." placeholderTextColor={C.t3}
            returnKeyType="send" onSubmitEditing={() => coach.sendMessage()} editable={!coach.sending} />
          <Pressable style={[s.sendBtn, (coach.inputText.trim() && !coach.sending) && s.sendBtnActive]}
            onPress={() => coach.sendMessage()} disabled={!coach.inputText.trim() || coach.sending}>
            <Send size={16} color={coach.inputText.trim() && !coach.sending ? '#fff' : C.t3} strokeWidth={2} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:          { flex: 1, backgroundColor: C.bg },
    header:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: C.border },
    backBtn:       { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    title:         { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 18, color: C.black },
    subtitle:      { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.t3, marginTop: 1 },
    aiIcon:        { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(139,92,246,0.1)', alignItems: 'center', justifyContent: 'center' },
    welcome:       { alignItems: 'center', paddingHorizontal: 40, paddingTop: 40, paddingBottom: 24 },
    welcomeIcon:   { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(139,92,246,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    welcomeTitle:  { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 20, color: C.black, marginBottom: 8, textAlign: 'center' },
    welcomeText:   { fontFamily: 'Barlow_300Light', fontSize: 13, color: C.t2, textAlign: 'center', lineHeight: 20 },
    errorBanner:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.orangeBg, borderTopWidth: 0.5, borderTopColor: 'rgba(194,90,0,0.3)', paddingHorizontal: 16, paddingVertical: 8 },
    errorText:     { fontFamily: 'Barlow_400Regular', fontSize: 13, color: C.orange, flex: 1 },
    errorRetry:    { fontFamily: 'Barlow_600SemiBold', fontSize: 13, color: C.red, marginLeft: 12 },
    inputBar:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: C.border, backgroundColor: C.bg },
    input:         { flex: 1, backgroundColor: C.white, borderRadius: 24, borderWidth: 0.5, borderColor: C.border, paddingHorizontal: 16, paddingVertical: 8, fontFamily: 'Barlow_400Regular', fontSize: 14, color: C.black },
    sendBtn:       { width: 40, height: 40, borderRadius: 20, backgroundColor: C.mid, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    sendBtnActive: { backgroundColor: C.red },
  });
}
