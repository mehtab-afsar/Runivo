import { PlusOnlyCoach } from '../components/PaceXLocked';
import React, { useMemo, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Modal, TextInput,
  ActivityIndicator, Platform, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { X, ArrowLeft, Check, PaperPlaneTilt } from 'phosphor-react-native';
import { supabase } from '@shared/services/supabase';
import { getTerritoryPolygons } from '@shared/services/store';
import { weeklyCapFor } from '@shared/engine/runEngine';
import { GAME_CONFIG } from '@shared/services/config';
import type { TerritoryPolygon } from '@shared/types/game';
import { useTheme, Fonts, Spacing, type AppColors } from '@theme';
import { useCoachNav } from '@navigation/CoachNavContext';
import { useCoachChat } from '../hooks/useCoachChat';
import { usePlanScreen } from '../hooks/usePlanScreen';
import { requestPostRunAnalysis } from '../services/coachService';
import { CoachWelcome } from '../components/CoachWelcome';
import { CoachSidebar } from '../components/CoachSidebar';
import { PaceAutoCard } from '../components/PaceAutoCard';
import { MessageBubble } from '../components/MessageBubble';
import { TypingIndicator } from '../components/TypingIndicator';
import { PaceChatModal } from '../components/PaceChatModal';
import { buildInsightMessage, getTodaySession, getStaleZones } from '../utils/insightBuilder';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function PaceXLogo({ size = 22 }: { size?: number }) {
  const C = useTheme();
  return (
    <Text>
      <Text style={{ fontFamily: Fonts.semiBold, fontSize: size, color: C.black }}>Pace</Text>
      <Text style={{ fontFamily: Fonts.bold, fontSize: size + 1, color: C.red }}>X</Text>
    </Text>
  );
}


/** PaceX is a Runivo Plus feature (PRD); free runners see what it offers. */
export default function CoachScreen() {
  return <PlusOnlyCoach><CoachScreenInner /></PlusOnlyCoach>;
}

function CoachScreenInner() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const { setCoachActive } = useCoachNav();

  const coach    = useCoachChat();
  const planData = usePlanScreen();

  const [chatVisible,         setChatVisible]         = useState(false);
  const [capabilitiesVisible, setCapabilitiesVisible] = useState(false);
  const [planFormVisible,     setPlanFormVisible]     = useState(false);
  const [staleZones,          setStaleZones]          = useState<TerritoryPolygon[]>([]);
  const [playerName,          setPlayerName]          = useState('Runner');
  const [paceWeeklyEarned,    setPaceWeeklyEarned]    = useState(0);
  const [paceWeeklyCap,       setPaceWeeklyCap]       = useState<number>(GAME_CONFIG.PACE_WEEKLY_CAP_FREE);

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
              .select('username, pace_weekly_earned, subscription_tier')
              .eq('id', uid)
              .maybeSingle();
            if (!data) return;
            setPlayerName(data.username ?? 'Runner');
            setPaceWeeklyEarned(data.pace_weekly_earned ?? 0);
            setPaceWeeklyCap(weeklyCapFor(data.subscription_tier));
          } catch { /* offline */ }
        };
        fetchProfile();

        getTerritoryPolygons(uid).then(all => setStaleZones(getStaleZones(all, uid)));
      }).catch(() => {});

      return () => setCoachActive(false);
      // coach is a fresh object every render (useCoachChat isn't memoized) — the
      // functions called above (loadBrief/loadQuickPrompts) are themselves stable,
      // so depending on `coach` here would re-run this effect every render instead
      // of only on focus.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setCoachActive]),
  );

  const hasActivePlan  = planData.plan?.status === 'active';
  const todaySession   = useMemo(() => getTodaySession(planData.sessions), [planData.sessions]);
  const insight        = useMemo(() => buildInsightMessage({
    todaySession,
    staleZones,
    playerName,
    paceWeeklyEarned,
    paceWeeklyCap,
  }), [todaySession, staleZones, playerName, paceWeeklyEarned, paceWeeklyCap]);

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
    if (!lastRun) return;
    const payload = await requestPostRunAnalysis(lastRun.id, session.access_token);
    if (payload) coach.showCard(payload);
  }, [coach]);

  const requestWeeklyReview = useCallback(() => {
    setChatVisible(true);
    if (coach.brief) coach.showCard(coach.brief);
  }, [coach]);

  const handleCapabilitySelect = useCallback((message: string) => {
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
  }, [openChatWithPrompt, coach, requestPostRunDebrief, requestWeeklyReview]);

  const handleGeneratePlan = useCallback(async () => {
    const ok = await coach.generatePlan();
    if (ok) {
      await planData.reload();
      setPlanFormVisible(false);
    }
  }, [coach, planData]);

  const scrollRef = useRef<ScrollView>(null);
  const chips: { label: string; message: string }[] = coach.quickPrompts.length > 0
    ? coach.quickPrompts.slice(0, 4)
    : [
        { label: 'Plan my week', message: 'Plan my week' },
        { label: 'Which zones are at risk?', message: 'Which of my zones are at risk this week?' },
        { label: 'Pace for my next run', message: 'What pace should my next run be?' },
      ];

  const briefText = coach.brief?.headline
    ?? (coach.briefLoading ? 'Reading your week…' : `${insight.headline} ${insight.body}`.trim());
  const todayIdx = (new Date().getDay() + 6) % 7; // Mon = 0

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header: back · PaceX · AI coach (mock s-coach) */}
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => navigation.navigate('Dashboard' as never)} hitSlop={8}
          accessibilityRole="button" accessibilityLabel="Back">
          <ArrowLeft size={16} color={C.t1} weight="regular" />
        </Pressable>
        <PaceXLogo size={22} />
        <View style={s.aiChip}><Text style={s.aiChipText}>AI coach</Text></View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.thread}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {/* Weekly brief */}
          <View style={s.brief}>
            <Text style={s.briefEyebrow}>
              Weekly brief{hasActivePlan ? ` · Week ${planData.plan!.weekCurrent} of ${planData.plan!.weeksTotal}` : ''}
            </Text>
            {planData.loading
              ? <ActivityIndicator color={C.alwaysLight} style={{ marginTop: 12 }} />
              : <Text style={s.briefText}>{briefText}</Text>}

            {hasActivePlan ? (
              <View style={s.week}>
                {DAY_ORDER.map((d, i) => {
                  const sess = planData.sessions.find(x => x.day === d);
                  const isToday = i === todayIdx;
                  const done = sess?.status === 'completed';
                  const label = !sess || sess.type === 'Rest' ? 'Rest' : SESSION_SHORT[sess.type] ?? sess.type;
                  const km = sess && sess.type !== 'Rest' ? (sess.description.match(/(\d+(?:\.\d+)?)\s*km/i)?.[1] ?? '') : '';
                  return (
                    <View key={d} style={[s.day, isToday && s.dayToday, !isToday && i < todayIdx && s.dayPast]}>
                      <Text style={[s.dayLetter, isToday && s.dayTextToday]}>{d[0]}</Text>
                      <Text style={[s.dayLabel, isToday && s.dayTextToday]} numberOfLines={1}>{label}</Text>
                      {km ? <Text style={[s.dayLabel, isToday && s.dayTextToday]}>{km}</Text> : null}
                      {done && <Check size={12} color={C.alwaysLight} weight="bold" style={{ marginTop: 2 }} />}
                    </View>
                  );
                })}
              </View>
            ) : !planData.loading && (
              <Pressable style={s.briefBtn} onPress={() => setPlanFormVisible(true)}>
                <Text style={s.briefBtnText}>Build a training plan</Text>
              </Pressable>
            )}
          </View>

          {autoCard && <PaceAutoCard message={autoCard} onReadMore={() => setChatVisible(true)} />}

          {/* Conversation */}
          {coach.messages.filter(m => !m.auto_triggered).map(m => {
            const isCard = !!m.type && m.type !== 'chat' && m.type !== 'text';
            if (isCard) {
              return (
                <View key={m.id} style={s.cardRow}>
                  <MessageBubble role={m.role} content={m.content} type={m.type} animate={coach.liveMessageIds.has(m.id)} />
                </View>
              );
            }
            return m.role === 'user' ? (
              <View key={m.id} style={s.userBubble}><Text style={s.userText}>{m.content}</Text></View>
            ) : (
              <View key={m.id} style={s.coachWrap}>
                <Text style={s.coachName}>PaceX</Text>
                <View style={s.coachBubble}><Text style={s.coachText}>{m.content}</Text></View>
              </View>
            );
          })}
          {coach.sending && <View style={s.coachWrap}><Text style={s.coachName}>PaceX</Text><TypingIndicator /></View>}
          {coach.error && (
            <Pressable onPress={coach.retryLastMessage} style={s.errorRow}>
              <Text style={s.errorText}>{coach.error} · Tap to retry</Text>
            </Pressable>
          )}
        </ScrollView>

        {/* Suggestions + input */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} style={s.chipsWrap}
          keyboardShouldPersistTaps="handled">
          {chips.map(c => (
            <Pressable key={c.label} style={s.chip} onPress={() => handleCapabilitySelect(c.message)}>
              <Text style={s.chipText}>{c.label}</Text>
            </Pressable>
          ))}
          <Pressable style={s.chip} onPress={() => setCapabilitiesVisible(true)}>
            <Text style={s.chipText}>More</Text>
          </Pressable>
        </ScrollView>
        <View style={s.inputBar}>
          <TextInput
            style={s.input}
            placeholder="Ask PaceX"
            placeholderTextColor={C.t3}
            value={coach.inputText}
            onChangeText={coach.setInputText}
            onSubmitEditing={() => coach.sendMessage()}
            returnKeyType="send"
            editable={!coach.sending}
          />
          <Pressable
            style={[s.send, (!coach.inputText.trim() || coach.sending) && { opacity: 0.5 }]}
            onPress={() => coach.sendMessage()}
            disabled={!coach.inputText.trim() || coach.sending}
            accessibilityRole="button"
            accessibilityLabel="Send"
          >
            <PaperPlaneTilt size={18} color={C.alwaysLight} weight="fill" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

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

      <Modal visible={planFormVisible} animationType="slide" onRequestClose={() => setPlanFormVisible(false)} presentationStyle="pageSheet">
        <SafeAreaView style={s.root}>
          <View style={s.header}>
            <Text style={s.sheetTitle}>Build a training plan</Text>
            <Pressable style={s.backBtn} onPress={() => setPlanFormVisible(false)} hitSlop={8}>
              <X size={16} color={C.t2} weight="bold" />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
            <CoachWelcome
              goalInput={coach.goalInput}
              onGoalChange={coach.setGoalInput}
              onGenerate={handleGeneratePlan}
              planLoading={coach.planLoading}
              onOpenChat={() => { setPlanFormVisible(false); setChatVisible(true); }}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SESSION_SHORT: Record<string, string> = {
  'Easy Run': 'Easy', 'Tempo': 'Tempo', 'Long Run': 'Long', 'Intervals': 'Intervals',
  'Cross-train': 'Cross', 'Race': 'Race', 'Defend': 'Defend',
};

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:         { flex: 1, backgroundColor: C.bg },
    header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.gutter, paddingVertical: 10 },
    backBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
    aiChip:       { paddingHorizontal: 10, height: 26, borderRadius: 8, backgroundColor: C.mid, justifyContent: 'center' },
    aiChipText:   { fontFamily: Fonts.semiBold, fontSize: 12, color: C.t1 },
    sheetTitle:   { fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1 },
    thread:       { paddingHorizontal: Spacing.gutter, paddingTop: 6, paddingBottom: 16, gap: 14 },
    brief:        { backgroundColor: C.alwaysDark, borderRadius: 18, padding: 16 },
    briefEyebrow: { fontFamily: Fonts.medium, fontSize: 13, color: '#FF9A7A' },
    briefText:    { fontFamily: Fonts.semiBold, fontSize: 17, lineHeight: 24, color: C.alwaysLight, marginTop: 8 },
    briefBtn:     { alignSelf: 'flex-start', marginTop: 14, height: 38, paddingHorizontal: 16, borderRadius: 999, backgroundColor: C.alwaysLight, justifyContent: 'center' },
    briefBtnText: { fontFamily: Fonts.semiBold, fontSize: 13, color: C.alwaysDark },
    week:         { flexDirection: 'row', gap: 6, marginTop: 14 },
    day:          { flex: 1, minHeight: 72, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', paddingTop: 8, paddingHorizontal: 2 },
    dayPast:      { backgroundColor: 'rgba(255,255,255,0.16)' },
    dayToday:     { backgroundColor: C.red },
    dayLetter:    { fontFamily: Fonts.medium, fontSize: 11, color: 'rgba(255,255,255,0.55)' },
    dayLabel:     { fontFamily: Fonts.semiBold, fontSize: 11, color: C.alwaysLight, marginTop: 4, textAlign: 'center' },
    dayTextToday: { color: C.alwaysLight },
    cardRow:      { alignSelf: 'stretch' },
    userBubble:   { alignSelf: 'flex-end', maxWidth: '80%', backgroundColor: C.alwaysDark, borderRadius: 18, borderBottomRightRadius: 6, paddingVertical: 12, paddingHorizontal: 14 },
    userText:     { fontFamily: Fonts.medium, fontSize: 15, lineHeight: 21, color: C.alwaysLight },
    coachWrap:    { alignSelf: 'flex-start', maxWidth: '85%' },
    coachName:    { fontFamily: Fonts.semiBold, fontSize: 12, color: C.t2, marginBottom: 6 },
    coachBubble:  { backgroundColor: C.card, borderRadius: 18, borderTopLeftRadius: 6, paddingVertical: 12, paddingHorizontal: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
    coachText:    { fontFamily: Fonts.regular, fontSize: 15, lineHeight: 22, color: C.t1 },
    errorRow:     { alignSelf: 'center', paddingVertical: 6 },
    errorText:    { fontFamily: Fonts.medium, fontSize: 13, color: C.red },
    chipsWrap:    { flexGrow: 0 },
    chips:        { paddingHorizontal: Spacing.gutter, gap: 8, paddingVertical: 8 },
    chip:         { height: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: C.card, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, justifyContent: 'center' },
    chipText:     { fontFamily: Fonts.semiBold, fontSize: 13, color: C.t1 },
    inputBar:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.gutter, paddingTop: 6, paddingBottom: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, backgroundColor: C.bg },
    input:        { flex: 1, height: 46, borderRadius: 999, backgroundColor: C.mid, paddingHorizontal: 18, fontFamily: Fonts.regular, fontSize: 15, color: C.t1 },
    send:         { width: 46, height: 46, borderRadius: 23, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' },
  });
}
