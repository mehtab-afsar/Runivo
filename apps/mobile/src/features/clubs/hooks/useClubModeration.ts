import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { appAlert } from '@mobile/shared/components/AppAlert';
import {
  reportClubMessage,
  deleteClubMessage,
  deleteClub,
  leaveClub,
  removeClubMember,
  type ChatReport,
  type ChatReportReason,
} from '@features/clubs/services/clubService';
import type { LobbyMessage } from '@features/clubs/services/lobbyChatService';
import type { ClubMember } from '@features/clubs/types';
import { blockUser } from '@mobile/shared/services/safetyService';
import type { ClubRole } from '../utils/clubDetailFormatters';

interface Args {
  clubId: string;
  clubName: string;
  currentUserId: string | null;
  currentUserRole: ClubRole | null;
  ownerId: string | null;
  members: ClubMember[];
  loadMembers: () => Promise<void>;
  setMembers: Dispatch<SetStateAction<ClubMember[]>>;
  setLeaderboard: Dispatch<SetStateAction<ClubMember[]>>;
  setReports: Dispatch<SetStateAction<ChatReport[]>>;
  removeMessage: (id: string) => void;
  removeMessagesFrom: (userId: string) => void;
  /** Leave the screen once the club is left or deleted. */
  onExit: () => void;
}

/** Leave / delete the club, and the chat moderation menu (report, block, delete, remove). */
export function useClubModeration(a: Args) {
  const { clubId, clubName, currentUserId, currentUserRole, ownerId, members, loadMembers } = a;

  // ── Leave / delete ──────────────────────────────────────────────────────
  const confirmLeave = () => {
    appAlert(`Leave ${clubName}?`, 'You can join again later.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: async () => {
        const { error, result } = await leaveClub(clubId);
        if (result === 'owner') { appAlert('You own this club', 'Owners can’t leave. Delete the club from the Admin tab instead.'); return; }
        if (error) { appAlert("Couldn't leave the club", 'Check your connection and try again.'); return; }
        a.onExit();
      } },
    ]);
  };
  const confirmDelete = () => {
    appAlert(`Delete ${clubName}?`, 'This removes the club, its chat and its upcoming club runs for everyone. Members are told. You can’t undo this.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete club', style: 'destructive', onPress: async () => {
        try {
          const r = await deleteClub(clubId);
          if (r === 'not_owner') { appAlert('Only the owner can delete the club'); return; }
          a.onExit();
        } catch { appAlert("Couldn't delete the club", 'Check your connection and try again.'); }
      } },
    ]);
  };

  // ── Moderation ──────────────────────────────────────────────────────────
  const isModerator = currentUserRole === 'admin' || (!!ownerId && ownerId === currentUserId);
  const isOwner = !!ownerId && ownerId === currentUserId;
  // Moderators need roles in chat (who can be removed) before opening the Members tab.
  useEffect(() => { if (isModerator) loadMembers(); }, [isModerator, loadMembers]);
  const canRemove = (userId: string, role?: string) =>
    isModerator && userId !== currentUserId && userId !== ownerId && (role !== 'admin' || isOwner);

  const confirmRemove = (userId: string, username: string) => {
    appAlert(
      `Remove ${username}?`,
      `They leave ${clubName} and can't rejoin unless an admin lets them back.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive', onPress: async () => {
            try {
              await removeClubMember(clubId, userId);
              a.setMembers(m => m.filter(x => x.id !== userId));
              a.setLeaderboard(m => m.filter(x => x.id !== userId));
              a.setReports(r => r.filter(x => x.authorId !== userId));
            } catch (e) {
              appAlert("Couldn't remove", e instanceof Error ? e.message : 'Try again.');
            }
          },
        },
      ],
    );
  };

  const confirmDeleteMessage = (id: string) => {
    appAlert('Delete this message?', 'It is removed for everyone in the club.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deleteClubMessage(id);
            a.removeMessage(id);
            a.setReports(r => r.filter(x => x.messageId !== id));
          } catch {
            appAlert("Couldn't delete", 'Check your connection and try again.');
          }
        },
      },
    ]);
  };

  const reportMessage = (id: string) => {
    const send = async (reason: ChatReportReason) => {
      try {
        await reportClubMessage(id, reason);
        appAlert('Thanks for reporting', "The club's admins will review it.");
      } catch (e) {
        appAlert("Couldn't report", e instanceof Error && e.message.includes('too many') ? 'You have sent a lot of reports today. Try again tomorrow.' : 'Try again.');
      }
    };
    appAlert('Report message', 'Why are you reporting it?', [
      { text: 'Spam', onPress: () => send('spam') },
      { text: 'Harassment', onPress: () => send('harassment') },
      { text: 'Inappropriate', onPress: () => send('inappropriate') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const messageOptions = (m: LobbyMessage) => {
    if (m.userId === currentUserId) {
      appAlert('Your message', undefined, [
        { text: 'Delete', style: 'destructive', onPress: () => confirmDeleteMessage(m.id) },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    const role = members.find(x => x.id === m.userId)?.role;
    const buttons: Parameters<typeof appAlert>[2] = [
      { text: 'Report message', onPress: () => reportMessage(m.id) },
      { text: `Block ${m.userName}`, style: 'destructive', onPress: () => {
        appAlert(`Block ${m.userName}?`, "You won't see their messages or posts, and they won't see yours.", [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Block', style: 'destructive', onPress: async () => {
            try { await blockUser(m.userId); a.removeMessagesFrom(m.userId); }
            catch { appAlert("Couldn't block", 'Check your connection and try again.'); }
          } },
        ]);
      } },
    ];
    if (isModerator) buttons.push({ text: 'Delete message', style: 'destructive', onPress: () => confirmDeleteMessage(m.id) });
    if (canRemove(m.userId, role)) buttons.push({ text: `Remove ${m.userName}`, style: 'destructive', onPress: () => confirmRemove(m.userId, m.userName) });
    buttons.push({ text: 'Cancel', style: 'cancel' });
    appAlert(m.userName, m.message.length > 80 ? `${m.message.slice(0, 80)}…` : m.message, buttons);
  };

  return { isModerator, isOwner, canRemove, confirmLeave, confirmDelete, confirmRemove, confirmDeleteMessage, messageOptions };
}
