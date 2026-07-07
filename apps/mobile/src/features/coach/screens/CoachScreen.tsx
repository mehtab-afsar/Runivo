import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  SafeAreaView, ActivityIndicator, Platform,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { X } from 'phosphor-react-native';
import { supabase } from '@shared/services/supabase';
import { getTerritoryPolygons } from '@shared/services/store';
import { GAME_CONFIG } from '@shared/services/config';
import type { TerritoryPolygon } from '@shared/types/game';
import { useTheme, Type, Fonts, Spacing, type AppColors } from '@theme';
import { useCoachNav } from '@navigation/CoachNavContext';
import { useCoachChat } from '../hooks/useCoachChat';
import { usePlanScreen } from '../hooks/usePlanScreen';
import { getQuickPrompts } from '../services/coachService';
import { CoachWelcome } from '../components/CoachWelcome';
import { CoachSidebar } from '../components/CoachSidebar';
import { PaceInsightCard } from '../components/PaceInsightCard';
import { PaceAutoCard } from '../components/PaceAutoCard';
import { PaceChatModal } from '../components/PaceChatModal';
import { WeekGrid } from '../components/WeekGrid';
import { computeConsistencyScore } from '../utils/consistencyScore';
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

const QUICK_ACTIONS = [
  { label: '💬 Ask Pace',    territory: false, prompt: '' },
  { label: '🗺 Territory',    territory: false, prompt: 'Plan my territory strategy for this week' },
  { label: '📊 My Week',     territory: false, prompt: 'Give me my weekly review' },
];

