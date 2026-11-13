import React, { useRef, useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useTheme, Fonts, type AppColors } from '@theme';
import { Globe, Pulse, Trophy, Moon, ArrowLeft, UsersThree, type Icon } from 'phosphor-react-native';
import { useLobbyChat } from '@features/clubs/hooks/useLobbyChat';
import { ChatBubble } from '@features/clubs/components/ChatBubble';
import { ChatInput } from '@features/clubs/components/ChatInput';
import { supabase } from '@shared/services/supabase';
import { reportUser, blockUser, type ReportReason } from '@features/social/services/safetyService';
import type { LobbyMessage } from '@features/clubs/services/lobbyChatService';

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'LobbyChat'>;

// Fixed ids matching the seeded public rooms (supabase/migrations/
// 20260710000109_lobby_public_rooms.sql) — these are real lobbies.id UUIDs, not
// arbitrary client strings, so fetch/send/subscribe all target real rows.
// Exported so anything else linking into a specific room (e.g. the Dashboard's
// CommunityPulseCard) reuses these ids instead of re-typing UUIDs by hand.
export type LobbyRoomEntry = { id: string; name: string; description: string; Icon: Icon; iconColor: string; color: string };
export function mkLobbyRooms(C: AppColors): LobbyRoomEntry[] {
  return [
    { id: '00000000-0000-0000-0000-000000000001', name: 'Global Runners',    description: 'Connect with runners worldwide',      Icon: Globe,  iconColor: C.blue,   color: C.blue },
    { id: '00000000-0000-0000-0000-000000000002', name: 'Training Talk',     description: 'Plans, tips, and workout advice',     Icon: Pulse,  iconColor: C.green,  color: C.green },
    { id: '00000000-0000-0000-0000-000000000003', name: 'Race Reports',      description: 'Share your race results and stories', Icon: Trophy, iconColor: C.amber,  color: C.amber },
    { id: '00000000-0000-0000-0000-000000000004', name: 'Speed & Intervals', description: 'Track work, tempo runs, PRs',         Icon: Pulse,  iconColor: C.red,    color: C.red },
    { id: '00000000-0000-0000-0000-000000000005', name: 'Night Runners',     description: 'For those who run after dark',        Icon: Moon,   iconColor: C.purple, color: C.purple },
  ];
}

export default function LobbyChatScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const { lobbyId } = useRoute<Route>().params;
  const lobbyRooms = useMemo(() => mkLobbyRooms(C), [C]);
  const room = lobbyRooms.find(r => r.id === lobbyId) ?? lobbyRooms[0];
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);
  const { messages, loading, error, inputText, setInputText, sending, sendMessage, removeMessagesFrom } = useLobbyChat(room.id);

  useEffect(() => { supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id ?? null)); }, []);
  useEffect(() => { if (messages.length > 0) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100); }, [messages.length]);


  // Public rooms have no admins: report the sender (with the message) or block them.
  const messageOptions = (m: LobbyMessage) => {
    const report = (reason: ReportReason) =>
      reportUser(m.userId, reason, `Chat message in ${room.name}: ${m.message}`.slice(0, 1000))
        .then(() => Alert.alert('Thanks for reporting', 'Our team will review it.'))
        .catch(() => Alert.alert("Couldn't report", 'Try again later.'));
    Alert.alert(m.userName, undefined, [
      { text: 'Report as spam', onPress: () => report('spam') },
      { text: 'Report harassment', onPress: () => report('harassment') },
      {
        text: `Block ${m.userName}`, style: 'destructive', onPress: () =>
          blockUser(m.userId).then(() => removeMessagesFrom(m.userId)).catch(() => Alert.alert("Couldn't block", 'Try again later.')),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.back} accessibilityLabel="Back">
          <ArrowLeft size={16} color={C.t1} weight="regular" />
        </Pressable>
        <View style={s.roomIcon}><UsersThree size={20} color={C.t1} weight="regular" /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.roomName}>{room.name}</Text>
          <Text style={s.roomDesc}>Open room · every runner</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        {loading ? (
          <View style={s.loader}><ActivityIndicator color={C.t3} /></View>
        ) : error ? (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>Couldn't load chat</Text>
            <Text style={s.emptyText}>{error}</Text>
          </View>
        ) : messages.length === 0 ? (
          <View style={s.empty}><Text style={s.emptyTitle}>No messages yet</Text><Text style={s.emptyText}>Say hi to runners everywhere.</Text></View>
        ) : (
          <FlatList
            ref={listRef} data={messages} keyExtractor={m => m.id}
            renderItem={({ item }) => (
              <ChatBubble message={item} isOwn={item.userId === currentUserId} onLongPress={item.userId === currentUserId ? undefined : () => messageOptions(item)} />
            )}
            contentContainerStyle={{ paddingVertical: 12 }} showsVerticalScrollIndicator={false}
          />
        )}
        <ChatInput value={inputText} onChange={setInputText} onSend={sendMessage} sending={sending} placeholder={`Message ${room.name}`} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    header:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingTop: Platform.OS === 'android' ? 12 : 4, paddingBottom: 12, backgroundColor: C.bg },
    back:         { width: 36, height: 36, borderRadius: 18, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
    roomIcon:     { width: 38, height: 38, borderRadius: 10, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    roomName:     { fontFamily: Fonts.semiBold, fontSize: 17, color: C.t1, letterSpacing: -0.2 },
    roomDesc:     { fontFamily: Fonts.regular, fontSize: 12.5, color: C.t2, marginTop: 1 },
    loader:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
    empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
    emptyTitle:   { fontFamily: Fonts.semiBold, fontSize: 16, color: C.t1 },
    emptyText:    { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, textAlign: 'center' },
  });
}
