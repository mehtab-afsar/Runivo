import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, SafeAreaView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Modal,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useLobbyChat } from '@features/clubs/hooks/useLobbyChat';
import { ChatBubble } from '@features/clubs/components/ChatBubble';
import { ChatInput } from '@features/clubs/components/ChatInput';
import { reactToMessage } from '@features/clubs/services/lobbyChatService';
import { supabase } from '@shared/services/supabase';
import { avatarColor } from '@shared/lib/avatarUtils';

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'ClubDetail'>;

const C = {
  bg: '#EDEAE5', white: '#FFFFFF', stone: '#F0EDE8',
  border: '#DDD9D4', black: '#0A0A0A', t2: '#6B6B6B',
  t3: '#ADADAD', red: '#D93518',
};

const REACTION_EMOJIS = ['❤️', '🔥', '💪', '👏', '🤣', '😮'];

type DetailTab = 'chat' | 'members';

interface Member {
  id: string;
  username: string;
  level: number;
  total_km: number;
  role: string;
}

function MemberRow({ member, onPress }: { member: Member; onPress: () => void }) {
  const bg = avatarColor(member.username);
  return (
    <Pressable style={m.row} onPress={onPress}>
      <View style={[m.avatar, { backgroundColor: bg }]}>
        <Text style={m.avatarText}>{member.username.slice(0, 2).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={m.nameRow}>
          <Text style={m.name}>{member.username}</Text>
          {member.role === 'admin' && (
            <View style={m.adminBadge}><Text style={m.adminText}>ADMIN</Text></View>
          )}
        </View>
        <Text style={m.meta}>Lv. {member.level} · {member.total_km.toFixed(0)} km</Text>
      </View>
      <Text style={m.arrow}>›</Text>
    </Pressable>
  );
}

const m = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderRadius: 12, borderWidth: 0.5, borderColor: C.border, padding: 12, marginBottom: 6 },
  avatar:    { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText:{ fontFamily: 'Barlow_700Bold', fontSize: 13, color: C.white },
  nameRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name:      { fontFamily: 'Barlow_500Medium', fontSize: 13, color: C.black },
  adminBadge:{ backgroundColor: 'rgba(217,53,24,0.12)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  adminText: { fontFamily: 'Barlow_600SemiBold', fontSize: 9, color: C.red, letterSpacing: 0.4 },
  meta:      { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t3, marginTop: 2 },
  arrow:     { fontFamily: 'Barlow_400Regular', fontSize: 18, color: C.t3 },
});

