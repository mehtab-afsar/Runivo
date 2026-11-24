import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StyleSheet, FlatList, Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '@navigation/AppNavigator';
import { useTheme, Fonts, type AppColors } from '@theme';
import { Segmented } from '@mobile/shared/components/Segmented';
import CommentSheet from '@features/social/components/CommentSheet';
import type { LobbyMessage } from '@features/clubs/services/lobbyChatService';
import ClubHomeTab from '../components/ClubHomeTab';
import ClubRunsTab from '@features/clubs/components/ClubRunsTab';
import ClubTerritoryTab from '@features/clubs/components/ClubTerritoryTab';
import { ClubTopBar } from '../components/clubDetail/ClubTopBar';
import { ClubHeaderCard } from '../components/clubDetail/ClubHeaderCard';
import { ClubJoinBanner } from '../components/clubDetail/ClubJoinBanner';
import { ClubChatPanel } from '../components/clubDetail/ClubChatPanel';
import { ClubMembersTab } from '../components/clubDetail/ClubMembersTab';
import { ClubLeaderboardTab } from '../components/clubDetail/ClubLeaderboardTab';
import { ClubActivityTab } from '../components/clubDetail/ClubActivityTab';
import { ClubAdminTab } from '../components/clubDetail/ClubAdminTab';
import { useClubSession, type ClubDetailParams } from '../hooks/useClubSession';
import { useClubTabData } from '../hooks/useClubTabData';
import { useClubDescription } from '../hooks/useClubDescription';
import { useClubModeration } from '../hooks/useClubModeration';
import { useClubJoin } from '../hooks/useClubJoin';
import { buildTabs, resolveTabValue, type DetailTab } from '../utils/clubDetailFormatters';

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'ClubDetail'>;

