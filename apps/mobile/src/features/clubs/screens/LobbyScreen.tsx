import React from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, SafeAreaView, Platform, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useLobby } from '@features/clubs/hooks/useLobby';
import { LobbyCard } from '@features/clubs/components/LobbyCard';
import type { LobbyRoomDisplay } from '@features/clubs/components/LobbyCard';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const C = { bg: '#EDEAE5', black: '#0A0A0A', t2: '#6B6B6B', t3: '#ADADAD', red: '#D93518', redLo: '#FEF0EE' };

const LOBBY_ROOMS: LobbyRoomDisplay[] = [
  { id: 'global',   name: 'Global Runners',   description: 'Connect with runners worldwide',      emoji: '🌍', color: '#1E4D8C' },
  { id: 'training', name: 'Training Talk',     description: 'Plans, tips, and workout advice',     emoji: '🏃', color: '#1A6B40' },
  { id: 'races',    name: 'Race Reports',      description: 'Share your race results and stories', emoji: '🏆', color: '#9E6800' },
  { id: 'speed',    name: 'Speed & Intervals', description: 'Track work, tempo runs, PRs',         emoji: '⚡', color: '#D93518' },
  { id: 'night',    name: 'Night Runners',     description: 'For those who run after dark',        emoji: '🌙', color: '#6B2D8C' },
];

const Banner = () => (
  <View style={s.banner}>
    <Text style={{ fontSize: 18 }}>💬</Text>
    <View style={{ flex: 1 }}>
      <Text style={s.bannerTitle}>Be respectful</Text>
      <Text style={s.bannerText}>Keep conversations positive. Toxic behaviour will result in a ban.</Text>
    </View>
  </View>
);

export default function LobbyScreen() {
  const navigation = useNavigation<Nav>();
  const { rooms, loading } = useLobby();
  const activityById = Object.fromEntries(rooms.map(r => [r.id, r.messagesToday]));

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
          data={LOBBY_ROOMS} keyExtractor={r => r.id}
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

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 12 },
  back: { width: 32 }, backText: { fontFamily: 'Barlow_400Regular', fontSize: 18, color: C.t2 },
  title: { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 20, color: C.black },
  subtitle: { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t3, marginTop: 1 },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100, gap: 10 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  banner: { backgroundColor: C.redLo, borderRadius: 14, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 8 },
  bannerTitle: { fontFamily: 'Barlow_600SemiBold', fontSize: 13, color: C.red, marginBottom: 2 },
  bannerText: { fontFamily: 'Barlow_300Light', fontSize: 12, color: C.t2 },
});
