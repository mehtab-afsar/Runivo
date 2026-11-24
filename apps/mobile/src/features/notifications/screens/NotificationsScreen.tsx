import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, SectionList, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ErrorState } from '@mobile/shared/components/ErrorState';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { Bell } from 'phosphor-react-native';
import { useNotifications } from '../hooks/useNotifications';
import { NotifItem, type NotifAction } from '../components/NotifItem';
import { routeNotificationUrl } from '../services/notificationHandler';
import type { AppNotification } from '../types';
import { supabase } from '@shared/services/supabase';
import { fetchFollowingIds, setFollow } from '@features/social/services/feedService';
import { useTheme, Fonts, type AppColors } from '@theme';
import { ScreenHeader } from '@mobile/shared/components/ScreenHeader';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** The follower's id from a follow notification ('/profile/<uuid>'). */
function followerIdOf(n: AppNotification): string | null {
  const m = n.action_url?.match(/^\/profile\/([0-9a-f-]{36})/i);
  return m ? m[1] : null;
}

export default function NotificationsScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const { notifs, loading, error, refreshing, unreadCount, markRead, markAllRead, refresh } = useNotifications();
  const [following, setFollowing] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) fetchFollowingIds(data.user.id).then(ids => setFollowing(new Set(ids))).catch(() => {});
    });
  }, []);

  const goRun = useCallback(() => navigation.navigate('Main', { screen: 'Run' }), [navigation]);

  /** Follow back, Defend or Take back — only where the type supports one. */
  const actionFor = useCallback((n: AppNotification): NotifAction | undefined => {
    if (n.type === 'follow') {
      const id = followerIdOf(n);
      // A follow request is answered on their profile (tapping the row opens it).
      if (!id || following.has(id) || / asked to follow you$/.test(n.title)) return undefined;
      return {
        label: 'Follow',
        onPress: () => {
          setFollowing(prev => new Set(prev).add(id));
          setFollow(id, true).catch(() => setFollowing(prev => { const x = new Set(prev); x.delete(id); return x; }));
        },
      };
    }
    if (n.type === 'zone_attacked' || n.type === 'territory_lost') return { label: 'Take back', onPress: () => { markRead(n.id); goRun(); } };
    if (n.type === 'zone_fading') return { label: 'Defend', onPress: () => { markRead(n.id); goRun(); } };
    return undefined;
  }, [following, goRun, markRead]);

  // Today and Earlier, as on the mock.
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const today = notifs.filter(n => new Date(n.created_at) >= startOfDay);
  const earlier = notifs.filter(n => new Date(n.created_at) < startOfDay);
  const sections = [
    ...(today.length ? [{ title: 'Today', data: today }] : []),
    ...(earlier.length ? [{ title: 'Earlier', data: earlier }] : []),
  ];

  return (
    <SafeAreaView style={s.root}>
      <ScreenHeader title="Notifications" onBack={() => navigation.goBack()} right={<>
          {unreadCount > 0 ? (
            <Pressable onPress={markAllRead} hitSlop={8} style={s.markAll} accessibilityRole="button">
              <Text style={s.markAllText}>Read all</Text>
            </Pressable>
          ) : <View style={{ width: 44 }} />}
        </>} />

      <SectionList
        sections={sections}
        keyExtractor={n => n.id}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => <Text style={s.section}>{section.title}</Text>}
        renderItem={({ item, index, section }) => (
          <NotifItem
            notif={item}
            position={section.data.length === 1 ? 'only' : index === 0 ? 'first' : index === section.data.length - 1 ? 'last' : 'middle'}
            action={actionFor(item)}
            onPress={() => {
              markRead(item.id);
              routeNotificationUrl(item.action_url, navigation);
            }}
          />
        )}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.red} />}
        ListEmptyComponent={
          loading ? <ActivityIndicator style={{ marginTop: 64 }} color={C.t2} accessibilityLabel="Loading activity" />
          : error ? <ErrorState title="Couldn't load your activity" onRetry={refresh} />
          : <View style={s.empty}>
            <View style={s.emptyIcon}><Bell size={28} color={C.t1} weight="regular" /></View>
            <Text style={s.emptyTitle}>Nothing yet</Text>
            <Text style={s.emptyText}>Zone steals, kudos, follows and rank ups will show up here.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function mkStyles(C: AppColors) { return StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.card },
  markAll:     { backgroundColor: C.bg, borderRadius: 20, paddingHorizontal: 14, height: 40, justifyContent: 'center' },
  section:     { fontFamily: Fonts.medium, fontSize: 14, color: C.t2, paddingTop: 12, paddingBottom: 10, paddingHorizontal: 2 },
  markAllText: { fontFamily: Fonts.regular, fontSize: 14, color: C.t1 },
  list:        { paddingHorizontal: 20, paddingBottom: 100 },
  empty:       { alignItems: 'center' as const, paddingVertical: 64 },
  emptyIcon:   { width: 64, height: 64, borderRadius: 32, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle:  { fontFamily: Fonts.bold, fontSize: 18, color: C.t1, marginBottom: 6 },
  emptyText:   { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, textAlign: 'center', paddingHorizontal: 32, lineHeight: 19 },
}); }
