import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, SafeAreaView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Modal,
  TextInput, ScrollView, Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { ArrowLeft, Users, Activity, ClipboardList, Check, X, Heart, Flame, Dumbbell, ThumbsUp, Smile, Laugh } from 'lucide-react-native';
import { getEmojiIcon } from '@mobile/shared/lib/emojiIcon';
import { useLobbyChat } from '@features/clubs/hooks/useLobbyChat';
import { ChatBubble } from '@features/clubs/components/ChatBubble';
import { ChatInput } from '@features/clubs/components/ChatInput';
import { reactToMessage } from '@features/clubs/services/lobbyChatService';
import {
  fetchClubMembers,
  fetchClubActivity,
  fetchJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
  updateClubDescription,
  updateClubBadge,
} from '@features/clubs/services/clubService';
import type { ClubMember, ActivityItem, JoinRequest } from '@features/clubs/types';
import { supabase } from '@shared/services/supabase';
import { avatarColor } from '@shared/lib/avatarUtils';
import { Colors } from '@theme';

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'ClubDetail'>;

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

const BADGE_EMOJIS = [
  '🏃','⚡','🔥','💪','🏆','🌍','🦅','🐺','🦁','🌟',
  '🎯','🛡️','⚔️','🏔️','🌊','🦊','🐉','🚀','💎','🎖️',
];

const ACTION_LABELS: Record<string, string> = {
  captured: 'captured a territory',
  lost: 'lost a territory',
  defended: 'defended a territory',
  joined: 'joined the club',
  leveled_up: 'leveled up',
};

type DetailTab = 'chat' | 'members' | 'leaderboard' | 'activity' | 'admin';

function MemberRow({ member, rank, onPress }: { member: ClubMember; rank?: number; onPress: () => void }) {
  const bg = avatarColor(member.username);
  return (
    <Pressable style={mr.row} onPress={onPress}>
      {rank !== undefined && (
        <Text style={mr.rank}>{rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `${rank + 1}`}</Text>
      )}
      <View style={[mr.avatar, { backgroundColor: bg }]}>
        <Text style={mr.avatarText}>{member.username.slice(0, 2).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={mr.nameRow}>
          <Text style={mr.name}>{member.username}</Text>
          {member.role === 'admin' && (
            <View style={mr.adminBadge}><Text style={mr.adminText}>ADMIN</Text></View>
          )}
        </View>
        <Text style={mr.meta}>Lv. {member.level} · {member.total_km.toFixed(0)} km</Text>
      </View>
      <Text style={mr.kmVal}>{member.total_km.toFixed(0)}<Text style={mr.kmUnit}> km</Text></Text>
    </Pressable>
  );
}

const mr = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.white, borderRadius: 12, borderWidth: 0.5, borderColor: C.border, padding: 12, marginBottom: 6 },
  rank:      { width: 28, textAlign: 'center', fontFamily: 'Barlow_600SemiBold', fontSize: 13, color: C.t2 },
  avatar:    { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText:{ fontFamily: 'Barlow_700Bold', fontSize: 12, color: C.white },
  nameRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name:      { fontFamily: 'Barlow_500Medium', fontSize: 13, color: C.black },
  adminBadge:{ backgroundColor: 'rgba(217,53,24,0.12)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  adminText: { fontFamily: 'Barlow_600SemiBold', fontSize: 9, color: C.red, letterSpacing: 0.4 },
  meta:      { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t3, marginTop: 2 },
  kmVal:     { fontFamily: 'Barlow_600SemiBold', fontSize: 14, color: C.black },
  kmUnit:    { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t3 },
});

function ActivityRow({ item }: { item: ActivityItem }) {
  const bg = avatarColor(item.username);
  const label = ACTION_LABELS[item.action] ?? item.action;
  const timeAgo = (() => {
    const diff = Date.now() - new Date(item.time).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  })();

  return (
    <View style={ar.row}>
      <View style={[ar.avatar, { backgroundColor: bg }]}>
        <Text style={ar.avatarText}>{item.username.slice(0, 1).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={ar.text}>
          <Text style={ar.username}>{item.username}</Text>
          {' '}{label}{item.detail ? ` · ${item.detail}` : ''}
        </Text>
        <Text style={ar.time}>{timeAgo}</Text>
      </View>
    </View>
  );
}

const ar = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: C.border },
  avatar:    { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  avatarText:{ fontFamily: 'Barlow_700Bold', fontSize: 11, color: C.white },
  text:      { fontFamily: 'Barlow_400Regular', fontSize: 12, color: C.t2, lineHeight: 18 },
  username:  { fontFamily: 'Barlow_600SemiBold', color: C.black },
  time:      { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.t3, marginTop: 2 },
});

