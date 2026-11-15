import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator, Modal, TextInput, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { ArrowLeft, ClipboardText, Check, X, Flag } from 'phosphor-react-native';
import { getEmojiIcon } from '@mobile/shared/lib/emojiIcon';
import { useLobbyChat } from '@features/clubs/hooks/useLobbyChat';
import { ChatBubble } from '@features/clubs/components/ChatBubble';
import { ChatInput } from '@features/clubs/components/ChatInput';
import ClubRunsTab from '@features/clubs/components/ClubRunsTab';
import ClubTerritoryTab from '@features/clubs/components/ClubTerritoryTab';
import {
  fetchClubMembers,
  fetchClubActivity,
  fetchJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
  updateClubDescription,
  updateClubBadge,
  getOrCreateClubLobby,
  reportClubMessage,
  deleteClubMessage,
  removeClubMember,
  fetchClubReports,
  fetchClubOwnerId,
  type ChatReport,
  type ChatReportReason,
} from '@features/clubs/services/clubService';
import type { LobbyMessage } from '@features/clubs/services/lobbyChatService';
import type { ClubMember, ActivityItem, JoinRequest } from '@features/clubs/types';
import { supabase } from '@shared/services/supabase';
import { useTheme, Fonts, Type, Spacing, type AppColors } from '@theme';
import { RunnerFace } from '@mobile/shared/components/RunnerFace';
import { ClubInitialsTile } from '../components/ClubHeroCard';
import { FeedPostCard } from '@features/social/components/FeedPostCard';
import CommentSheet from '@features/social/components/CommentSheet';
import { fetchClubFeed, toggleLike, deletePost } from '@features/social/services/feedService';
import { blockUser } from '@mobile/shared/services/safetyService';
import { promptReport } from '@mobile/shared/lib/promptReport';
import type { FeedPost } from '@features/social/types';

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'ClubDetail'>;

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

type DetailTab = 'chat' | 'runs' | 'ground' | 'members' | 'leaderboard' | 'activity' | 'admin';

function MemberRow({ member, rank, onPress, onLongPress }: { member: ClubMember; rank?: number; onPress: () => void; onLongPress?: () => void }) {
  const C = useTheme();
  const mr = useMemo(() => mkMrStyles(C), [C]);
  return (
    <Pressable style={mr.row} onPress={onPress} onLongPress={onLongPress} delayLongPress={350}>
      {rank !== undefined && (
        <Text style={[mr.rank, rank < 3 && mr.rankTop]}>{rank + 1}</Text>
      )}
      <View style={[mr.avatar, { overflow: 'hidden' }]}>
        <RunnerFace seed={member.username} size={38} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={mr.nameRow}>
          <Text style={mr.name}>{member.username}</Text>
          {member.role === 'admin' && (
            <View style={mr.adminBadge}><Text style={mr.adminText}>Admin</Text></View>
          )}
        </View>
        <Text style={mr.meta}>Lv. {member.level}</Text>
      </View>
      <Text style={mr.kmVal}>{member.total_km.toFixed(0)}<Text style={mr.kmUnit}> km</Text></Text>
    </Pressable>
  );
}

