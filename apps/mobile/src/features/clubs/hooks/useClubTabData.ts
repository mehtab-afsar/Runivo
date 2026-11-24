import { useState, useEffect, useCallback } from 'react';
import {
  fetchClubMembers,
  fetchClubActivity,
  fetchJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
  fetchClubReports,
  type ChatReport,
} from '@features/clubs/services/clubService';
import type { ClubMember, ActivityItem, JoinRequest } from '@features/clubs/types';
import { fetchClubFeed, toggleLike, deletePost } from '@features/social/services/feedService';
import type { FeedPost } from '@features/social/types';
import type { DetailTab } from '../utils/clubDetailFormatters';

/** The lists behind the Members, Board, Activity and Admin tabs, loaded when their tab opens. */
export function useClubTabData(clubId: string, tab: DetailTab) {
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
  const [reports, setReports] = useState<ChatReport[]>([]);

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

  const deleteClubPost = (postId: string) => {
    setClubPosts(ps => ps.filter(x => x.id !== postId));
    deletePost(postId).catch(() => loadActivity());
  };

  const onCommentPosted = () => setClubPosts(ps => ps.map(p => p.id === commentPostId ? { ...p, commentCount: p.commentCount + 1 } : p));

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

  return {
    members, setMembers, membersLoading, loadMembers,
    leaderboard, setLeaderboard, leaderboardLoading,
    activity, activityLoading, clubPosts, kudos, deleteClubPost,
    commentPostId, setCommentPostId, onCommentPosted,
    joinRequests, requestsLoading, handleApprove, handleReject,
    reports, setReports,
  };
}