export default function ClubDetailScreen() {
  const navigation = useNavigation<Nav>();
  const { clubId, clubName, badgeEmoji, memberCount, totalKm, description: initialDesc } = useRoute<Route>().params as any;
  const { icon: BadgeIcon, color: badgeColor } = getEmojiIcon(badgeEmoji);
  const [tab, setTab] = useState<DetailTab>('chat');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'member' | null>(null);
  const [reactingMsgId, setReactingMsgId] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  // Members tab
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // Leaderboard tab (same data, sorted differently)
  const [leaderboard, setLeaderboard] = useState<ClubMember[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  // Activity tab
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Admin tab
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [description, setDescription] = useState<string>(initialDesc ?? '');
  const [savingDesc, setSavingDesc] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const { messages, loading: chatLoading, inputText, setInputText, sending, sendMessage } = useLobbyChat(`club_${clubId}`);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setCurrentUserId(user.id);
      // Check role in this club
      const { data } = await supabase
        .from('club_members')
        .select('role')
        .eq('club_id', clubId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) setCurrentUserRole(data.role as 'admin' | 'member');
    });
  }, [clubId]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const loadMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const data = await fetchClubMembers(clubId);
      setMembers(data);
    } catch { /* offline */ }
    setMembersLoading(false);
  }, [clubId]);

  const loadLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    try {
      const data = await fetchClubMembers(clubId);
      setLeaderboard(data); // already sorted by total_km desc in service
    } catch { /* offline */ }
    setLeaderboardLoading(false);
  }, [clubId]);

  const loadActivity = useCallback(async () => {
    setActivityLoading(true);
    try {
      const data = await fetchClubActivity(clubId);
      setActivity(data);
    } catch { /* offline */ }
    setActivityLoading(false);
  }, [clubId]);

  const loadRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const data = await fetchJoinRequests(clubId);
      setJoinRequests(data);
    } catch { /* offline */ }
    setRequestsLoading(false);
  }, [clubId]);

  useEffect(() => {
    if (tab === 'members') loadMembers();
    else if (tab === 'leaderboard') loadLeaderboard();
    else if (tab === 'activity') loadActivity();
    else if (tab === 'admin') loadRequests();
  }, [tab, loadMembers, loadLeaderboard, loadActivity, loadRequests]);

  const handleSaveDesc = async () => {
    setSavingDesc(true);
    await updateClubDescription(clubId, description);
    setSavingDesc(false);
  };

  const handleBadgeSelect = async (emoji: string) => {
    setShowEmojiPicker(false);
    await updateClubBadge(clubId, emoji);
  };

  const handleApprove = async (req: JoinRequest) => {
    await approveJoinRequest(req.id, clubId, req.userId);
    setJoinRequests(prev => prev.filter(r => r.id !== req.id));
  };

  const handleReject = async (req: JoinRequest) => {
    await rejectJoinRequest(req.id);
    setJoinRequests(prev => prev.filter(r => r.id !== req.id));
  };

  const tabs: { key: DetailTab; label: string }[] = [
    { key: 'chat', label: 'Chat' },
    { key: 'members', label: 'Members' },
    { key: 'leaderboard', label: 'Top' },
    { key: 'activity', label: 'Activity' },
    ...(currentUserRole === 'admin' ? [{ key: 'admin' as DetailTab, label: 'Admin' }] : []),
  ];

  return (
    <SafeAreaView style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
          <ArrowLeft size={20} color={C.t2} strokeWidth={1.5} />
        </Pressable>
        <View style={s.headerCenter}>
          <View style={s.emoji}><BadgeIcon size={26} color={badgeColor} strokeWidth={1.5} /></View>
          <View>
            <Text style={s.title} numberOfLines={1}>{clubName}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Users size={10} color={C.t3} strokeWidth={1.5} />
              <Text style={s.subtitle}>{memberCount} · </Text>
              <Activity size={10} color={C.t3} strokeWidth={1.5} />
              <Text style={s.subtitle}>{totalKm.toFixed(0)} km</Text>
            </View>
          </View>
        </View>
        <View style={{ width: 32 }} />
      </View>

      {/* Tab bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.tabScroll}
        contentContainerStyle={s.tabBar}
      >
        {tabs.map(t => (
          <Pressable key={t.key} style={[s.tabBtn, tab === t.key && s.tabBtnActive]} onPress={() => setTab(t.key)}>
            <Text style={[s.tabLabel, tab === t.key && s.tabLabelActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Chat tab */}
      {tab === 'chat' && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          {chatLoading ? (
            <View style={s.loader}><ActivityIndicator color={C.red} /></View>
          ) : messages.length === 0 ? (
            <View style={s.empty}>
              <BadgeIcon size={40} color={badgeColor} strokeWidth={1.5} />
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
      )}

      {/* Members tab */}
      {tab === 'members' && (
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
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={s.empty}>
                <Text style={s.emptyTitle}>No members found</Text>
              </View>
            }
          />
        )
      )}

      {/* Leaderboard tab */}
      {tab === 'leaderboard' && (
        leaderboardLoading ? (
          <View style={s.loader}><ActivityIndicator color={C.red} /></View>
        ) : (
          <FlatList
            data={leaderboard}
            keyExtractor={mb => mb.id}
            renderItem={({ item, index }) => (
              <MemberRow
                member={item}
                rank={index}
                onPress={() => navigation.navigate('UserProfile', { userId: item.id, username: item.username })}
              />
            )}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <Text style={s.sectionLabel}>RANKED BY TOTAL KM</Text>
            }
            ListEmptyComponent={
              <View style={s.empty}>
                <Text style={s.emptyTitle}>No members yet</Text>
              </View>
            }
          />
        )
      )}

      {/* Activity tab */}
      {tab === 'activity' && (
        activityLoading ? (
          <View style={s.loader}><ActivityIndicator color={C.red} /></View>
        ) : (
          <FlatList
            data={activity}
            keyExtractor={a => a.id}
            renderItem={({ item }) => <ActivityRow item={item} />}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <Text style={s.sectionLabel}>RECENT ACTIVITY</Text>
            }
            ListEmptyComponent={
              <View style={s.empty}>
                <ClipboardList size={36} color={C.t3} strokeWidth={1.5} />
                <Text style={s.emptyTitle}>No activity yet</Text>
                <Text style={s.emptyText}>Club runs and events will appear here.</Text>
              </View>
            }
          />
        )
      )}

      {/* Admin tab */}
      {tab === 'admin' && (
        <ScrollView contentContainerStyle={s.adminContent} showsVerticalScrollIndicator={false}>
          {/* Description edit */}
          <Text style={s.sectionLabel}>CLUB DESCRIPTION</Text>
          <View style={s.adminCard}>
            <TextInput
              style={s.descInput}
              value={description}
              onChangeText={setDescription}
              placeholder="Add a description…"
              placeholderTextColor={C.t3}
              multiline
              maxLength={280}
            />
            <Pressable
              style={[s.saveBtn, savingDesc && s.saveBtnDisabled]}
              onPress={handleSaveDesc}
              disabled={savingDesc}
            >
              {savingDesc ? (
                <ActivityIndicator size="small" color={C.white} />
              ) : (
                <Text style={s.saveBtnText}>Save</Text>
              )}
            </Pressable>
          </View>

          {/* Badge emoji edit */}
          <Text style={[s.sectionLabel, { marginTop: 20 }]}>CLUB BADGE</Text>
          <View style={s.adminCard}>
            <View style={s.badgeRow}>
              <View style={s.bigEmoji}><BadgeIcon size={40} color={badgeColor} strokeWidth={1.5} /></View>
              <Pressable style={s.changeBtn} onPress={() => setShowEmojiPicker(true)}>
                <Text style={s.changeBtnText}>Change Badge</Text>
              </Pressable>
            </View>
          </View>

          {/* Join requests */}
          <Text style={[s.sectionLabel, { marginTop: 20 }]}>JOIN REQUESTS</Text>
          {requestsLoading ? (
            <ActivityIndicator color={C.red} style={{ marginTop: 16 }} />
          ) : joinRequests.length === 0 ? (
            <View style={s.adminCard}>
              <Text style={s.noRequestsText}>No pending requests</Text>
            </View>
          ) : (
            joinRequests.map(req => (
              <View key={req.id} style={s.requestRow}>
                <View style={[s.reqAvatar, { backgroundColor: avatarColor(req.username) }]}>
                  <Text style={s.reqAvatarText}>{req.username.slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.reqName}>{req.username}</Text>
                  <Text style={s.reqTime}>{new Date(req.requestedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                </View>
                <Pressable style={s.approveBtn} onPress={() => handleApprove(req)}>
                  <Check size={14} color={C.green} strokeWidth={2} />
                </Pressable>
                <Pressable style={s.rejectBtn} onPress={() => handleReject(req)}>
                  <X size={14} color={C.red} strokeWidth={2} />
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Reaction picker */}
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

      {/* Badge emoji picker modal */}
      <Modal visible={showEmojiPicker} transparent animationType="fade" onRequestClose={() => setShowEmojiPicker(false)}>
        <Pressable style={s.overlay} onPress={() => setShowEmojiPicker(false)}>
          <View style={s.badgePickerSheet}>
            <Text style={s.pickerLabel}>Choose Badge</Text>
            <View style={s.badgeGrid}>
              {BADGE_EMOJIS.map(emoji => {
                const { icon: PickIcon, color: pickColor } = getEmojiIcon(emoji);
                return (
                  <Pressable key={emoji} style={s.badgePickerBtn} onPress={() => handleBadgeSelect(emoji)}>
                    <PickIcon size={22} color={pickColor} strokeWidth={1.5} />
                  </Pressable>
                );
              })}
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
  emoji:       { alignItems: 'center', justifyContent: 'center' },
  title:       { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 18, color: C.black },
  subtitle:    { fontFamily: 'Barlow_300Light', fontSize: 11, color: C.t3 },
  // Tab bar
  tabScroll:   { flexGrow: 0, backgroundColor: C.white, borderBottomWidth: 0.5, borderBottomColor: C.border },
  tabBar:      { flexDirection: 'row', paddingHorizontal: 4 },
  tabBtn:      { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive:{ borderBottomColor: C.red },
  tabLabel:    { fontFamily: 'Barlow_400Regular', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8, color: C.t3 },
  tabLabelActive: { fontFamily: 'Barlow_600SemiBold', color: C.red },
  // Common
  loader:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  emptyTitle:  { fontFamily: 'PlayfairDisplay_400Regular_Italic', fontSize: 18, color: C.black },
  emptyText:   { fontFamily: 'Barlow_300Light', fontSize: 12, color: C.t2, textAlign: 'center' },
  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100 },
  sectionLabel:{ fontFamily: 'Barlow_300Light', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.8, color: C.t3, marginBottom: 10 },
  // Admin
  adminContent:{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100, gap: 0 },
  adminCard:   { backgroundColor: C.white, borderRadius: 12, borderWidth: 0.5, borderColor: C.border, padding: 14, marginBottom: 4 },
  descInput:   { fontFamily: 'Barlow_400Regular', fontSize: 13, color: C.black, minHeight: 72, textAlignVertical: 'top', lineHeight: 20 },
  saveBtn:     { marginTop: 10, backgroundColor: C.black, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontFamily: 'Barlow_600SemiBold', fontSize: 12, color: C.white },
  badgeRow:    { flexDirection: 'row', alignItems: 'center', gap: 16 },
  bigEmoji:    { alignItems: 'center', justifyContent: 'center' },
  changeBtn:   { backgroundColor: C.stone, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 0.5, borderColor: C.border },
  changeBtnText: { fontFamily: 'Barlow_500Medium', fontSize: 12, color: C.black },
  noRequestsText: { fontFamily: 'Barlow_300Light', fontSize: 12, color: C.t3, textAlign: 'center' },
  requestRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.white, borderRadius: 12, borderWidth: 0.5, borderColor: C.border, padding: 12, marginBottom: 6 },
  reqAvatar:   { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  reqAvatarText: { fontFamily: 'Barlow_700Bold', fontSize: 12, color: C.white },
  reqName:     { fontFamily: 'Barlow_500Medium', fontSize: 13, color: C.black },
  reqTime:     { fontFamily: 'Barlow_300Light', fontSize: 10, color: C.t3, marginTop: 2 },
  approveBtn:  { width: 34, height: 34, borderRadius: 17, backgroundColor: '#EDF7F2', borderWidth: 0.5, borderColor: '#1A6B40', alignItems: 'center', justifyContent: 'center' },
  approveBtnText: { fontFamily: 'Barlow_700Bold', fontSize: 13, color: C.green },
  rejectBtn:   { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FEF0EE', borderWidth: 0.5, borderColor: C.red, alignItems: 'center', justifyContent: 'center' },
  rejectBtnText: { fontFamily: 'Barlow_700Bold', fontSize: 13, color: C.red },
  // Reaction picker
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  picker:      { backgroundColor: C.white, borderRadius: 20, padding: 20, alignItems: 'center', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 10 },
  pickerLabel: { fontFamily: 'Barlow_600SemiBold', fontSize: 12, color: C.t2, letterSpacing: 0.4 },
  emojiRow:    { flexDirection: 'row', gap: 8 },
  emojiBtn:    { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F0EDE8', alignItems: 'center', justifyContent: 'center' },
  emojiChar:   { fontSize: 22 },
  // Badge picker
  badgePickerSheet: { backgroundColor: C.white, borderRadius: 20, padding: 20, alignItems: 'center', gap: 16, width: 320, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 10 },
  badgeGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  badgePickerBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: C.stone, alignItems: 'center', justifyContent: 'center' },
});
