import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, Modal } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { Colors } from '@theme';
import { Heart, Flame, Dumbbell, ThumbsUp, Smile, Laugh, Globe, Activity, Trophy, Moon } from 'lucide-react-native';
import { useLobbyChat } from '@features/clubs/hooks/useLobbyChat';
import { ChatBubble } from '@features/clubs/components/ChatBubble';
import { ChatInput } from '@features/clubs/components/ChatInput';
import { reactToMessage } from '@features/clubs/services/lobbyChatService';
import { supabase } from '@shared/services/supabase';

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'LobbyChat'>;
const C = Colors;

type ReactionEntry = { id: string; Icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>; color: string; emoji: string };
const REACTION_ENTRIES: ReactionEntry[] = [
  { id: 'heart',    Icon: Heart,    color: '#EF4444', emoji: '❤️' },
  { id: 'flame',    Icon: Flame,    color: '#EA580C', emoji: '🔥' },
  { id: 'dumbbell', Icon: Dumbbell, color: '#7C3AED', emoji: '💪' },
  { id: 'thumbsup', Icon: ThumbsUp, color: '#2563EB', emoji: '👏' },
  { id: 'smile',    Icon: Smile,    color: '#D97706', emoji: '🤣' },
  { id: 'laugh',    Icon: Laugh,    color: '#059669', emoji: '😮' },
];

type LobbyRoomEntry = { id: string; name: string; description: string; Icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>; iconColor: string; color: string };
const LOBBY_ROOMS: LobbyRoomEntry[] = [
  { id: 'global',   name: 'Global Runners',   description: 'Connect with runners worldwide',      Icon: Globe,    iconColor: '#1E4D8C', color: '#1E4D8C' },
  { id: 'training', name: 'Training Talk',     description: 'Plans, tips, and workout advice',     Icon: Activity, iconColor: '#1A6B40', color: '#1A6B40' },
  { id: 'races',    name: 'Race Reports',      description: 'Share your race results and stories', Icon: Trophy,   iconColor: '#9E6800', color: '#9E6800' },
  { id: 'speed',    name: 'Speed & Intervals', description: 'Track work, tempo runs, PRs',         Icon: Activity, iconColor: '#D93518', color: '#D93518' },
  { id: 'night',    name: 'Night Runners',     description: 'For those who run after dark',        Icon: Moon,     iconColor: '#6B2D8C', color: '#6B2D8C' },
];

export default function LobbyChatScreen() {
  const navigation = useNavigation<Nav>();
  const { lobbyId } = useRoute<Route>().params;
  const room = LOBBY_ROOMS.find(r => r.id === lobbyId) ?? LOBBY_ROOMS[0];
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [reactingMsgId, setReactingMsgId] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);
  const { messages, loading, error, inputText, setInputText, sending, sendMessage } = useLobbyChat(lobbyId);

  useEffect(() => { supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id ?? null)); }, []);
  useEffect(() => { if (messages.length > 0) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100); }, [messages.length]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.back}><Text style={s.backText}>←</Text></Pressable>
        <View style={[s.roomIcon, { backgroundColor: room.color + '18' }]}>
          <room.Icon size={18} color={room.iconColor} strokeWidth={1.5} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.roomName}>{room.name}</Text>
          <Text style={s.roomDesc}>{room.description}</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        {loading ? (
          <View style={s.loader}><ActivityIndicator color={C.t3} /></View>
        ) : error ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 40 }}>⚠️</Text>
            <Text style={s.emptyTitle}>Couldn't load chat</Text>
            <Text style={s.emptyText}>{error}</Text>
          </View>
        ) : messages.length === 0 ? (
          <View style={s.empty}><room.Icon size={40} color={room.iconColor} strokeWidth={1.5} /><Text style={s.emptyTitle}>No messages yet</Text><Text style={s.emptyText}>Be the first to start the conversation!</Text></View>
        ) : (
          <FlatList
            ref={listRef} data={messages} keyExtractor={m => m.id}
            renderItem={({ item }) => (
              <ChatBubble
                message={item}
                isOwn={item.userId === currentUserId}
                onLongPress={() => setReactingMsgId(item.id)}
              />
            )}
            contentContainerStyle={{ paddingVertical: 12 }} showsVerticalScrollIndicator={false}
          />
        )}
        <ChatInput value={inputText} onChange={setInputText} onSend={sendMessage} sending={sending} />
      </KeyboardAvoidingView>
      <Modal visible={!!reactingMsgId} transparent animationType="fade" onRequestClose={() => setReactingMsgId(null)}>
        <Pressable style={s.overlay} onPress={() => setReactingMsgId(null)}>
          <View style={s.picker}>
            <Text style={s.pickerLabel}>React</Text>
            <View style={s.emojiRow}>
              {REACTION_ENTRIES.map(entry => (
                <Pressable
                  key={entry.id}
                  style={s.emojiBtn}
                  onPress={async () => {
                    if (reactingMsgId && currentUserId) {
                      await reactToMessage(reactingMsgId, entry.emoji, currentUserId);
                    }
                    setReactingMsgId(null);
                  }}
                >
                  <entry.Icon size={22} color={entry.color} strokeWidth={1.5} />
                </Pressable>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 10, borderBottomWidth: 0.5, borderBottomColor: C.border, backgroundColor: C.bg },
  back:         { width: 32 }, backText: { fontFamily: 'Barlow_400Regular', fontSize: 18, color: C.t2 },
  roomIcon:     { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  roomName:     { fontFamily: 'Barlow_600SemiBold', fontSize: 14, color: C.black },
  roomDesc:     { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t3 },
  loader:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  emptyTitle:   { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 18, color: C.black },
  emptyText:    { fontFamily: 'Barlow_300Light', fontSize: 12, color: C.t2, textAlign: 'center' },
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  picker:       { backgroundColor: C.white, borderRadius: 20, padding: 20, alignItems: 'center', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 10 },
  pickerLabel:  { fontFamily: 'Barlow_600SemiBold', fontSize: 12, color: C.t2, letterSpacing: 0.4 },
  emojiRow:     { flexDirection: 'row', gap: 8 },
  emojiBtn:     { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F0EDE8', alignItems: 'center', justifyContent: 'center' },
  emoji:        { fontSize: 22 },
});
