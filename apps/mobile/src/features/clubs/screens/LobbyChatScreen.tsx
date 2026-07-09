import React, { useRef, useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, Modal } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useTheme, Fonts, type AppColors } from '@theme';
import { Heart, Fire, Barbell, ThumbsUp, Smiley, SmileyXEyes, Globe, Pulse, Trophy, Moon, type Icon } from 'phosphor-react-native';
import { useLobbyChat } from '@features/clubs/hooks/useLobbyChat';
import { ChatBubble } from '@features/clubs/components/ChatBubble';
import { ChatInput } from '@features/clubs/components/ChatInput';
import { reactToMessage } from '@features/clubs/services/lobbyChatService';
import { supabase } from '@shared/services/supabase';

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'LobbyChat'>;

type ReactionEntry = { id: string; Icon: Icon; color: string; emoji: string };
function mkReactionEntries(C: AppColors): ReactionEntry[] {
  return [
    { id: 'heart',    Icon: Heart,    color: '#EF4444', emoji: '❤️' },
    { id: 'flame',    Icon: Fire,     color: '#EA580C', emoji: '🔥' },
    { id: 'dumbbell', Icon: Barbell,  color: C.purple, emoji: '💪' },
    { id: 'thumbsup', Icon: ThumbsUp, color: C.blue, emoji: '👏' },
    { id: 'smile',    Icon: Smiley,   color: C.gold, emoji: '🤣' },
    { id: 'laugh',    Icon: SmileyXEyes, color: '#059669', emoji: '😮' },
  ];
}

type LobbyRoomEntry = { id: string; name: string; description: string; Icon: Icon; iconColor: string; color: string };
function mkLobbyRooms(C: AppColors): LobbyRoomEntry[] {
  return [
    { id: 'global',   name: 'Global Runners',   description: 'Connect with runners worldwide',      Icon: Globe,    iconColor: C.blue, color: C.blue },
    { id: 'training', name: 'Training Talk',     description: 'Plans, tips, and workout advice',     Icon: Pulse,    iconColor: C.green, color: C.green },
    { id: 'races',    name: 'Race Reports',      description: 'Share your race results and stories', Icon: Trophy,   iconColor: C.amber, color: C.amber },
    { id: 'speed',    name: 'Speed & Intervals', description: 'Track work, tempo runs, PRs',         Icon: Pulse,    iconColor: C.red, color: C.red },
    { id: 'night',    name: 'Night Runners',     description: 'For those who run after dark',        Icon: Moon,     iconColor: C.purple, color: C.purple },
  ];
}

export default function LobbyChatScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const { lobbyId } = useRoute<Route>().params;
  const lobbyRooms = useMemo(() => mkLobbyRooms(C), [C]);
  const reactionEntries = useMemo(() => mkReactionEntries(C), [C]);
  const room = lobbyRooms.find(r => r.id === lobbyId) ?? lobbyRooms[0];
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
          <room.Icon size={18} color={room.iconColor} weight="light" />
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
          <View style={s.empty}><room.Icon size={40} color={room.iconColor} weight="light" /><Text style={s.emptyTitle}>No messages yet</Text><Text style={s.emptyText}>Be the first to start the conversation!</Text></View>
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
              {reactionEntries.map(entry => (
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
                  <entry.Icon size={22} color={entry.color} weight="light" />
                </Pressable>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    header:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 10, borderBottomWidth: 0.5, borderBottomColor: C.border, backgroundColor: C.bg },
    back:         { width: 32 }, backText: { fontFamily: Fonts.regular, fontSize: 18, color: C.t2 },
    roomIcon:     { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    roomName:     { fontFamily: Fonts.semiBold, fontSize: 14, color: C.black },
    roomDesc:     { fontFamily: Fonts.regular, fontSize: 11, color: C.t3 },
    loader:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
    empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
    emptyTitle:   { fontFamily: Fonts.display, fontSize: 18, color: C.black },
    emptyText:    { fontFamily: Fonts.regular, fontSize: 12, color: C.t2, textAlign: 'center' },
    overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
    picker:       { backgroundColor: C.card, borderRadius: 20, padding: 20, alignItems: 'center', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 10 },
    pickerLabel:  { fontFamily: Fonts.semiBold, fontSize: 12, color: C.t2, letterSpacing: 0.4 },
    emojiRow:     { flexDirection: 'row', gap: 8 },
    emojiBtn:     { width: 44, height: 44, borderRadius: 22, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
    emoji:        { fontSize: 22 },
  });
}