function mkMrStyles(C: AppColors) {
  return StyleSheet.create({
    row:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: 22, shadowColor: C.t1, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1, padding: 12, marginBottom: 6 },
    rank:      { width: 30, textAlign: 'center', fontFamily: Fonts.numeric, fontSize: 22, lineHeight: 24, color: C.t2, fontVariant: ['tabular-nums'] },
    rankTop:   { color: C.red },
    avatar:    { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    avatarText:{ fontFamily: Fonts.bold, fontSize: 12, color: C.white },
    nameRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
    name:      { fontFamily: Fonts.semiBold, fontSize: 14, color: C.t1 },
    adminBadge:{ backgroundColor: C.redLo, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
    adminText: { fontFamily: Fonts.semiBold, fontSize: 11, color: C.red },
    meta:      { fontFamily: Fonts.regular, fontSize: 11, color: C.t3, marginTop: 2 },
    kmVal:     { fontFamily: Fonts.numeric, fontSize: 22, lineHeight: 24, color: C.t1, fontVariant: ['tabular-nums'] },
    kmUnit:    { fontFamily: Fonts.medium, fontSize: 11, color: C.t3 },
  });
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const C = useTheme();
  const ar = useMemo(() => mkArStyles(C), [C]);
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
      <View style={[ar.avatar, { overflow: 'hidden' }]}>
        <RunnerFace seed={item.username} size={32} />
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

function mkArStyles(C: AppColors) {
  return StyleSheet.create({
    row:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
    avatar:    { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
    avatarText:{ fontFamily: Fonts.bold, fontSize: 11, color: C.white },
    text:      { fontFamily: Fonts.regular, fontSize: 13, color: C.t2, lineHeight: 19 },
    username:  { fontFamily: Fonts.semiBold, color: C.t1 },
    time:      { fontFamily: Fonts.regular, fontSize: 11, color: C.t3, marginTop: 2 },
  });
}

export default function ClubDetailScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  const { clubId, clubName, badgeEmoji, memberCount, totalKm, description: initialDesc } = useRoute<Route>().params as any;
  const { icon: BadgeIcon, color: badgeColor } = getEmojiIcon(badgeEmoji);
  const [tab, setTab] = useState<DetailTab>('chat');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'member' | null>(null);
  const [clubLobbyId, setClubLobbyId] = useState<string | null>(null);
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
  // C3: members' activities.
  const [clubPosts, setClubPosts] = useState<FeedPost[]>([]);
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const kudos = useCallback(async (postId: string) => {
    setClubPosts(ps => ps.map(p => p.id === postId ? { ...p, hasKudos: !p.hasKudos, kudosCount: p.kudosCount + (p.hasKudos ? -1 : 1) } : p));
    try {
      const r = await toggleLike(postId);
      setClubPosts(ps => ps.map(p => p.id === postId ? { ...p, hasKudos: r.liked, kudosCount: r.count } : p));
    } catch { /* keep the optimistic state */ }
  }, []);

  // Admin tab
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [description, setDescription] = useState<string>(initialDesc ?? '');
  const [savingDesc, setSavingDesc] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [reports, setReports] = useState<ChatReport[]>([]);

  // Resolves to '' until the club's lobby id loads — useLobbyChat's fetch/subscribe
  // are harmless no-ops against an empty id (no row can match) until then.
  const { messages, loading: chatLoading, error: chatError, inputText, setInputText, sending, sendMessage, removeMessage, removeMessagesFrom } = useLobbyChat(clubLobbyId ?? '');

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
      fetchClubOwnerId(clubId).then(setOwnerId).catch(() => {});

      const lobbyId = await getOrCreateClubLobby(clubId, clubName, user.id);
      setClubLobbyId(lobbyId);
    });
  }, [clubId, clubName]);

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
      const [data, posts] = await Promise.all([fetchClubActivity(clubId), fetchClubFeed(clubId).catch(() => [] as FeedPost[])]);
      setActivity(data);
      setClubPosts(posts);
    } catch { /* offline */ }
    setActivityLoading(false);
  }, [clubId]);

  const loadRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const [data, rep] = await Promise.all([fetchJoinRequests(clubId), fetchClubReports(clubId).catch(() => [])]);
      setJoinRequests(data);
      setReports(rep);
    } catch { /* offline */ }
    setRequestsLoading(false);
  }, [clubId]);

  useEffect(() => {
    if (tab === 'members') loadMembers();
    else if (tab === 'leaderboard') loadLeaderboard();
    else if (tab === 'activity') loadActivity();
    else if (tab === 'admin') loadRequests();
  }, [tab, loadMembers, loadLeaderboard, loadActivity, loadRequests]);

  // ── Moderation ──────────────────────────────────────────────────────────
  const isModerator = currentUserRole === 'admin' || (!!ownerId && ownerId === currentUserId);
  const isOwner = !!ownerId && ownerId === currentUserId;
  // Moderators need roles in chat (who can be removed) before opening the Members tab.
  useEffect(() => { if (isModerator) loadMembers(); }, [isModerator, loadMembers]);
  const canRemove = (userId: string, role?: string) =>
    isModerator && userId !== currentUserId && userId !== ownerId && (role !== 'admin' || isOwner);

  const confirmRemove = (userId: string, username: string) => {
    Alert.alert(
      `Remove ${username}?`,
      `They leave ${clubName} and can't rejoin unless an admin lets them back.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive', onPress: async () => {
            try {
              await removeClubMember(clubId, userId);
              setMembers(m => m.filter(x => x.id !== userId));
              setLeaderboard(m => m.filter(x => x.id !== userId));
              setReports(r => r.filter(x => x.authorId !== userId));
            } catch (e) {
              Alert.alert("Couldn't remove", e instanceof Error ? e.message : 'Try again.');
            }
          },
        },
      ],
    );
  };

  const confirmDeleteMessage = (id: string) => {
    Alert.alert('Delete this message?', 'It is removed for everyone in the club.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deleteClubMessage(id);
            removeMessage(id);
            setReports(r => r.filter(x => x.messageId !== id));
          } catch {
            Alert.alert("Couldn't delete", 'Check your connection and try again.');
          }
        },
      },
    ]);
  };

  const reportMessage = (id: string) => {
    const send = async (reason: ChatReportReason) => {
      try {
        await reportClubMessage(id, reason);
        Alert.alert('Thanks for reporting', "The club's admins will review it.");
      } catch (e) {
        Alert.alert("Couldn't report", e instanceof Error && e.message.includes('too many') ? 'You have sent a lot of reports today. Try again tomorrow.' : 'Try again.');
      }
    };
    Alert.alert('Report message', 'Why are you reporting it?', [
      { text: 'Spam', onPress: () => send('spam') },
      { text: 'Harassment', onPress: () => send('harassment') },
      { text: 'Inappropriate', onPress: () => send('inappropriate') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const messageOptions = (m: LobbyMessage) => {
    if (m.userId === currentUserId) {
      Alert.alert('Your message', undefined, [
        { text: 'Delete', style: 'destructive', onPress: () => confirmDeleteMessage(m.id) },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    const role = members.find(x => x.id === m.userId)?.role;
    const buttons: Parameters<typeof Alert.alert>[2] = [
      { text: 'Report message', onPress: () => reportMessage(m.id) },
      { text: `Block ${m.userName}`, style: 'destructive', onPress: () => {
        Alert.alert(`Block ${m.userName}?`, "You won't see their messages or posts, and they won't see yours.", [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Block', style: 'destructive', onPress: async () => {
            try { await blockUser(m.userId); removeMessagesFrom(m.userId); }
            catch { Alert.alert("Couldn't block", 'Check your connection and try again.'); }
          } },
        ]);
      } },
    ];
    if (isModerator) buttons.push({ text: 'Delete message', style: 'destructive', onPress: () => confirmDeleteMessage(m.id) });
    if (canRemove(m.userId, role)) buttons.push({ text: `Remove ${m.userName}`, style: 'destructive', onPress: () => confirmRemove(m.userId, m.userName) });
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(m.userName, m.message.length > 80 ? `${m.message.slice(0, 80)}…` : m.message, buttons);
  };

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
    const { ok } = await approveJoinRequest(req.id);
    if (ok) {
      setJoinRequests(prev => prev.filter(r => r.id !== req.id));
      loadMembers();
    }
  };

  const handleReject = async (req: JoinRequest) => {
    const { ok } = await rejectJoinRequest(req.id);
    if (ok) setJoinRequests(prev => prev.filter(r => r.id !== req.id));
  };

  const tabs: { key: DetailTab; label: string }[] = [
    { key: 'chat', label: 'Chat' },
    { key: 'runs', label: 'Runs' },
    { key: 'ground', label: 'Territory' },
    { key: 'members', label: 'Members' },
    { key: 'leaderboard', label: 'Board' },
    ...(currentUserRole === 'admin' ? [{ key: 'admin' as DetailTab, label: 'Admin' }] : []),
  ];

  return (
    <SafeAreaView style={s.root}>
      {/* Header (mock): top bar, then the club centred with its member line. */}
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn} accessibilityLabel="Back">
          <ArrowLeft size={16} color={C.t1} weight="regular" />
        </Pressable>
        <Text style={[s.title, { flex: 1, textAlign: 'center' }]}>Club</Text>
        {currentUserRole !== 'admin' ? (
          <Pressable onPress={() => promptReport('club', clubId, 'club')} hitSlop={10} style={s.backBtn}
            accessibilityRole="button" accessibilityLabel="Report this club">
            <Flag size={16} color={C.t2} weight="regular" />
          </Pressable>
        ) : <View style={{ width: 36 }} />}
      </View>
      <View style={s.clubHero}>
        <ClubInitialsTile name={clubName} size={72} />
        <Text style={s.clubName} numberOfLines={2}>{clubName}</Text>
        <Text style={s.subLine} numberOfLines={1}>
          {memberCount} {memberCount === 1 ? 'member' : 'members'} · {Math.round(totalKm).toLocaleString()} km
          {currentUserRole === 'admin' ? ' · admin' : ''}
        </Text>
      </View>

      <View style={s.seg}>
        {tabs.map(t => (
          <Pressable key={t.key} style={[s.segItem, tab === t.key && s.segItemOn]} onPress={() => setTab(t.key)}>
            <Text style={[s.segLabel, tab === t.key && s.segLabelOn]} numberOfLines={1} adjustsFontSizeToFit>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Chat tab */}
      {tab === 'chat' && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          {chatLoading ? (
            <View style={s.loader}><ActivityIndicator color={C.red} /></View>
          ) : messages.length === 0 && chatError ? (
            // A failed load is not "No messages yet".
            <View style={s.empty}>
              <Text style={s.emptyTitle}>Couldn't load the chat</Text>
              <Text style={s.emptyText}>{chatError}</Text>
            </View>
          ) : messages.length === 0 ? (
            <View style={s.empty}>
              <BadgeIcon size={40} color={badgeColor} weight="light" />
              <Text style={s.emptyTitle}>No messages yet</Text>
              <Text style={s.emptyText}>Start the conversation with your club!</Text>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={msg => msg.id}
              renderItem={({ item }) => (
                <ChatBubble message={item} isOwn={item.userId === currentUserId} onLongPress={() => messageOptions(item)} />
              )}
              contentContainerStyle={{ paddingVertical: 12 }}
              showsVerticalScrollIndicator={false}
            />
          )}
          {/* Send failures (offline, blocked words, suspended) used to vanish silently. */}
          {!!chatError && messages.length > 0 && (
            <Text style={[s.emptyText, { color: C.red, paddingHorizontal: 18, paddingBottom: 6 }]} accessibilityRole="alert">{chatError}</Text>
          )}
          <ChatInput value={inputText} onChange={setInputText} onSend={sendMessage} sending={sending} placeholder={`Message ${clubName}`} />
        </KeyboardAvoidingView>
      )}

      {/* Club runs (C1) */}
      {tab === 'runs' && <ClubRunsTab clubId={clubId} canSchedule={isModerator} />}

      {/* Club territory (C2) */}
      {tab === 'ground' && (
        <ClubTerritoryTab clubId={clubId} onOpenMap={() => navigation.navigate('TerritoryMap', { clubId, clubName })} />
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
                onLongPress={canRemove(item.id, item.role) ? () => confirmRemove(item.id, item.username) : undefined}
              />
            )}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={isModerator ? <Text style={s.sectionLabel}>Long press a member to remove them</Text> : null}
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
              <Text style={s.sectionLabel}>Ranked by total km</Text>
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
              <>
                {clubPosts.length > 0 && (
                  <View style={{ gap: 12, marginBottom: 16 }}>
                    <Text style={s.sectionLabel}>Members' activities</Text>
                    {clubPosts.map(p => (
                      <FeedPostCard
                        key={p.id}
                        post={p}
                        currentUserId={currentUserId}
                        onKudos={() => kudos(p.id)}
                        onComment={() => setCommentPostId(p.id)}
                        onUserPress={() => navigation.navigate('UserProfile', { userId: p.userId, username: p.username })}
                        onDelete={() => { setClubPosts(ps => ps.filter(x => x.id !== p.id)); deletePost(p.id).catch(() => loadActivity()); }}
                      />
                    ))}
                  </View>
                )}
                {activity.length > 0 && <Text style={s.sectionLabel}>Club news</Text>}
              </>
            }
            ListEmptyComponent={clubPosts.length > 0 ? null : (
              <View style={s.empty}>
                <ClipboardText size={36} color={C.t3} weight="light" />
                <Text style={s.emptyTitle}>No activity yet</Text>
                <Text style={s.emptyText}>Club runs and events will appear here.</Text>
              </View>
            )}
          />
        )
      )}

      {/* Admin tab */}
      {tab === 'admin' && (
        <ScrollView contentContainerStyle={s.adminContent} showsVerticalScrollIndicator={false}>
          {/* Description edit */}
          <Text style={s.sectionLabel}>Club description</Text>
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
                <ActivityIndicator size="small" color={C.alwaysLight} />
              ) : (
                <Text style={s.saveBtnText}>Save</Text>
              )}
            </Pressable>
          </View>

          {/* Badge emoji edit */}
          <Text style={[s.sectionLabel, { marginTop: 20 }]}>Club badge</Text>
          <View style={s.adminCard}>
            <View style={s.badgeRow}>
              <View style={s.bigEmoji}><BadgeIcon size={40} color={badgeColor} weight="light" /></View>
              <Pressable hitSlop={8} style={s.changeBtn} onPress={() => setShowEmojiPicker(true)}>
                <Text style={s.changeBtnText}>Change badge</Text>
              </Pressable>
            </View>
          </View>

          {/* Reported messages */}
          <Text style={[s.sectionLabel, { marginTop: 20 }]}>Reported messages</Text>
          {reports.length === 0 ? (
            <View style={s.adminCard}><Text style={s.noRequestsText}>Nothing reported</Text></View>
          ) : reports.map(rep => (
            <View key={rep.messageId} style={[s.adminCard, { marginBottom: 6 }]}>
              <Text style={s.reqName}>{rep.authorUsername}</Text>
              <Text style={s.reportText} numberOfLines={3}>{rep.content}</Text>
              <Text style={s.reqTime}>
                {rep.reports} report{rep.reports > 1 ? 's' : ''} · {rep.reasons.join(', ')}
              </Text>
              <View style={s.reportActions}>
                <Pressable hitSlop={8} style={s.reportBtn} onPress={() => confirmDeleteMessage(rep.messageId)} accessibilityRole="button">
                  <Text style={s.reportBtnTxt}>Delete message</Text>
                </Pressable>
                {canRemove(rep.authorId, members.find(x => x.id === rep.authorId)?.role) && (
                  <Pressable hitSlop={8} style={s.reportBtn} onPress={() => confirmRemove(rep.authorId, rep.authorUsername)} accessibilityRole="button">
                    <Text style={[s.reportBtnTxt, { color: C.red }]}>Remove {rep.authorUsername}</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))}

          {/* Join requests */}
          <Text style={[s.sectionLabel, { marginTop: 20 }]}>Join requests</Text>
          {requestsLoading ? (
            <ActivityIndicator color={C.red} style={{ marginTop: 16 }} />
          ) : joinRequests.length === 0 ? (
            <View style={s.adminCard}>
              <Text style={s.noRequestsText}>No pending requests</Text>
            </View>
          ) : (
            joinRequests.map(req => (
              <View key={req.id} style={s.requestRow}>
                <View style={[s.reqAvatar, { overflow: 'hidden' }]}>
                  <RunnerFace seed={req.username} size={34} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.reqName}>{req.username}</Text>
                  <Text style={s.reqTime}>{new Date(req.requestedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                </View>
                <Pressable style={s.approveBtn} onPress={() => handleApprove(req)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Approve ${req.username}`}>
                  <Check size={14} color={C.green} weight="regular" />
                </Pressable>
                <Pressable style={s.rejectBtn} onPress={() => handleReject(req)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Decline ${req.username}`}>
                  <X size={14} color={C.red} weight="regular" />
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Badge emoji picker modal */}
      <Modal visible={showEmojiPicker} transparent animationType="fade" onRequestClose={() => setShowEmojiPicker(false)}>
        <Pressable style={s.overlay} onPress={() => setShowEmojiPicker(false)}>
          <View style={s.badgePickerSheet}>
            <Text style={s.pickerLabel}>Choose a badge</Text>
            <View style={s.badgeGrid}>
              {BADGE_EMOJIS.map(emoji => {
                const { icon: PickIcon, color: pickColor } = getEmojiIcon(emoji);
                return (
                  <Pressable key={emoji} style={s.badgePickerBtn} onPress={() => handleBadgeSelect(emoji)}>
                    <PickIcon size={22} color={pickColor} weight="light" />
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Pressable>
      </Modal>
      <CommentSheet postId={commentPostId} onClose={() => setCommentPostId(null)} onCommentPosted={() => setClubPosts(ps => ps.map(p => p.id === commentPostId ? { ...p, commentCount: p.commentCount + 1 } : p))} />
    </SafeAreaView>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:        { flex: 1, backgroundColor: C.bg },
    header:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.gutter, paddingTop: Platform.OS === 'android' ? 12 : 4, paddingBottom: 12 },
    backBtn:     { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card },
    subLine:     { fontFamily: Fonts.regular, fontSize: 14, color: C.t2 },
    clubHero:    { alignItems: 'center', paddingHorizontal: Spacing.gutter, paddingTop: 4, paddingBottom: 14, gap: 6 },
    clubName:    { fontFamily: Fonts.semiBold, fontSize: 24, lineHeight: 29, color: C.t1, textAlign: 'center', marginTop: 6 },
    seg:         { flexDirection: 'row', marginBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
    segItem:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 12, paddingBottom: 11, borderBottomWidth: 3, borderBottomColor: 'transparent' },
    segItemOn:   { borderBottomColor: C.t1 },
    segLabel:    { fontFamily: Fonts.regular, fontSize: 14, color: C.t2 },
    segLabelOn:  { fontFamily: Fonts.semiBold, color: C.t1 },
    backText:    { fontFamily: Fonts.regular, fontSize: 18, color: C.t2 },
    hero:        { marginHorizontal: Spacing.gutter, marginBottom: 12, backgroundColor: C.alwaysDark, borderRadius: Spacing.radius.xl, padding: 18 },
    heroTop:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
    emoji:       { width: 52, height: 52, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
    title:       { fontFamily: Fonts.semiBold, fontSize: 17, color: C.t1, letterSpacing: -0.2 },
    heroRole:    { fontFamily: Fonts.medium, fontSize: 12, color: C.alwaysLight, opacity: 0.6, marginTop: 2 },
    heroStats:   { flexDirection: 'row', gap: 12, marginTop: 18 },
    heroStat:    { flex: 1 },
    heroStatLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, opacity: 0.6 },
    subtitle:    { fontFamily: Fonts.medium, fontSize: 12, color: C.alwaysLight },
    heroNum:     { fontFamily: Fonts.numeric, fontSize: 36, lineHeight: 38, color: C.alwaysLight, marginTop: 2, fontVariant: ['tabular-nums'] },
    // Tab bar
    tabScroll:   { flexGrow: 0, backgroundColor: C.bg },
    tabBar:      { flexDirection: 'row', paddingHorizontal: Spacing.gutter, gap: 8, paddingBottom: 6 },
    tabBtn:      { height: 36, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
    tabBtnActive:{ backgroundColor: C.t1, borderColor: C.t1 },
    tabLabel:    { fontFamily: Fonts.medium, fontSize: 13, color: C.t2 },
    tabLabelActive: { fontFamily: Fonts.semiBold, color: C.bg },
    // Common
    loader:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
    empty:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
    emptyTitle:  { fontFamily: Fonts.semiBold, fontSize: 18, color: C.t1 },
    emptyText:   { ...Type.bodySm, color: C.t2, textAlign: 'center' },
    listContent: { paddingHorizontal: Spacing.gutter, paddingTop: 12, paddingBottom: 100 },
    sectionLabel:{ fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1, marginBottom: 10 },
    // Admin
    adminContent:{ paddingHorizontal: Spacing.gutter, paddingTop: 16, paddingBottom: 100, gap: 0 },
    adminCard:   { backgroundColor: C.card, borderRadius: 24, padding: 16, marginBottom: 4 },
    descInput:   { fontFamily: Fonts.regular, fontSize: 13, color: C.t1, minHeight: 72, textAlignVertical: 'top', lineHeight: 20 },
    saveBtn:     { marginTop: 10, backgroundColor: C.alwaysDark, borderRadius: 999, height: 44, justifyContent: 'center', alignItems: 'center' },
    saveBtnDisabled: { opacity: 0.5 },
    saveBtnText: { ...Type.button, fontSize: 14, color: C.alwaysLight },
    badgeRow:    { flexDirection: 'row', alignItems: 'center', gap: 16 },
    bigEmoji:    { alignItems: 'center', justifyContent: 'center' },
    changeBtn:   { backgroundColor: C.card, borderRadius: 999, paddingHorizontal: 16, height: 38, justifyContent: 'center', borderWidth: 1, borderColor: C.border },
    changeBtnText: { fontFamily: Fonts.semiBold, fontSize: 13, color: C.t1 },
    reportText:  { fontFamily: Fonts.regular, fontSize: 14, color: C.t1, marginTop: 4, lineHeight: 20 },
    reportActions: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
    reportBtn:   { height: 32, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: C.border, justifyContent: 'center' },
    reportBtnTxt:{ fontFamily: Fonts.semiBold, fontSize: 12.5, color: C.t1 },
    noRequestsText: { fontFamily: Fonts.regular, fontSize: 12, color: C.t3, textAlign: 'center' },
    requestRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: 22, padding: 12, marginBottom: 6 },
    reqAvatar:   { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
    reqAvatarText: { fontFamily: Fonts.bold, fontSize: 12, color: C.white },
    reqName:     { fontFamily: Fonts.medium, fontSize: 13, color: C.t1 },
    reqTime:     { fontFamily: Fonts.regular, fontSize: 11, color: C.t3, marginTop: 2 },
    approveBtn:  { width: 34, height: 34, borderRadius: 17, backgroundColor: C.greenBg, borderWidth: 0.5, borderColor: C.green, alignItems: 'center', justifyContent: 'center' },
    approveBtnText: { fontFamily: Fonts.bold, fontSize: 13, color: C.green },
    rejectBtn:   { width: 34, height: 34, borderRadius: 17, backgroundColor: C.redLo, borderWidth: 0.5, borderColor: C.red, alignItems: 'center', justifyContent: 'center' },
    rejectBtnText: { fontFamily: Fonts.bold, fontSize: 13, color: C.red },
    overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
    pickerLabel: { fontFamily: Fonts.semiBold, fontSize: 15, color: C.t1 },
    // Badge picker
    badgePickerSheet: { backgroundColor: C.card, borderRadius: 28, padding: 20, alignItems: 'center', gap: 16, width: 320, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 10 },
    badgeGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
    badgePickerBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: C.stone, alignItems: 'center', justifyContent: 'center' },
  });
}