export default function ClubDetailScreen() {
  const navigation = useNavigation<Nav>();
  const { clubId, clubName, badgeEmoji, memberCount, totalKm } = useRoute<Route>().params;
  const [tab, setTab] = useState<DetailTab>('chat');
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [reactingMsgId, setReactingMsgId] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  // Use club-prefixed room id so club chat is separate from lobby rooms
  const { messages, loading: chatLoading, inputText, setInputText, sending, sendMessage } = useLobbyChat(`club_${clubId}`);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id ?? null));
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const loadMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const { data } = await supabase
        .from('club_members')
        .select('user_id, role, profiles(username, level, total_km)')
        .eq('club_id', clubId)
        .limit(50);

      if (data) {
        setMembers(data.map((row: any) => ({
          id: row.user_id,
          username: row.profiles?.username ?? 'Runner',
          level: row.profiles?.level ?? 1,
          total_km: Number(row.profiles?.total_km ?? 0),
          role: row.role ?? 'member',
        })));
      }
    } catch { /* offline */ }
    setMembersLoading(false);
  }, [clubId]);

  useEffect(() => {
    if (tab === 'members') loadMembers();
  }, [tab, loadMembers]);

  return (
    <SafeAreaView style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>←</Text>
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.emoji}>{badgeEmoji}</Text>
          <View>
            <Text style={s.title} numberOfLines={1}>{clubName}</Text>
            <Text style={s.subtitle}>👥 {memberCount} · 🏃 {totalKm.toFixed(0)} km</Text>
          </View>
        </View>
        <View style={{ width: 32 }} />
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        {(['chat', 'members'] as DetailTab[]).map(t => (
          <Pressable key={t} style={[s.tabBtn, tab === t && s.tabBtnActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabLabel, tab === t && s.tabLabelActive]}>
              {t === 'chat' ? 'Chat' : 'Members'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'chat' ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          {chatLoading ? (
            <View style={s.loader}><ActivityIndicator color={C.red} /></View>
          ) : messages.length === 0 ? (
            <View style={s.empty}>
              <Text style={{ fontSize: 40 }}>{badgeEmoji}</Text>
              <Text style={s.emptyTitle}>No messages yet</Text>
              <Text style={s.emptyText}>Start the conversation with your club!</Text>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={msg => msg.id}
              renderItem={({ item }) => (
                <ChatBubble
                  message={item}
                  isOwn={item.userId === currentUserId}
                  onLongPress={() => setReactingMsgId(item.id)}
                />
              )}
              contentContainerStyle={{ paddingVertical: 12 }}
              showsVerticalScrollIndicator={false}
            />
          )}
          <ChatInput value={inputText} onChange={setInputText} onSend={sendMessage} sending={sending} />
        </KeyboardAvoidingView>
      ) : (
        membersLoading ? (
          <View style={s.loader}><ActivityIndicator color={C.red} /></View>
        ) : (
          <FlatList
            data={members}
            keyExtractor={mb => mb.id}
            renderItem={({ item }) => (
              <MemberRow
                member={item}
                onPress={() => navigation.navigate('UserProfile', { userId: item.id, username: item.username })}
              />
            )}
            contentContainerStyle={s.memberList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={s.empty}>
                <Text style={s.emptyTitle}>No members found</Text>
              </View>
            }
          />
        )
      )}

      {/* Reaction picker */}
      <Modal visible={!!reactingMsgId} transparent animationType="fade" onRequestClose={() => setReactingMsgId(null)}>
        <Pressable style={s.overlay} onPress={() => setReactingMsgId(null)}>
          <View style={s.picker}>
            <Text style={s.pickerLabel}>React</Text>
            <View style={s.emojiRow}>
              {REACTION_EMOJIS.map(emoji => (
                <Pressable
                  key={emoji}
                  style={s.emojiBtn}
                  onPress={async () => {
                    if (reactingMsgId && currentUserId) {
                      await reactToMessage(reactingMsgId, emoji, currentUserId);
                    }
                    setReactingMsgId(null);
                  }}
                >
                  <Text style={s.emojiChar}>{emoji}</Text>
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
  root:        { flex: 1, backgroundColor: C.bg },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? 12 : 0, paddingBottom: 12 },
  backBtn:     { width: 32 },
  backText:    { fontFamily: 'Barlow_400Regular', fontSize: 18, color: C.t2 },
  headerCenter:{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'center' },
  emoji:       { fontSize: 26 },
  title:       { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 18, color: C.black },
  subtitle:    { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t3 },
  tabBar:      { flexDirection: 'row', backgroundColor: C.white, borderBottomWidth: 0.5, borderBottomColor: C.border },
  tabBtn:      { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive:{ borderBottomColor: C.red },
  tabLabel:    { fontFamily: 'Barlow_400Regular', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8, color: C.t3 },
  tabLabelActive: { fontFamily: 'Barlow_600SemiBold', color: C.red },
  loader:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  emptyTitle:  { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 18, color: C.black },
  emptyText:   { fontFamily: 'Barlow_300Light', fontSize: 12, color: C.t2, textAlign: 'center' },
  memberList:  { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100 },
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  picker:      { backgroundColor: C.white, borderRadius: 20, padding: 20, alignItems: 'center', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 10 },
  pickerLabel: { fontFamily: 'Barlow_600SemiBold', fontSize: 12, color: C.t2, letterSpacing: 0.4 },
  emojiRow:    { flexDirection: 'row', gap: 8 },
  emojiBtn:    { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F0EDE8', alignItems: 'center', justifyContent: 'center' },
  emojiChar:   { fontSize: 22 },
});
