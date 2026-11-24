import { useState, useEffect } from 'react';
import { appAlert } from '@mobile/shared/components/AppAlert';
import { supabase } from '@shared/services/supabase';
import { useLobbyChat } from '@features/clubs/hooks/useLobbyChat';
import {
  fetchClubSummary,
  fetchClubMedia,
  fetchClubOwnerId,
  getOrCreateClubLobby,
  uploadClubImage,
} from '@features/clubs/services/clubService';
import type { ClubRole } from '../utils/clubDetailFormatters';

/** What ClubDetail reads from its route: a club link carries only the id (and maybe an invite). */
export interface ClubDetailParams {
  clubId: string;
  clubName?: string;
  memberCount?: number;
  totalKm?: number;
  description?: string;
  compose?: boolean;
  invite?: string;
}

export type ClubSummary = Awaited<ReturnType<typeof fetchClubSummary>>;
export type ClubMedia = { avatar: string | null; banner: string | null };

/** Who is looking at the club, the club's identity, its media and its chat room. */
export function useClubSession(params: ClubDetailParams) {
  const { clubId, clubName: paramName, memberCount: paramMembers, totalKm: paramKm } = params;
  const [summary, setSummary] = useState<ClubSummary>(null);
  useEffect(() => { fetchClubSummary(clubId).then(setSummary).catch(() => {}); }, [clubId]);
  const clubName: string = paramName ?? summary?.name ?? 'Club';
  const memberCount: number = summary?.memberCount ?? paramMembers ?? 0;
  const totalKm: number = summary?.totalKm ?? paramKm ?? 0;
  const [memberChecked, setMemberChecked] = useState(false);
  const [media, setMedia] = useState<ClubMedia>({ avatar: null, banner: null });
  const changeMedia = async (kind: 'avatar' | 'banner', uri: string) => {
    setMedia(m => ({ ...m, [kind]: uri }));
    try { const url = await uploadClubImage(clubId, kind, uri); setMedia(m => ({ ...m, [kind]: url })); }
    catch (e) { appAlert("Couldn't change it", e instanceof Error ? e.message : 'Try again.'); fetchClubMedia(clubId).then(setMedia).catch(() => {}); }
  };
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<ClubRole | null>(null);
  const [clubLobbyId, setClubLobbyId] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);

  // Resolves to '' until the club's lobby id loads — useLobbyChat's fetch/subscribe
  // are harmless no-ops against an empty id (no row can match) until then.
  const chat = useLobbyChat(clubLobbyId ?? '');

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
      if (data) setCurrentUserRole(data.role as ClubRole);
      setMemberChecked(true);
      fetchClubOwnerId(clubId).then(setOwnerId).catch(() => {});
      fetchClubMedia(clubId).then(setMedia).catch(() => {});

      const lobbyId = await getOrCreateClubLobby(clubId, clubName, user.id);
      setClubLobbyId(lobbyId);
    });
  }, [clubId, clubName]);

  return {
    summary, clubName, memberCount, totalKm, memberChecked,
    media, changeMedia,
    currentUserId, currentUserRole, setCurrentUserRole, ownerId,
    chat,
  };
}
