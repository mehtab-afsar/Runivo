import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, SafeAreaView, Platform, TextInput, KeyboardAvoidingView } from 'react-native';
import { Send } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useCoachChat } from '../hooks/useCoachChat';
import { MessageBubble } from '../components/MessageBubble';
import { TypingIndicator } from '../components/TypingIndicator';
import { QuickPrompts } from '../components/QuickPrompts';
import { TrainingPlanAccordion } from '../components/TrainingPlanAccordion';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const PROMPTS = ['How can I improve my pace?', 'Build me a 5K training plan', 'How should I warm up before a run?', 'Tips for running in the heat?'];

export default function CoachScreen() {
  const navigation = useNavigation<Nav>();
  const listRef    = useRef<FlatList>(null);
  const coach      = useCoachChat();

  useEffect(() => {
    if (coach.messages.length > 0) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [coach.messages.length]);

  return (
    <SafeAreaView style={ss.root}>
      <View style={ss.header}>
        <Pressable onPress={() => navigation.goBack()} style={{ width: 32 }}><Text style={ss.backText}>←</Text></Pressable>
        <View style={{ flex: 1 }}><Text style={ss.title}>AI Coach</Text><Text style={ss.subtitle}>Powered by Claude</Text></View>
        <View style={ss.aiIcon}><Text style={{ fontSize: 16 }}>✨</Text></View>
      </View>
      <TrainingPlanAccordion plan={coach.trainingPlan} open={coach.planOpen} onToggle={coach.togglePlanOpen}
        goalInput={coach.goalInput} onGoalChange={coach.setGoalInput} onGenerate={coach.generatePlan} loading={coach.planLoading} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        {coach.messages.length === 0 ? (
          <View style={{ flex: 1 }}>
            <View style={ss.welcome}>
              <View style={ss.welcomeIcon}><Text style={{ fontSize: 32 }}>🏃</Text></View>
              <Text style={ss.welcomeTitle}>Your AI Running Coach</Text>
              <Text style={ss.welcomeText}>Ask me anything about training, nutrition, form, recovery, or race strategy.</Text>
            </View>
            <QuickPrompts prompts={PROMPTS} onSelect={coach.sendMessage} />
          </View>
        ) : (
          <FlatList ref={listRef} data={coach.messages} keyExtractor={m => m.id}
            renderItem={({ item }) => <MessageBubble role={item.role} content={item.content} />}
            contentContainerStyle={{ paddingVertical: 12 }} showsVerticalScrollIndicator={false}
            ListFooterComponent={coach.sending ? <TypingIndicator /> : null} />
        )}
        <View style={ss.inputBar}>
          <TextInput style={ss.input} value={coach.inputText} onChangeText={coach.setInputText}
            placeholder="Ask your coach..." placeholderTextColor="#ADADAD"
            returnKeyType="send" onSubmitEditing={() => coach.sendMessage()} editable={!coach.sending} />
          <Pressable style={[ss.sendBtn, (coach.inputText.trim() && !coach.sending) && ss.sendBtnActive]}
            onPress={() => coach.sendMessage()} disabled={!coach.inputText.trim() || coach.sending}>
            <Send size={16} color={coach.inputText.trim() && !coach.sending ? '#fff' : '#ADADAD'} strokeWidth={2} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const ss = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#F8F6F3' },
  header:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: '#DDD9D4' },
  backText:      { fontFamily: 'Barlow_400Regular', fontSize: 18, color: '#6B6B6B' },
  title:         { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 18, color: '#0A0A0A' }, subtitle: { fontFamily: 'Barlow_300Light', fontSize: 10, color: '#ADADAD', marginTop: 1 },
  aiIcon:        { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F2EEF9', alignItems: 'center', justifyContent: 'center' },
  welcome:       { alignItems: 'center', paddingHorizontal: 40, paddingTop: 40, paddingBottom: 24 },
  welcomeIcon:   { width: 64, height: 64, borderRadius: 20, backgroundColor: '#F2EEF9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  welcomeTitle:  { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 20, color: '#0A0A0A', marginBottom: 8, textAlign: 'center' }, welcomeText: { fontFamily: 'Barlow_300Light', fontSize: 13, color: '#6B6B6B', textAlign: 'center', lineHeight: 20 },
  inputBar:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: '#DDD9D4', backgroundColor: '#F8F6F3' },
  input:         { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 0.5, borderColor: '#DDD9D4', paddingHorizontal: 16, paddingVertical: 8, fontFamily: 'Barlow_400Regular', fontSize: 14, color: '#0A0A0A' },
  sendBtn:       { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E8E4DF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sendBtnActive: { backgroundColor: '#D93518' },
});