export default function ClubDetailScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const navigation = useNavigation<Nav>();
  // A club link (runivo://club/<id>?invite=<code>) carries only the id (and maybe an invite).
  const params: ClubDetailParams = useRoute<Route>().params;
  const { clubId, description: initialDesc, compose, invite } = params;
  const session = useClubSession(params);
  const { summary, clubName, currentUserId, currentUserRole, ownerId, media, chat } = session;
  const [tab, setTab] = useState<DetailTab>(compose ? 'chat' : 'home');
  const listRef = useRef<FlatList<LobbyMessage>>(null);
  const data = useClubTabData(clubId, tab);
  const desc = useClubDescription(clubId, initialDesc);
  const mod = useClubModeration({
    clubId, clubName, currentUserId, currentUserRole, ownerId,
    members: data.members, loadMembers: data.loadMembers,
    setMembers: data.setMembers, setLeaderboard: data.setLeaderboard, setReports: data.setReports,
    removeMessage: chat.removeMessage, removeMessagesFrom: chat.removeMessagesFrom,
    onExit: () => navigation.goBack(),
  });
  const { joining, inviteToClub, joinFromHere } = useClubJoin({
    clubId, clubName, invite, currentUserId, joinPolicy: summary?.joinPolicy, setCurrentUserRole: session.setCurrentUserRole,
  });

  useEffect(() => {
    if (chat.messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [chat.messages.length]);

  const openProfile = (userId: string, username: string) => navigation.navigate('UserProfile', { userId, username });
  const isMember = !!currentUserRole || mod.isOwner;
  const tabs = buildTabs(currentUserRole);

  return (
    <SafeAreaView style={s.root}>
      <ClubTopBar clubId={clubId} clubName={clubName} role={currentUserRole} onBack={() => navigation.goBack()} onInvite={() => { void inviteToClub(); }} />
      <ClubHeaderCard
        clubName={clubName} banner={media.banner} avatar={media.avatar}
        memberCount={session.memberCount} totalKm={session.totalKm} isAdmin={currentUserRole === 'admin'}
      />

      {session.memberChecked && !isMember && (
        <ClubJoinBanner clubName={clubName} joining={joining} invite={invite} joinPolicy={summary?.joinPolicy} onJoin={() => { void joinFromHere(); }} />
      )}

      <Segmented style={{ marginHorizontal: 18, marginBottom: 10 }} options={tabs.map(t => ({ value: t.key, label: t.label }))} value={resolveTabValue(tab)} onChange={setTab} />

      {tab === 'home' && (
        <ClubHomeTab
          clubId={clubId}
          canSchedule={mod.isModerator}
          chat={chat.messages.slice(-2).map(m => ({ id: m.id, text: m.message, mine: m.userId === currentUserId }))}
          onOpenChat={() => setTab('chat')}
          onOpenRuns={() => setTab('runs')}
          onOpenGround={() => setTab('ground')}
        />
      )}
      {(tab === 'runs' || tab === 'ground') && (
        <Pressable style={s.backHome} onPress={() => setTab('home')} accessibilityRole="button">
          <Text style={s.backHomeTxt}>‹ Club home</Text>
        </Pressable>
      )}

      {tab === 'chat' && (
        <ClubChatPanel
          listRef={listRef} messages={chat.messages} loading={chat.loading} error={chat.error}
          clubName={clubName} clubAvatar={media.avatar} currentUserId={currentUserId}
          onMessageOptions={mod.messageOptions}
          inputText={chat.inputText} onChangeInput={chat.setInputText} onSend={chat.sendMessage} sending={chat.sending}
          autoFocus={!!compose}
        />
      )}

      {/* Club runs (C1) */}
      {tab === 'runs' && <ClubRunsTab clubId={clubId} canSchedule={mod.isModerator} />}

      {/* Club territory (C2) */}
      {tab === 'ground' && (
        <ClubTerritoryTab clubId={clubId} onOpenMap={() => navigation.navigate('TerritoryMap', { clubId, clubName })} />
      )}

      {tab === 'members' && (
        <ClubMembersTab
          loading={data.membersLoading} members={data.members}
          isModerator={mod.isModerator} isOwner={mod.isOwner} currentUserId={currentUserId}
          canRemove={mod.canRemove} onOpenProfile={openProfile} onRemove={mod.confirmRemove} onLeave={mod.confirmLeave}
        />
      )}

      {tab === 'leaderboard' && (
        <ClubLeaderboardTab loading={data.leaderboardLoading} leaderboard={data.leaderboard} onOpenProfile={openProfile} />
      )}

      {tab === 'activity' && (
        <ClubActivityTab
          loading={data.activityLoading} activity={data.activity} clubPosts={data.clubPosts} currentUserId={currentUserId}
          onKudos={data.kudos} onComment={data.setCommentPostId} onOpenProfile={openProfile} onDeletePost={data.deleteClubPost}
        />
      )}

      {tab === 'admin' && (
        <ClubAdminTab
          clubName={clubName} media={media} onChangeMedia={session.changeMedia}
          description={desc.description} onChangeDescription={desc.setDescription}
          savingDescription={desc.savingDesc} onSaveDescription={desc.handleSaveDesc}
          reports={data.reports}
          canRemoveAuthor={id => mod.canRemove(id, data.members.find(x => x.id === id)?.role)}
          onDeleteMessage={mod.confirmDeleteMessage} onRemoveMember={mod.confirmRemove}
          requestsLoading={data.requestsLoading} joinRequests={data.joinRequests}
          onApprove={data.handleApprove} onReject={data.handleReject}
          isOwner={mod.isOwner} onDeleteClub={mod.confirmDelete}
        />
      )}

      <CommentSheet postId={data.commentPostId} onClose={() => data.setCommentPostId(null)} onCommentPosted={data.onCommentPosted} />
    </SafeAreaView>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({
    root:        { flex: 1, backgroundColor: C.bg },
    backHome:    { paddingHorizontal: 20, paddingBottom: 6 },
    backHomeTxt: { fontFamily: Fonts.medium, fontSize: 14, color: C.t2 },
  });
}
