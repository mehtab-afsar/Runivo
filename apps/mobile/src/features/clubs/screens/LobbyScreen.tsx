import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, SafeAreaView, Platform, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { ChatCircle } from 'phosphor-react-native';
import { useLobby } from '@features/clubs/hooks/useLobby';
import { LobbyCard } from '@features/clubs/components/LobbyCard';
import type { LobbyRoomDisplay } from '@features/clubs/components/LobbyCard';
import { useTheme, Fonts, Spacing, type AppColors } from '@theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function mkLobbyRooms(C: AppColors): LobbyRoomDisplay[] {
  return [
    { id: 'global',   name: 'Global Runners',   description: 'Connect with runners worldwide',      emoji: '🌍', color: C.blue },
    { id: 'training', name: 'Training Talk',     description: 'Plans, tips, and workout advice',     emoji: '🏃', color: C.green },
    { id: 'races',    name: 'Race Reports',      description: 'Share your race results and stories', emoji: '🏆', color: C.amber },
    { id: 'speed',    name: 'Speed & Intervals', description: 'Track work, tempo runs, PRs',         emoji: '⚡', color: C.red },
    { id: 'night',    name: 'Night Runners',     description: 'For those who run after dark',        emoji: '🌙', color: C.purple },
  ];
}

const Banner = () => {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  return (
  <View style={s.banner}>
    <ChatCircle size={18} color={C.red} weight="light" />
    <View style={{ flex: 1 }}>
      <Text style={s.bannerTitle}>Be respectful</Text>
      <Text style={s.bannerText}>Keep conversations positive. Toxic behaviour will result in a ban.</Text>
    </View>
  </View>
  );
};

export default function LobbyScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const { rooms, loading } = useLobby();
  const activityById = Object.fromEntries(rooms.map(r => [r.id, r.messagesToday]));
  const lobbyRooms = useMemo(() => mkLobbyRooms(C), [C]);

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.back}><Text style={s.backText}>←</Text></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Community</Text>
          <Text style={s.subtitle}>Chat with runners worldwide</Text>
        </View>
      </View>

      {loading ? (
        <View style={s.loader}><ActivityIndicator color={C.red} /></View>
      ) : (
        <FlatList
          data={lobbyRooms} keyExtractor={r => r.id}
          renderItem={({ item }) => (
            <LobbyCard
              room={{ ...item, messagesToday: activityById[item.id] ?? 0 }}
              onPress={() => navigation.navigate('LobbyChat', { lobbyId: item.id })}
            />
          )}
          contentContainerStyle={s.list} showsVerticalScrollIndicator={false}
          ListFooterComponent={<Banner />}
        />
      )}
    </SafeAreaView>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 12 },
    back: { width: 32 }, backText: { fontFamily: Fonts.regular, fontSize: 18, color: C.t2 },
    title: { fontFamily: Fonts.display, fontSize: 20, color: C.black },
    subtitle: { fontFamily: Fonts.regular, fontSize: 11, color: C.t3, marginTop: 1 },
    list: { paddingHorizontal: Spacing.gutter, paddingTop: 8, paddingBottom: 100, gap: 10 },
    loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    banner: { backgroundColor: C.redLo, borderRadius: 14, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 8 },
    bannerTitle: { fontFamily: Fonts.semiBold, fontSize: 13, color: C.red, marginBottom: 2 },
    bannerText: { fontFamily: Fonts.regular, fontSize: 12, color: C.t2 },
  });
}
