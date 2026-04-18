import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, SafeAreaView, Platform, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useNotifications } from '../hooks/useNotifications';
import { NotifItem } from '../components/NotifItem';
import { useTheme, type AppColors } from '@theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function NotificationsScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const { notifs, refreshing, unreadCount, markRead, markAllRead, refresh } = useNotifications();

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </Pressable>
        <Text style={s.title}>
          Notifications{unreadCount > 0 ? ` (${unreadCount})` : ''}
        </Text>
        {unreadCount > 0 ? (
          <Pressable onPress={markAllRead}>
            <Text style={s.markAll}>Mark all read</Text>
          </Pressable>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      <FlatList
        data={notifs}
        keyExtractor={n => n.id}
        renderItem={({ item }) => <NotifItem notif={item} onPress={() => markRead(item.id)} />}
        ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.red} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyTitle}>You're all caught up</Text>
            <Text style={s.emptyText}>No notifications yet. Start running to get activity here.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function mkStyles(C: AppColors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 12 },
  backBtn: { width: 40 },
  backText: { fontFamily: 'Barlow_400Regular', fontSize: 18, color: C.t2 },
  title: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 18, color: C.black },
  markAll: { fontFamily: 'Barlow_400Regular', fontSize: 11, color: C.red, textAlign: 'right' },
  list: { paddingHorizontal: 16, paddingBottom: 100, gap: 6 },
  empty: { alignItems: 'center' as const, paddingVertical: 48 },
  emptyTitle: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 18, color: C.black, marginBottom: 6 },
  emptyText: { fontFamily: 'Barlow_300Light', fontSize: 12, color: C.t2, textAlign: 'center', paddingHorizontal: 24 },
}); }
