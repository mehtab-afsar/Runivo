import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, SafeAreaView, Platform, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Calendar, CheckCircle2, XCircle, Circle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, type AppColors } from '@theme';
import { usePlanScreen, type SessionWithStatus } from '../hooks/usePlanScreen';

const SESSION_TYPE_COLORS: Record<string, string> = {
  'Easy Run':    '#1A6B40',
  'Tempo':       '#9E6800',
  'Long Run':    '#1E4D8C',
  'Intervals':   '#6B2D8C',
  'Cross-train': '#5F5E5A',
  'Race':        '#D93518',
  'Rest':        '#AAAAAA',
};

function StatusIcon({ status, C }: { status: SessionWithStatus['status']; C: AppColors }) {
  if (status === 'completed') return <CheckCircle2 size={18} color={C.green} strokeWidth={1.8} />;
  if (status === 'missed')   return <XCircle      size={18} color={C.red}   strokeWidth={1.8} />;
  return <Circle size={18} color={C.t3} strokeWidth={1.5} />;
}

function SessionRow({ session, C, s }: {
  session: SessionWithStatus;
  C: AppColors;
  s: ReturnType<typeof mkStyles>;
}) {
  const typeColor = SESSION_TYPE_COLORS[session.type] ?? C.t2;
  const isToday   = session.sessionDate === new Date().toLocaleDateString('en-CA');

  return (
    <View style={[s.row, isToday && s.rowToday]}>
      <View style={s.dayCol}>
        <Text style={[s.day, isToday && s.dayToday]}>{session.day}</Text>
        {isToday && <View style={s.todayDot} />}
      </View>

      <View style={[s.typePill, { backgroundColor: `${typeColor}18` }]}>
        <Text style={[s.typeText, { color: typeColor }]}>{session.type}</Text>
      </View>

      <Text style={s.desc} numberOfLines={2}>{session.description}</Text>

      <StatusIcon status={session.status} C={C} />
    </View>
  );
}

export default function CoachPlanScreen() {
  const C        = useTheme();
  const s        = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation();
  const insets   = useSafeAreaInsets();
  const { plan, sessions, loading } = usePlanScreen();

  const completedCount = sessions.filter(s => s.status === 'completed').length;
  const activeCount    = sessions.filter(s => s.status !== 'completed' && s.type !== 'Rest').length;

  return (
    <SafeAreaView style={s.root}>
      {/* Header */}
      <View style={[s.header, { paddingTop: Platform.OS === 'android' ? 12 : 0 }]}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={8}>
          <ArrowLeft size={18} color={C.t2} strokeWidth={2} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Training Plan</Text>
          {plan && (
            <Text style={s.subtitle} numberOfLines={1}>{plan.goal}</Text>
          )}
        </View>
        {plan && (
          <View style={s.weekBadge}>
            <Text style={s.weekBadgeText}>Wk {plan.weekCurrent}/{plan.weeksTotal}</Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={C.red} />
        </View>
      ) : !plan ? (
        <View style={s.center}>
          <Calendar size={36} color={C.t3} strokeWidth={1.5} />
          <Text style={s.emptyTitle}>No active plan</Text>
          <Text style={s.emptyText}>
            Ask your AI Coach to build a personalised training plan and it will appear here.
          </Text>
        </View>
      ) : (
        <>
          {/* Week summary card */}
          <View style={s.summaryCard}>
            <View style={s.summaryRow}>
              <Text style={s.summaryWeek}>
                Week {plan.weekCurrent} · {plan.planData.weeks[plan.weekCurrent - 1]?.focus ?? ''}
              </Text>
            </View>
            <View style={s.summaryStats}>
              <View style={s.stat}>
                <Text style={s.statNum}>{completedCount}</Text>
                <Text style={s.statLabel}>Done</Text>
              </View>
              <View style={s.statDiv} />
              <View style={s.stat}>
                <Text style={s.statNum}>{activeCount}</Text>
                <Text style={s.statLabel}>Remaining</Text>
              </View>
              <View style={s.statDiv} />
              <View style={s.stat}>
                <Text style={s.statNum}>{sessions.filter(s => s.status === 'missed').length}</Text>
                <Text style={s.statLabel}>Missed</Text>
              </View>
            </View>
          </View>

          {/* Sessions list */}
          <FlatList
            data={sessions}
            keyExtractor={item => item.day}
            renderItem={({ item }) => <SessionRow session={item} C={C} s={s} />}
            contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={s.separator} />}
          />
        </>
      )}
    </SafeAreaView>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:        { flex: 1, backgroundColor: C.bg },
    header:      { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 18, paddingBottom: 12, backgroundColor: C.white, borderBottomWidth: 0.5, borderBottomColor: C.border },
    backBtn:     { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginRight: 4, marginTop: 2 },
    title:       { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 20, color: C.black },
    subtitle:    { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.t3, marginTop: 2 },
    weekBadge:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: C.redLo, borderWidth: 0.5, borderColor: 'rgba(217,53,24,0.2)', marginTop: 2 },
    weekBadgeText: { fontFamily: 'Barlow_600SemiBold', fontSize: 10, color: C.red },
    center:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
    emptyTitle:  { fontFamily: 'Barlow_500Medium', fontSize: 14, color: C.black },
    emptyText:   { fontFamily: 'Barlow_300Light', fontSize: 12, color: C.t3, textAlign: 'center', lineHeight: 20 },
    // Summary card
    summaryCard: { marginHorizontal: 18, marginTop: 16, marginBottom: 8, backgroundColor: C.white, borderRadius: 16, borderWidth: 0.5, borderColor: C.border, overflow: 'hidden' },
    summaryRow:  { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, borderBottomWidth: 0.5, borderBottomColor: C.mid },
    summaryWeek: { fontFamily: 'Barlow_500Medium', fontSize: 12, color: C.black },
    summaryStats:{ flexDirection: 'row', paddingVertical: 12 },
    stat:        { flex: 1, alignItems: 'center' },
    statNum:     { fontFamily: 'Barlow_600SemiBold', fontSize: 20, color: C.black },
    statLabel:   { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.t3, marginTop: 2 },
    statDiv:     { width: 0.5, backgroundColor: C.border },
    // Session rows
    row:         { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 14, backgroundColor: C.white },
    rowToday:    { backgroundColor: 'rgba(217,53,24,0.03)' },
    dayCol:      { width: 34, alignItems: 'center', gap: 3 },
    day:         { fontFamily: 'Barlow_500Medium', fontSize: 11, color: C.t3 },
    dayToday:    { color: C.red },
    todayDot:    { width: 4, height: 4, borderRadius: 2, backgroundColor: C.red },
    typePill:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, flexShrink: 0 },
    typeText:    { fontFamily: 'Barlow_500Medium', fontSize: 9, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
    desc:        { flex: 1, fontFamily: 'Barlow_300Light', fontSize: 12, color: C.black, lineHeight: 18 },
    separator:   { height: 0.5, backgroundColor: C.mid, marginLeft: 18 },
  });
}