export default function CoachScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const { setCoachActive } = useCoachNav();

  const coach    = useCoachChat();
  const planData = usePlanScreen();

  const [chatVisible,         setChatVisible]         = useState(false);
  const [capabilitiesVisible, setCapabilitiesVisible] = useState(false);
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

        getQuickPrompts(session.access_token).catch(() => {});

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
            setPaceWeeklyCap(
              data.subscription_tier === 'premium'
                ? GAME_CONFIG.PACE_WEEKLY_CAP_PREMIUM
                : GAME_CONFIG.PACE_WEEKLY_CAP_FREE,
            );
          } catch { /* offline */ }
        };
        fetchProfile();

        getTerritoryPolygons(uid).then(all => setStaleZones(getStaleZones(all, uid)));
      }).catch(() => {});

      return () => setCoachActive(false);
    }, [setCoachActive]),
  );

  const hasActivePlan  = planData.plan?.status === 'active';
  const todaySession   = useMemo(() => getTodaySession(planData.sessions), [planData.sessions]);
  const consistency    = useMemo(() => computeConsistencyScore(planData.sessions), [planData.sessions]);
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
    openChatWithPrompt(message);
  }, [openChatWithPrompt, coach]);

  return (
    <SafeAreaView style={s.root}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: C.border }]}>
        <PaceXLogo size={22} />
        <Pressable
          style={[s.closeBtn, { backgroundColor: C.stone, borderColor: C.border }]}
          onPress={() => navigation.navigate('Dashboard' as never)}
          hitSlop={8}
        >
          <X size={16} color={C.t2} weight="light" />
        </Pressable>
      </View>

      {planData.loading ? (
        <View style={s.loader}>
          <ActivityIndicator color={C.red} />
        </View>
      ) : !hasActivePlan ? (
        /* ── State A: no active plan ─────────────────────────────── */
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>
          <CoachWelcome
            goalInput={coach.goalInput}
            onGoalChange={coach.setGoalInput}
            onGenerate={coach.generatePlan}
            planLoading={coach.planLoading}
            onOpenChat={() => setChatVisible(true)}
          />
        </ScrollView>
      ) : (
        /* ── State B: active plan ────────────────────────────────── */
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>

          {/* Daily insight card */}
          <PaceInsightCard
            headline={insight.headline}
            body={insight.body}
            consistencyScore={consistency.score}
            paceWeeklyEarned={paceWeeklyEarned}
            paceWeeklyCap={paceWeeklyCap}
          />

          {/* Week section */}
          <View style={s.weekSection}>
            <Text style={[s.sectionLabel, { color: C.t3 }]}>
              THIS WEEK · Week {planData.plan!.weekCurrent} of {planData.plan!.weeksTotal}
            </Text>
            <WeekGrid sessions={planData.sessions} compact />
          </View>

          {/* CTA row */}
          <View style={s.ctaRow}>
            <Pressable
              style={[s.ctaBtn, s.ctaBtnPrimary, { backgroundColor: C.alwaysDark }]}
              onPress={() => navigation.navigate('Run' as never)}
            >
              <Text style={s.ctaBtnPrimaryLabel}>Start today's run →</Text>
            </Pressable>
            <Pressable
              style={[s.ctaBtn, s.ctaBtnSecondary, { borderColor: C.border, backgroundColor: C.surface }]}
              onPress={() => navigation.navigate('CoachPlan' as never)}
            >
              <Text style={[s.ctaBtnSecondaryLabel, { color: C.black }]}>View full plan</Text>
            </Pressable>
          </View>

          {/* Quick action pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.pillsScroll}
            style={s.pillsWrap}
          >
            {QUICK_ACTIONS.map(a => (
              <Pressable
                key={a.label}
                style={({ pressed }) => [s.pill, { borderColor: C.border, backgroundColor: pressed ? C.mid : C.surface }]}
                onPress={() => openChatWithPrompt(a.prompt)}
              >
                <Text style={[s.pillLabel, { color: C.black }]}>{a.label}</Text>
              </Pressable>
            ))}
            <Pressable
              style={({ pressed }) => [s.pill, { borderColor: C.border, backgroundColor: pressed ? C.mid : C.surface }]}
              onPress={() => setCapabilitiesVisible(true)}
            >
              <Text style={[s.pillLabel, { color: C.black }]}>➕ More</Text>
            </Pressable>
          </ScrollView>

          {/* Auto-triggered card */}
          {autoCard && (
            <PaceAutoCard
              message={autoCard}
              onReadMore={() => setChatVisible(true)}
            />
          )}
        </ScrollView>
      )}

      {/* Chat modal */}
      <PaceChatModal
        visible={chatVisible}
        onClose={() => setChatVisible(false)}
        messages={coach.messages}
        sending={coach.sending}
        error={coach.error}
        inputText={coach.inputText}
        setInputText={coach.setInputText}
        onSend={coach.sendMessage}
        onRetry={coach.retryLastMessage}
        onOpenCapabilities={() => { setChatVisible(false); setCapabilitiesVisible(true); }}
      />

      {/* Capabilities sheet */}
      <CoachSidebar
        visible={capabilitiesVisible}
        onClose={() => setCapabilitiesVisible(false)}
        onSelectCapability={handleCapabilitySelect}
      />
    </SafeAreaView>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:                { flex: 1, backgroundColor: C.bg },
    header:              { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5 },
    closeBtn:            { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 0.5 },
    loader:              { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scrollContent:       { paddingBottom: 120 },
    weekSection:         { paddingHorizontal: Spacing.gutter, marginBottom: 14 },
    sectionLabel:        { ...Type.overline, letterSpacing: 1.6, marginBottom: 10 },
    ctaRow:              { flexDirection: 'row', gap: 10, paddingHorizontal: Spacing.gutter, marginBottom: 16 },
    ctaBtn:              { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
    ctaBtnPrimary:       {},
    ctaBtnPrimaryLabel:  { fontFamily: Fonts.semiBold, fontSize: 13, color: C.alwaysLight },
    ctaBtnSecondary:     { borderWidth: 0.5 },
    ctaBtnSecondaryLabel:{ fontFamily: Fonts.medium, fontSize: 13 },
    pillsWrap:           { marginBottom: 16 },
    pillsScroll:         { paddingHorizontal: Spacing.gutter, gap: 8 },
    pill:                { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 0.5 },
    pillLabel:           { fontFamily: Fonts.regular, fontSize: 13 },
  });
}
