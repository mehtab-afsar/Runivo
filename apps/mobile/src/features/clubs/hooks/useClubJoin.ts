import { useState, useCallback } from 'react';
import { Share } from 'react-native';
import { appAlert } from '@mobile/shared/components/AppAlert';
import {
  fetchClubInviteCode,
  clubLinks,
  joinClubWithInvite,
  joinClub,
  requestToJoinClub,
} from '@features/clubs/services/clubService';
import type { ClubRole } from '../utils/clubDetailFormatters';

interface Args {
  clubId: string;
  clubName: string;
  invite: string | undefined;
  currentUserId: string | null;
  joinPolicy: 'open' | 'invite_only' | undefined;
  setCurrentUserRole: (role: ClubRole) => void;
}

/** Invite others to the club, and join it from a link when not a member yet. */
export function useClubJoin({ clubId, clubName, invite, currentUserId, joinPolicy, setCurrentUserRole }: Args) {
  const [joining, setJoining] = useState(false);

  // Members share a link that opens this club and joins it (invite-only clubs too).
  const inviteToClub = async () => {
    const pitch = `Join ${clubName} on Runivo: we run together and hold ground together.`;
    try {
      const links = clubLinks(clubId, await fetchClubInviteCode(clubId));
      await Share.share({ message: `${pitch}\n${links.web}\n\nAlready have the app? ${links.app}`, url: links.web });
    } catch {
      // Not a member (or offline): no code to hand out.
      Share.share({ message: `${pitch} Get the app at https://runivo.in/invite and search for "${clubName}".` }).catch(() => {});
    }
  };

  // Opened from a link and not a member yet: join with the invite, or the usual way.
  const joinFromHere = useCallback(async () => {
    if (!currentUserId || joining) return;
    setJoining(true);
    try {
      if (invite) {
        const r = await joinClubWithInvite(clubId, String(invite));
        if (r === 'joined' || r === 'already') setCurrentUserRole('member');
        else appAlert(r === 'banned' ? "You can't join this club" : 'This invite no longer works', r === 'banned' ? 'An admin removed you from it.' : 'Ask for a new link.');
      } else if (joinPolicy === 'invite_only') {
        const { ok } = await requestToJoinClub(clubId, currentUserId);
        appAlert(ok ? 'Request sent' : "Couldn't send the request", ok ? 'The club owner will review it.' : 'Try again.');
      } else {
        const { error } = await joinClub(clubId, currentUserId);
        if (error) appAlert("Couldn't join", 'Check your connection and try again.');
        else setCurrentUserRole('member');
      }
    } catch { appAlert("Couldn't join", 'Check your connection and try again.'); }
    finally { setJoining(false); }
  }, [clubId, currentUserId, invite, joining, joinPolicy, setCurrentUserRole]);

  return { joining, inviteToClub, joinFromHere };
}
