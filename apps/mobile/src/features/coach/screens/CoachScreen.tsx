import { PlusOnlyCoach } from '../components/PaceXLocked';
import { AiConsentGate } from '../components/AiConsentGate';
import { SafetyNote } from '@mobile/shared/components/SafetyNote';
import React, { useMemo, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Platform, KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { X, ArrowLeft, ArrowUp, CalendarBlank, Hexagon, Flag, ShieldCheck, Pulse, type Icon } from 'phosphor-react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { PaceXOrb } from '@mobile/shared/components/PaceXOrb';
import { supabase } from '@shared/services/supabase';
import { useTheme, Fonts, Spacing, type AppColors } from '@theme';
import { useCoachNav } from '@navigation/CoachNavContext';
import { useCoachChat } from '../hooks/useCoachChat';
import { useActivePlan } from '../hooks/useActivePlan';
import { requestPostRunAnalysis } from '../services/coachService';
import { CoachSessionCard } from '../components/CoachSessionCard';
import { parseCoachReply } from '@shared/engine/coachSession';
import { CoachSidebar } from '../components/CoachSidebar';
import { PaceAutoCard } from '../components/PaceAutoCard';
import { MessageBubble } from '../components/MessageBubble';
import { TypingIndicator } from '../components/TypingIndicator';
import { PaceChatModal } from '../components/PaceChatModal';

type Nav = NativeStackNavigationProp<RootStackParamList>;



/** PaceX is a Runivo Plus feature (PRD); free runners see what it offers. */
const START_OPTIONS: { label: string; message: string; plan?: boolean; icon: Icon; color: string }[] = [
  { label: "Today's session", message: 'What should I run today?', icon: Hexagon, color: '#4E7F1F' },
  { label: 'Train for a race', message: '', plan: true, icon: Flag, color: '#3C3577' },
  { label: 'Defend my zones', message: 'Which of my zones are at risk this week, and what run would defend them?', icon: ShieldCheck, color: '#A85E06' },
  { label: 'Why was I slow?', message: 'Why was my last run slower than usual?', icon: Pulse, color: '#C0434F' },
  { label: 'My week', message: 'How is my week going?', icon: CalendarBlank, color: '#B88A0C' },
];

export default function CoachScreen() {
  return <PlusOnlyCoach><AiConsentGate><CoachScreenInner /></AiConsentGate></PlusOnlyCoach>;
}

function CoachScreenInner() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const { setCoachActive } = useCoachNav();

  const coach    = useCoachChat();
  const planData = useActivePlan();

  const [chatVisible,         setChatVisible]         = useState(false);
  const [atStart,             setAtStart]             = useState(true);
  const [capabilitiesVisible, setCapabilitiesVisible] = useState(false);
  const [playerName,          setPlayerName]          = useState('Runner');

  useFocusEffect(
    useCallback(() => {
      setCoachActive(true);
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) return;
        const uid = session.user.id;

        coach.loadBrief();
        coach.loadQuickPrompts();

        const fetchProfile = async () => {
          try {
            const { data } = await supabase
              .from('profiles')
              .select('username')
              .eq('id', uid)
              .maybeSingle();
            if (!data) return;
            setPlayerName(data.username ?? 'Runner');
          } catch { /* offline */ }
        };
        fetchProfile();
      }).catch(() => {});

      return () => setCoachActive(false);
      // coach is a fresh object every render (useCoachChat isn't memoized) — the
      // functions called above (loadBrief/loadQuickPrompts) are themselves stable,
      // so depending on `coach` here would re-run this effect every render instead
      // of only on focus.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setCoachActive]),
  );

  const hasActivePlan  = !!planData.plan && !!planData.week;

  const autoCard = useMemo(() => {
    const triggered = coach.messages.filter(m => m.auto_triggered);
    return triggered.length > 0 ? triggered[triggered.length - 1] : null;
  }, [coach.messages]);

  const openChatWithPrompt = useCallback((prompt: string) => {
    if (prompt) coach.setInputText(prompt);
    setChatVisible(true);
  }, [coach]);

  // Post-Run Debrief and Weekly Review both have a real structured backend feature
  // (post_run / weekly_brief) — route them there and render as a card instead of
  // letting them fall through to freeform coach_chat like every other capability.
  const requestPostRunDebrief = useCallback(async () => {
    setChatVisible(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data: lastRun } = await supabase
      .from('runs')
      .select('id')
      .eq('user_id', session.user.id)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!lastRun) {
      coach.showCard({ praise: 'No synced run yet.', analysis: 'Finish a run and let it upload, then ask again.', suggestion: '' });
      return;
    }
    try {
      const payload = await requestPostRunAnalysis(lastRun.id, session.access_token);
      if (payload) coach.showCard(payload);
      else coach.showCard({ praise: 'That run was too short to look at.', analysis: 'Runs under 500 m are skipped.', suggestion: '' });
    } catch (e) {
      coach.failWith(e, 'Could not load your debrief');
    }
  }, [coach]);

  const requestWeeklyReview = useCallback(async () => {
    setChatVisible(true);
    const brief = coach.brief ?? await coach.loadBrief();
    if (brief) coach.showCard(brief);
    else coach.failWith(null, "Couldn't load your weekly review. Try again in a minute");
  }, [coach]);

  const handleCapabilitySelect = useCallback((message: string) => {
    if (message === 'open_plan') {
      navigation.navigate(hasActivePlan ? 'TrainingPlan' : 'PlanBuilder');
      return;
    }
    setAtStart(false);
    if (message === 'open_chat') {
      setChatVisible(true);
      return;
    }
    if (message === 'habit_tracking') {
      setChatVisible(true);
      coach.requestHabitAnalysis();
      return;
    }
    if (message === 'nutrition_coach') {
      setChatVisible(true);
      coach.requestNutritionCoach();
      return;
    }
    if (message === 'Analyse my last run') {
      requestPostRunDebrief();
      return;
    }
    if (message === 'Give me my weekly review') {
      requestWeeklyReview();
      return;
    }
    openChatWithPrompt(message);
  }, [openChatWithPrompt, coach, requestPostRunDebrief, requestWeeklyReview, navigation, hasActivePlan]);

  const scrollRef = useRef<ScrollView>(null);
  const chips: { label: string; message: string }[] = coach.quickPrompts.length > 0
    ? coach.quickPrompts.slice(0, 4)
    : [
        { label: 'Plan my week', message: 'Plan my week' },
        { label: 'Which zones are at risk?', message: 'Which of my zones are at risk this week?' },
        { label: 'Pace for my next run', message: 'What pace should my next run be?' },
      ];

  const modals = (
    <>
      {/* Full chat history (from capability actions) */}
      <PaceChatModal
        visible={chatVisible}
        onClose={() => setChatVisible(false)}
        messages={coach.messages}
        liveMessageIds={coach.liveMessageIds}
        sending={coach.sending}
        error={coach.error}
        inputText={coach.inputText}
        setInputText={coach.setInputText}
        onSend={coach.sendMessage}
        onRetry={coach.retryLastMessage}
        onOpenCapabilities={() => { setChatVisible(false); setCapabilitiesVisible(true); }}
      />

      <CoachSidebar
        visible={capabilitiesVisible}
        onClose={() => setCapabilitiesVisible(false)}
        onSelectCapability={handleCapabilitySelect}
      />

    </>
  );

  const thread = coach.messages.filter(m => !m.auto_triggered);
  // Opens on the start screen (mock); any message moves to the chat.
  const started = !atStart || coach.sending;
  const firstName = (playerName || 'there').split(/[._\s]/)[0];
  const ask = (o: (typeof START_OPTIONS)[number]) => {
    if (o.plan) { navigation.navigate(hasActivePlan ? 'TrainingPlan' : 'PlanBuilder'); return; }
    setAtStart(false);
    coach.sendMessage(o.message);
  };
  const openPlan = () => navigation.navigate(hasActivePlan ? 'TrainingPlan' : 'PlanBuilder');

  const inputRow = (big: boolean) => (
    <View style={s.inputRow}>
      <View style={[s.inputPill, { height: big ? 60 : 56, borderRadius: big ? 30 : 28 }]}>
        <TextInput
          style={s.input}
          placeholder={started ? 'Write your message…' : 'Ask PaceX anything…'}
          placeholderTextColor={C.t3}
          value={coach.inputText}
          onChangeText={coach.setInputText}
          onSubmitEditing={() => { setAtStart(false); coach.sendMessage(); }}
          returnKeyType="send"
          editable={!coach.sending}
          accessibilityLabel="Message PaceX"
        />
      </View>
      <Pressable
        style={[s.send, { width: big ? 60 : 56, height: big ? 60 : 56, borderRadius: big ? 30 : 28 }, (!coach.inputText.trim() || coach.sending) && { opacity: 0.5 }]}
        onPress={() => { setAtStart(false); coach.sendMessage(); }}
        disabled={!coach.inputText.trim() || coach.sending}
        accessibilityRole="button"
        accessibilityLabel="Send"
      >
        <ArrowUp size={22} color={C.alwaysLight} weight="bold" />
      </Pressable>
    </View>
  );

  // ── Start (mock "PaceX start"): lavender glow, big orb, a few ways in ──
  if (!started) {
    return (
      <View style={s.startRoot}>
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <RadialGradient id="pxbg" cx="70%" cy="0%" rx="120%" ry="60%">
              <Stop offset="0" stopColor="#DCD8F7" />
              <Stop offset="0.45" stopColor="#EEEDF8" />
              <Stop offset="1" stopColor={C.bg} />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#pxbg)" />
        </Svg>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={s.startTop}>
              <Pressable style={s.glassBtn} onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main' as never))} accessibilityRole="button" accessibilityLabel="Close PaceX">
                <X size={18} color={C.t1} weight="bold" />
              </Pressable>
              <Pressable style={s.glassPill} onPress={openPlan} accessibilityRole="button">
                <CalendarBlank size={16} color={C.t1} weight="bold" />
                <Text style={s.glassPillTxt}>Your plan</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={s.startScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={s.bigOrb}><PaceXOrb size={128} /></View>
              <Text style={s.startHi}>Hi {firstName},{'\n'}what are we running?</Text>
              <Text style={s.startSub}>PaceX knows your runs, your zones and your plan.</Text>
              <View style={s.startChips}>
                {START_OPTIONS.map((o, i) => {
                  const Icon = o.icon;
                  return (
                    <Pressable key={o.label} style={[s.startChip, i === 0 && s.startChipFirst]} onPress={() => ask(o)} accessibilityRole="button">
                      <Icon size={18} color={o.color} weight="bold" />
                      <Text style={s.startChipTxt}>{o.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {thread.length > 0 && (
                <Pressable onPress={() => setAtStart(false)} hitSlop={8} accessibilityRole="button">
                  <Text style={s.resume}>Carry on our last chat</Text>
                </Pressable>
              )}
              {coach.error && (
                <Pressable onPress={coach.retryLastMessage} style={s.errorRow}>
                  <Text style={s.errorText}>{coach.error} · Tap to retry</Text>
                </Pressable>
              )}
            </ScrollView>
            <View style={s.startDock}>
              {inputRow(true)}
              <SafetyNote kind="coach" style={{ marginTop: 8, marginBottom: 0 }} />
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
        {modals}
      </View>
    );
  }

  // ── Chat (mock "PaceX chat") ──
  return (
    <SafeAreaView style={s.chatRoot} edges={['top', 'bottom']}>
      <View style={s.chatHead}>
        <Pressable style={s.whiteBtn} onPress={() => setAtStart(true)} accessibilityRole="button" accessibilityLabel="Back">
          <ArrowLeft size={18} color={C.t1} weight="bold" />
        </Pressable>
        <PaceXOrb size={40} />
        <View style={{ flex: 1 }}>
          <Text style={s.chatName}>PaceX</Text>
          <Text style={s.chatRole}>Your running coach</Text>
        </View>
        <Pressable style={s.whiteBtn} onPress={openPlan} accessibilityRole="button" accessibilityLabel="Your plan">
          <CalendarBlank size={18} color={C.t1} weight="bold" />
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.thread}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {autoCard && <PaceAutoCard message={autoCard} onReadMore={() => setChatVisible(true)} />}
          {thread.map(m => {
            const isCard = !!m.type && m.type !== 'chat' && m.type !== 'text';
            if (isCard) {
              return (
                <View key={m.id} style={s.cardRow}>
                  <MessageBubble role={m.role} content={m.content} type={m.type} animate={coach.liveMessageIds.has(m.id)} />
                </View>
              );
            }
            return m.role === 'user'
              ? <View key={m.id} style={s.userBubble}><Text style={s.userText}>{m.content}</Text></View>
              : (() => {
                  // PaceX may end a reply with a <session> card (mock PaceXChat).
                  const r = parseCoachReply(m.content);
                  return (
                    <View key={m.id}>
                      <View style={s.coachBubble}><Text style={s.coachText}>{r.text}</Text></View>
                      {r.session && <CoachSessionCard session={r.session} />}
                    </View>
                  );
                })();
          })}
          {coach.sending && <View style={s.coachBubbleWrap}><TypingIndicator /></View>}
          {coach.error && (
            <Pressable onPress={coach.retryLastMessage} style={s.errorRow}>
              <Text style={s.errorText}>{coach.error} · Tap to retry</Text>
            </Pressable>
          )}
        </ScrollView>

        <View style={s.chatDock}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} keyboardShouldPersistTaps="handled">
            {chips.map(c => (
              <Pressable hitSlop={6} key={c.label} style={s.chip} onPress={() => handleCapabilitySelect(c.message)}>
                <Text style={s.chipText}>{c.label}</Text>
              </Pressable>
            ))}
            <Pressable hitSlop={6} style={s.chip} onPress={() => setCapabilitiesVisible(true)}>
              <Text style={s.chipText}>More</Text>
            </Pressable>
          </ScrollView>
          {inputRow(false)}
        </View>
      </KeyboardAvoidingView>
      {modals}
    </SafeAreaView>
  );
}



function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:         { flex: 1, backgroundColor: C.bg },
    header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.gutter, paddingVertical: 10 },
    // Start
    startRoot:    { flex: 1, backgroundColor: C.bg },
    startTop:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 },
    glassBtn:     { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.8)', alignItems: 'center', justifyContent: 'center' },
    glassPill:    { height: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.8)', flexDirection: 'row', alignItems: 'center', gap: 6 },
    glassPillTxt: { fontFamily: Fonts.regular, fontSize: 14, color: C.t1 },
    startScroll:  { alignItems: 'center', paddingHorizontal: 24, paddingTop: 40, paddingBottom: 24 },
    bigOrb:       { width: 128, height: 128, borderRadius: 64, shadowColor: '#8F84F0', shadowOpacity: 0.35, shadowRadius: 36, shadowOffset: { width: 0, height: 0 }, elevation: 0 },
    startHi:      { fontFamily: Fonts.semiBold, fontSize: 34, lineHeight: 38, letterSpacing: -0.8, color: C.t1, textAlign: 'center', marginTop: 22 },
    startSub:     { fontFamily: Fonts.regular, fontSize: 15, color: '#55596A', textAlign: 'center', marginTop: 10 },
    // alignSelf stretch: inside the centred scroll the row sized to its content and never wrapped, so the second row ran off the screen.
    startChips:   { alignSelf: 'stretch', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 36 },
    startChip:    { height: 46, paddingHorizontal: 16, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.65)', flexDirection: 'row', alignItems: 'center', gap: 8 },
    startChipFirst: { backgroundColor: '#FFFFFF', shadowColor: '#3C3577', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } },
    startChipTxt: { fontFamily: Fonts.regular, fontSize: 15, color: C.t1 },
    resume:       { fontFamily: Fonts.medium, fontSize: 14, color: C.lavenderInk, marginTop: 22, textDecorationLine: 'underline' },
    startDock:    { paddingHorizontal: 16, paddingBottom: 8 },
    // Shared input
    inputRow:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
    inputPill:    { flex: 1, backgroundColor: '#FFFFFF', justifyContent: 'center', paddingLeft: 20, paddingRight: 12, shadowColor: '#3C3577', shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
    input:        { fontFamily: Fonts.regular, fontSize: 16, color: '#17181A' },
    send:         { backgroundColor: C.alwaysDark, alignItems: 'center', justifyContent: 'center' },
    // Chat
    chatRoot:     { flex: 1, backgroundColor: '#F4F4F8' },
    chatHead:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12 },
    whiteBtn:     { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
    chatName:     { fontFamily: Fonts.semiBold, fontSize: 17, color: '#17181A' },
    chatRole:     { fontFamily: Fonts.regular, fontSize: 13, color: '#55596A' },
    thread:       { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, gap: 14 },
    cardRow:      { alignSelf: 'stretch' },
    userBubble:   { alignSelf: 'flex-end', maxWidth: '76%', paddingVertical: 12, paddingHorizontal: 16, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderBottomLeftRadius: 22, borderBottomRightRadius: 6, backgroundColor: '#17181A' },
    userText:     { fontFamily: Fonts.regular, fontSize: 15, lineHeight: 21, color: '#FFFFFF' },
    coachBubble:  { alignSelf: 'flex-start', maxWidth: '90%', paddingVertical: 12, paddingHorizontal: 16, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderBottomRightRadius: 22, borderBottomLeftRadius: 6, backgroundColor: '#FFFFFF' },
    coachBubbleWrap: { alignSelf: 'flex-start' },
    coachText:    { fontFamily: Fonts.regular, fontSize: 15, lineHeight: 21, color: '#17181A' },
    errorRow:     { alignSelf: 'center', paddingVertical: 8 },
    errorText:    { fontFamily: Fonts.medium, fontSize: 13, color: C.danger, textAlign: 'center' },
    chatDock:     { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 12, backgroundColor: '#F4F4F8' },
    chips:        { gap: 8 },
    chip:         { height: 38, paddingHorizontal: 14, borderRadius: 19, backgroundColor: '#E4E1F8', justifyContent: 'center' },
    chipText:     { fontFamily: Fonts.regular, fontSize: 14, color: '#2A2560' },
  });
}
