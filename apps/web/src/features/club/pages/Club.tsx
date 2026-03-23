import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, ChevronLeft, Send,
  Users, MapPin, X, UserPlus, LogOut, MoreVertical,
  Search, TrendingUp, Link2, Bell, BellOff,
  Check, CheckCheck, Image, FileText,
  Globe, Flag, MessageCircle, Award,
  Plus, ChevronRight, ArrowLeft,
} from 'lucide-react';
import { haptic } from '@shared/lib/haptics';
import { useNavVisibility } from '@/shared/hooks/useNavVisibility';
import { CreateClubModal } from '@features/club/components/CreateClubModal';
import { supabase } from '@shared/services/supabase';
import {
  fetchClubMessages,
  sendClubMessage,
  subscribeToClubChat,
  submitJoinRequest,
  joinClub,
  leaveClub,
  type ClubChatMessage,
} from '@features/club/services/clubService';
import { T, F, FD } from '@shared/design-system/tokens';

// --- Design Tokens ---

const redBo = 'rgba(217,53,24,0.2)';

// --- Types ---

interface Member {
  id: string;
  name: string;
  level: number;
  status: 'online' | 'offline' | 'running';
  territories: number;
  role: 'leader' | 'admin' | 'member';
}

interface ClubData {
  id: string;
  name: string;
  level: number;
  memberCount: number;
  rank: number;
  badge: string;
  totalTerritories: number;
  weeklyRuns: number;
  clubStreak: number;
  dailyIncome: number;
  description: string;
  createdBy: string;
  createdAt: string;
}

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: string;
  date?: string;
  type: 'message' | 'activity';
  status?: 'sent' | 'delivered' | 'read';
}

interface ActivityItem {
  id: string;
  userId: string;
  userName: string;
  action: 'captured' | 'lost' | 'defended' | 'joined' | 'leveled_up';
  detail: string;
  time: string;
}

type JoinPolicy = 'open' | 'request' | 'invite-only';

interface ClubJoinRow {
  id: string; name: string; description: string | null; badge_emoji: string;
  owner_id: string; member_count: number; total_km: number; created_at: string;
}

interface RankedClubRow {
  id: string; name: string; description: string | null;
  badge_emoji: string; member_count: number; total_km: number;
}
type RankingScope = 'local' | 'national' | 'international';

interface RankedClub {
  id: string;
  name: string;
  rank: number;
  territories: number;
  members: number;
  streak: number;
  badge: string;
  weeklyGain: number;
  weeklyRuns: number;
  region: string;
  country: string;
  joinPolicy: JoinPolicy;
  description: string;
  topMembers: { name: string; level: number }[];
}

type ClubTab = 'rankings' | 'my-clubs';
type ClubView = 'main' | 'chat' | 'profile';
type SheetStep = 'preview' | 'message' | 'confirmed';


// --- Helpers ---

const avatarBgColors = [
  '#E8435A', '#7C3AED', '#2563EB', '#DB2777', '#D97706', '#059669',
];

const getAvatarBg = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarBgColors[Math.abs(hash) % avatarBgColors.length];
};

const scopeLabels: Record<RankingScope, { label: string; icon: typeof MapPin; heading: string }> = {
  local: { label: 'Local', icon: MapPin, heading: 'Top Clubs in New York' },
  national: { label: 'National', icon: Flag, heading: 'Top Clubs in US' },
  international: { label: 'International', icon: Globe, heading: 'Top Clubs Worldwide' },
};

const actionLabels: Record<string, string> = {
  captured: 'Captured',
  lost: 'Lost',
  defended: 'Defended',
  joined: 'Joined',
  leveled_up: 'Leveled Up',
};

// --- Main Component ---

export default function Club() {
  const { setNavVisible } = useNavVisibility();
  const [activeTab, setActiveTab] = useState<ClubTab>('my-clubs');
  const [view, setView] = useState<ClubView>('main');
  const [selectedClub, setSelectedClub] = useState<ClubData | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [muted, setMuted] = useState(false);

  // Live club data from Supabase
  const [myClubsData, setMyClubsData] = useState<ClubData[]>([]);
  const [clubsLoading, setClubsLoading] = useState(true);
  const [rankedClubs, setRankedClubs] = useState<RankedClub[]>([]);
  const [rankingsLoading, setRankingsLoading] = useState(true);

  useEffect(() => {
    loadMyClubs();
    loadRankings();
  }, []);

  // Realtime: keep member count live when viewing a club
  useEffect(() => {
    if (!selectedClub) return;

    const channel = supabase
      .channel(`club-members-${selectedClub.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'club_members',
          filter: `club_id=eq.${selectedClub.id}`,
        },
        () => {
          // Re-fetch member count on any INSERT/DELETE/UPDATE
          supabase
            .from('clubs')
            .select('member_count')
            .eq('id', selectedClub.id)
            .single()
            .then(({ data }) => {
              if (data) {
                setSelectedClub(prev => prev ? { ...prev, memberCount: data.member_count } : prev);
                setMyClubsData(prev =>
                  prev.map(c => c.id === selectedClub.id ? { ...c, memberCount: data.member_count } : c)
                );
              }
            });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedClub?.id]);

  const loadMyClubs = async () => {
    setClubsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setClubsLoading(false); return; }

    const { data: memberships } = await supabase
      .from('club_members')
      .select('club_id, role, clubs(id, name, description, badge_emoji, owner_id, member_count, total_km, created_at)')
      .eq('user_id', user.id);

    const clubs: ClubData[] = (memberships ?? []).map(m => {
      const c = m.clubs as unknown as ClubJoinRow;
      return {
        id: c.id,
        name: c.name,
        level: 1,
        memberCount: c.member_count,
        rank: 0,
        badge: c.badge_emoji ?? 'zap',
        totalTerritories: 0,
        weeklyRuns: 0,
        clubStreak: 0,
        dailyIncome: 0,
        description: c.description ?? '',
        createdBy: '',
        createdAt: new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      };
    });

    setMyClubsData(clubs);
    setClubsLoading(false);
  };

  const loadRankings = async () => {
    setRankingsLoading(true);
    const { data } = await supabase
      .from('clubs')
      .select('id, name, description, badge_emoji, member_count, total_km')
      .order('member_count', { ascending: false })
      .limit(20);

    const clubs: RankedClub[] = (data ?? [] as RankedClubRow[]).map((c: RankedClubRow, i: number) => ({
      id: c.id,
      name: c.name,
      rank: i + 1,
      territories: 0,
      members: c.member_count ?? 0,
      streak: 0,
      badge: 'zap',
      weeklyGain: 0,
      weeklyRuns: 0,
      region: 'Global',
      country: '',
      joinPolicy: 'open' as JoinPolicy,
      description: c.description ?? '',
      topMembers: [],
    }));
    setRankedClubs(clubs);
    setRankingsLoading(false);
  };

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [chatHeight, setChatHeight] = useState<string | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const currentUserIdRef = useRef<string | null>(null);

  // Resolve current user ID once on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      currentUserIdRef.current = user?.id ?? null;
    });
  }, []);

  // Rankings state
  const [rankingScope, setRankingScope] = useState<RankingScope>('local');
  const [previewClub, setPreviewClub] = useState<RankedClub | null>(null);
  const [joinRequests, setJoinRequests] = useState<Record<string, 'pending' | 'joined'>>({});
  const [requestMessage, setRequestMessage] = useState('');
  const [sheetStep, setSheetStep] = useState<SheetStep>('preview');
  const [rankingSearch, setRankingSearch] = useState('');

  const activeRankedClubs = rankedClubs;

  const filteredRankedClubs = rankingSearch
    ? activeRankedClubs.filter(c => c.name.toLowerCase().includes(rankingSearch.toLowerCase()))
    : null;

  // Hide bottom nav when in chat view
  useEffect(() => {
    setNavVisible(view !== 'chat');
    return () => setNavVisible(true);
  }, [view, setNavVisible]);

  useEffect(() => {
    if (view === 'chat') {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [view]);

  // Shrink chat to visual viewport height so keyboard doesn't hide the input on iOS
  useEffect(() => {
    if (view !== 'chat') { setChatHeight(undefined); return; }
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setChatHeight(`${vv.height}px`);
    vv.addEventListener('resize', update);
    update();
    return () => vv.removeEventListener('resize', update);
  }, [view]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Auto-dismiss confirmed step
  useEffect(() => {
    if (sheetStep === 'confirmed') {
      const timer = setTimeout(() => {
        setPreviewClub(null);
        setSheetStep('preview');
        setRequestMessage('');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [sheetStep]);

  const handleOpenChat = async (club: ClubData) => {
    setSelectedClub(club);
    setChatMessages([]);
    setChatLoading(true);
    setView('chat');
    haptic('light');

    try {
      const msgs = await fetchClubMessages(club.id, 60);
      setChatMessages(msgs.map((m: ClubChatMessage) => ({
        id: m.id,
        userId: m.userId,
        userName: m.userName,
        message: m.message,
        timestamp: new Date(m.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        type: 'message' as const,
        status: 'read' as const,
      })));
    } catch {
      // Offline — show empty chat
    } finally {
      setChatLoading(false);
    }

    // Subscribe to new incoming messages
    unsubscribeRef.current?.();
    unsubscribeRef.current = subscribeToClubChat(club.id, (newMsg: ClubChatMessage) => {
      setChatMessages(prev => {
        if (prev.some(m => m.id === newMsg.id)) return prev;
        return [...prev, {
          id: newMsg.id,
          userId: newMsg.userId,
          userName: newMsg.userName,
          message: newMsg.message,
          timestamp: new Date(newMsg.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          type: 'message' as const,
          status: 'delivered' as const,
        }];
      });
    });
  };

  const handleOpenProfile = () => {
    setView('profile');
    setShowDropdown(false);
    haptic('light');
  };

  const handleBackToMain = () => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    setView('main');
    setSelectedClub(null);
    setChatMessages([]);
    setMessageInput('');
    setShowDropdown(false);
    haptic('light');
  };

  const handleBackFromProfile = () => {
    setView('chat');
    setShowDropdown(false);
    haptic('light');
  };

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedClub) return;
    const content = messageInput.trim();
    const optimisticId = `opt-${Date.now()}`;

    const optimisticMsg: ChatMessage = {
      id: optimisticId,
      userId: currentUserIdRef.current ?? 'me',
      userName: 'You',
      message: content,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      type: 'message',
      status: 'sent',
    };
    setChatMessages(prev => [...prev, optimisticMsg]);
    setMessageInput('');
    haptic('light');

    sendClubMessage(selectedClub.id, content)
      .then(() => {
        setChatMessages(prev =>
          prev.map(m => m.id === optimisticId ? { ...m, status: 'delivered' } : m)
        );
      })
      .catch(() => {
        setChatMessages(prev => prev.filter(m => m.id !== optimisticId));
      });
  };

  const handleCreateClub = async (data: { name: string; logoUrl: string; description: string }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: club } = await supabase
      .from('clubs')
      .insert({ name: data.name, description: data.description, owner_id: user.id, badge_emoji: '🏃' })
      .select()
      .single();
    if (club) {
      await supabase.from('club_members').insert({ club_id: club.id, user_id: user.id, role: 'owner' });
      await loadMyClubs();
    }
    setShowCreateModal(false);
  };

  const handleClubTap = (club: RankedClub) => {
    setPreviewClub(club);
    setSheetStep('preview');
    setRequestMessage('');
    haptic('light');
  };

  const handleJoinAction = async (club: RankedClub) => {
    if (club.joinPolicy === 'open') {
      haptic('medium');
      try {
        await joinClub(club.id);
        setJoinRequests(prev => ({ ...prev, [club.id]: 'joined' }));
        await loadMyClubs();
      } catch {
        setJoinRequests(prev => ({ ...prev, [club.id]: 'joined' }));
      }
      setSheetStep('confirmed');
    } else if (club.joinPolicy === 'request') {
      setSheetStep('message');
      haptic('light');
    }
  };

  const handleSendRequest = async () => {
    if (!previewClub) return;
    haptic('medium');
    try {
      await submitJoinRequest(previewClub.id, requestMessage.trim() || undefined);
    } catch {
      // Non-fatal
    }
    setJoinRequests(prev => ({ ...prev, [previewClub.id]: 'pending' }));
    setSheetStep('confirmed');
  };

  const getJoinButtonState = (club: RankedClub) => {
    const status = joinRequests[club.id];
    if (status === 'joined') return { label: 'Joined', disabled: true };
    if (status === 'pending') return { label: 'Requested', disabled: true };
    if (club.joinPolicy === 'open') return { label: 'Join Club', disabled: false };
    if (club.joinPolicy === 'request') return { label: 'Request to Join', disabled: false };
    return { label: 'Invite Only', disabled: true };
  };

  const isOwnMessage = (msg: ChatMessage) =>
    !!currentUserIdRef.current && msg.userId === currentUserIdRef.current;

  // =============================================
  // CHAT VIEW
  // =============================================
  if (view === 'chat' && selectedClub) {
    const onlineMembers: Member[] = [];
    let lastDate = '';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', background: T.bg, height: chatHeight ?? '100%', position: 'relative' }}>
        {/* Chat Header */}
        <div style={{
          background: T.white,
          padding: '12px 16px',
          borderBottom: `0.5px solid ${T.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          paddingTop: 'max(12px, env(safe-area-inset-top))',
          position: 'relative',
          zIndex: 10,
        }}>
          <button
            onClick={handleBackToMain}
            style={{
              width: 26, height: 26, borderRadius: '50%',
              background: T.bg, border: `0.5px solid ${T.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <ChevronLeft size={12} color={T.t2} />
          </button>

          <button
            onClick={handleOpenProfile}
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: getAvatarBg(selectedClub.name),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, flexShrink: 0, border: 'none', cursor: 'pointer',
            }}
          >
            🏃
          </button>

          <button
            onClick={handleOpenProfile}
            style={{ flex: 1, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', minWidth: 0 }}
          >
            <div style={{ fontSize: 13, fontWeight: 500, color: T.black, fontFamily: F, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedClub.name}
            </div>
            <div style={{ fontSize: 10, fontWeight: 300, color: T.green, fontFamily: F }}>
              {onlineMembers.length} online
            </div>
          </button>

          <button
            onClick={() => { setShowDropdown(!showDropdown); haptic('light'); }}
            style={{
              width: 26, height: 26, borderRadius: '50%',
              background: T.bg, border: `0.5px solid ${T.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <MoreVertical size={12} color={T.t2} />
          </button>

          {/* Dropdown */}
          <AnimatePresence>
            {showDropdown && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: 'absolute', right: 14, top: '100%', marginTop: 4,
                  background: T.white, borderRadius: 12, border: `0.5px solid ${T.border}`,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 50,
                  minWidth: 180, overflow: 'hidden',
                }}
              >
                {[
                  { label: 'Group info', action: () => handleOpenProfile() },
                  { label: muted ? 'Unmute notifications' : 'Mute notifications', action: () => { setMuted(!muted); setShowDropdown(false); haptic('light'); } },
                  { label: 'Search', action: () => setShowDropdown(false) },
                ].map((item, i) => (
                  <button
                    key={i}
                    onClick={item.action}
                    style={{
                      width: '100%', textAlign: 'left', padding: '10px 16px',
                      fontSize: 13, color: T.black, fontFamily: F,
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      display: 'block',
                      borderBottom: i < 2 ? `0.5px solid ${T.mid}` : 'none',
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {showDropdown && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowDropdown(false)} />
        )}

        {/* Messages Area */}
        <div
          style={{
            flex: 1, overflowY: 'auto', background: T.bg,
            padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8,
          }}
          onClick={() => setShowDropdown(false)}
        >
          {chatLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 4px' }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{ display: 'flex', justifyContent: i % 2 === 0 ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    height: 40, borderRadius: 16,
                    background: T.mid, width: i % 2 === 0 ? 160 : 208,
                    animation: 'pulse 1.5s infinite',
                  }} />
                </div>
              ))}
            </div>
          ) : chatMessages.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 8, padding: '48px 0' }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: T.mid, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4,
              }}>
                <MessageCircle size={24} color={T.t3} />
              </div>
              <p style={{ fontSize: 13, fontWeight: 500, color: T.t3, fontFamily: F }}>No messages yet</p>
              <p style={{ fontSize: 11, fontWeight: 300, color: T.t3, fontFamily: F }}>Be the first to say something!</p>
            </div>
          ) : null}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {chatMessages.map((msg) => {
              const showDate = msg.date && msg.date !== lastDate;
              if (msg.date) lastDate = msg.date;
              const own = isOwnMessage(msg);

              return (
                <div key={msg.id}>
                  {showDate && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0' }}>
                      <div style={{ flex: 1, height: '0.5px', background: T.mid }} />
                      <span style={{
                        fontSize: 9, fontWeight: 400, color: T.t3, fontFamily: F,
                        textTransform: 'uppercase' as const, letterSpacing: '0.08em', whiteSpace: 'nowrap',
                      }}>{msg.date}</span>
                      <div style={{ flex: 1, height: '0.5px', background: T.mid }} />
                    </div>
                  )}

                  {msg.type === 'activity' ? (
                    <div style={{ alignSelf: 'center', display: 'flex', justifyContent: 'center', margin: '4px 0' }}>
                      <span style={{
                        background: 'rgba(217,53,24,0.06)', border: '0.5px solid rgba(217,53,24,0.15)',
                        borderRadius: 6, padding: '5px 10px', fontSize: 10, fontWeight: 300,
                        color: T.red, fontFamily: F, textAlign: 'center' as const,
                      }}>{msg.message}</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignSelf: own ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                      {!own && (
                        <div style={{ fontSize: 9, fontWeight: 400, color: T.t3, fontFamily: F, marginBottom: 3 }}>
                          {msg.userName}
                        </div>
                      )}
                      <div style={{
                        background: own ? T.black : T.white,
                        border: own ? 'none' : `0.5px solid ${T.border}`,
                        borderRadius: own ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                        padding: '8px 11px',
                        fontSize: 12, fontWeight: 300,
                        color: own ? T.white : T.black,
                        fontFamily: F,
                      }}>
                        {msg.message}
                      </div>
                      <div style={{
                        fontSize: 8, fontWeight: 300, color: T.t3, fontFamily: F,
                        marginTop: 2, textAlign: own ? 'right' as const : 'left' as const,
                        display: 'flex', alignItems: 'center', gap: 2,
                        justifyContent: own ? 'flex-end' : 'flex-start',
                      }}>
                        <span>{msg.timestamp}</span>
                        {own && msg.status && (
                          msg.status === 'read' ? (
                            <CheckCheck size={10} color={T.t3} />
                          ) : msg.status === 'delivered' ? (
                            <CheckCheck size={10} color={T.t3} />
                          ) : (
                            <Check size={10} color={T.t3} />
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Bar */}
        <div style={{
          background: T.white,
          borderTop: `0.5px solid ${T.border}`,
          padding: '10px 14px',
          paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
          display: 'flex', gap: 8, alignItems: 'center',
        }}>
          <input
            ref={inputRef}
            type="text"
            value={messageInput}
            onChange={e => setMessageInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
            placeholder="Type a message..."
            style={{
              flex: 1, background: T.bg, border: `0.5px solid ${T.border}`,
              borderRadius: 20, padding: '8px 12px',
              fontSize: 12, fontWeight: 300, color: T.black,
              fontFamily: F, outline: 'none',
            }}
          />
          <button
            onClick={handleSendMessage}
            disabled={!messageInput.trim()}
            style={{
              width: 32, height: 32, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', cursor: messageInput.trim() ? 'pointer' : 'default',
              background: messageInput.trim() ? T.black : T.mid,
              flexShrink: 0,
            }}
          >
            <Send size={14} color={messageInput.trim() ? T.white : T.t3} />
          </button>
        </div>
      </div>
    );
  }

  // =============================================
  // CLUB PROFILE VIEW
  // =============================================
  if (view === 'profile' && selectedClub) {
    const members: Member[] = [];
    const activities: ActivityItem[] = [];
    const sortedMembers = [...members].sort((a, b) => {
      const order = { leader: 0, admin: 1, member: 2 };
      return order[a.role] - order[b.role];
    });

    const statusDotColor: Record<string, string> = {
      online: '#22C55E',
      running: '#D93518',
      offline: '#D1D5DB',
    };

    const roleBgColor: Record<string, { bg: string; color: string }> = {
      leader: { bg: '#FDF6E8', color: '#9E6800' },
      admin: { bg: '#EFF6FF', color: '#1D4ED8' },
      member: { bg: 'transparent', color: 'transparent' },
    };

    return (
      <div style={{ height: '100%', background: T.bg, overflowY: 'auto' }}>
        {/* Header */}
        <div style={{
          background: T.white, borderBottom: `0.5px solid ${T.border}`,
          paddingTop: 'max(8px, env(safe-area-inset-top))',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px' }}>
            <button
              onClick={handleBackFromProfile}
              style={{
                width: 26, height: 26, borderRadius: '50%', background: T.bg,
                border: `0.5px solid ${T.border}`, display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer',
              }}
            >
              <ArrowLeft size={14} color={T.t2} />
            </button>
            <span style={{ fontSize: 15, fontWeight: 600, color: T.black, fontFamily: F }}>Club Info</span>
          </div>
        </div>

        {/* Club avatar + name */}
        <div style={{ background: T.white, padding: '28px 20px 20px', textAlign: 'center' }}>
          <div style={{
            width: 80, height: 80, borderRadius: 20,
            background: getAvatarBg(selectedClub.name),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 40, margin: '0 auto 12px',
          }}>🏃</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: T.black, fontFamily: F, margin: '0 0 4px' }}>{selectedClub.name}</h2>
          <p style={{ fontSize: 13, color: T.t3, fontFamily: F, margin: 0 }}>Club · {selectedClub.memberCount} members</p>
        </div>

        {/* Stats row */}
        <div style={{ background: T.white, marginTop: 8, padding: '14px 16px', borderTop: `0.5px solid ${T.mid}`, borderBottom: `0.5px solid ${T.mid}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4 }}>
            {[
              { value: selectedClub.totalTerritories, label: 'Zones', color: T.red },
              { value: selectedClub.weeklyRuns, label: 'Runs/wk', color: T.black },
              { value: `${selectedClub.clubStreak}d`, label: 'Streak', color: '#EA580C' },
              { value: `#${selectedClub.rank}`, label: 'Rank', color: T.red },
            ].map((stat, i) => (
              <div key={i} style={{ textAlign: 'center', padding: '4px 0' }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: stat.color, fontFamily: F, display: 'block' }}>{stat.value}</span>
                <span style={{ fontSize: 10, color: T.t3, fontFamily: F, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Description */}
        <div style={{ background: T.white, marginTop: 8, padding: '16px 20px', borderTop: `0.5px solid ${T.mid}`, borderBottom: `0.5px solid ${T.mid}` }}>
          <p style={{ fontSize: 14, color: T.t2, fontFamily: F, lineHeight: 1.6, margin: '0 0 8px' }}>{selectedClub.description}</p>
          <p style={{ fontSize: 12, color: T.t3, fontFamily: F, margin: 0 }}>Created by {selectedClub.createdBy} on {selectedClub.createdAt}</p>
        </div>

        {/* Media, Links, Docs */}
        <div style={{ background: T.white, marginTop: 8, borderTop: `0.5px solid ${T.mid}`, borderBottom: `0.5px solid ${T.mid}` }}>
          <button style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 20px', background: 'transparent', border: 'none', cursor: 'pointer',
          }}>
            <span style={{ fontSize: 14, color: T.t2, fontFamily: F }}>Media, links and docs</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[Image, Link2, FileText].map((Icon, i) => (
                  <div key={i} style={{ width: 24, height: 24, borderRadius: 8, background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={12} color={T.t3} />
                  </div>
                ))}
              </div>
              <ChevronRight size={16} color={T.t3} />
            </div>
          </button>
        </div>

        {/* Mute */}
        <div style={{ background: T.white, marginTop: 8, borderTop: `0.5px solid ${T.mid}`, borderBottom: `0.5px solid ${T.mid}` }}>
          <button
            onClick={() => { setMuted(!muted); haptic('light'); }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 16,
              padding: '14px 20px', background: 'transparent', border: 'none', cursor: 'pointer',
            }}
          >
            {muted
              ? <BellOff size={20} color={T.t3} />
              : <Bell size={20} color={T.t3} />
            }
            <span style={{ flex: 1, fontSize: 14, color: T.t2, fontFamily: F, textAlign: 'left' as const }}>
              {muted ? 'Unmute notifications' : 'Mute notifications'}
            </span>
          </button>
        </div>

        {/* Members */}
        <div style={{ background: T.white, marginTop: 8, borderTop: `0.5px solid ${T.mid}`, borderBottom: `0.5px solid ${T.mid}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 8px' }}>
            <span style={{ fontSize: 13, color: T.t2, fontFamily: F, fontWeight: 500 }}>{members.length} members</span>
            <Search size={16} color={T.t3} />
          </div>

          <button style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 16,
            padding: '12px 20px', background: 'transparent', border: 'none', cursor: 'pointer',
            borderBottom: `0.5px solid ${T.mid}`,
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: T.redLo, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Link2 size={20} color={T.red} />
            </div>
            <span style={{ fontSize: 15, color: T.red, fontFamily: F, fontWeight: 500 }}>Invite via link</span>
          </button>

          <button style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 16,
            padding: '12px 20px', background: 'transparent', border: 'none', cursor: 'pointer',
            borderBottom: `0.5px solid ${T.mid}`,
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: T.redLo, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserPlus size={20} color={T.red} />
            </div>
            <span style={{ fontSize: 15, color: T.red, fontFamily: F, fontWeight: 500 }}>Add members</span>
          </button>

          {sortedMembers.map((member, i) => (
            <button
              key={member.id}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                padding: '10px 20px', background: 'transparent', border: 'none', cursor: 'pointer',
                borderBottom: i < sortedMembers.length - 1 ? `0.5px solid ${T.mid}` : 'none',
              }}
            >
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: getAvatarBg(member.name),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.white }}>{member.name.charAt(0)}</span>
                </div>
                {member.status !== 'offline' && (
                  <div style={{
                    position: 'absolute', bottom: -2, right: -2,
                    width: 12, height: 12, borderRadius: '50%',
                    border: `2px solid ${T.white}`,
                    background: statusDotColor[member.status],
                  }} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' as const }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: T.black, fontFamily: F, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.name}</span>
                  {member.role !== 'member' && (
                    <span style={{
                      fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                      background: roleBgColor[member.role].bg,
                      color: roleBgColor[member.role].color,
                      textTransform: 'uppercase' as const,
                    }}>{member.role}</span>
                  )}
                </div>
                <span style={{ fontSize: 12, color: T.t3, fontFamily: F }}>Lv.{member.level} · {member.territories} zones</span>
              </div>
            </button>
          ))}
        </div>

        {/* Live Activity */}
        <div style={{ background: T.white, marginTop: 8, borderTop: `0.5px solid ${T.mid}`, borderBottom: `0.5px solid ${T.mid}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 20px 8px' }}>
            <span style={{ fontSize: 13, color: T.t2, fontFamily: F, fontWeight: 500 }}>Recent activity</span>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E' }} />
          </div>
          {activities.slice(0, 4).map((activity) => (
            <div key={activity.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px' }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: T.redLo,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {activity.action === 'captured' && <MapPin size={16} color={T.red} />}
                {activity.action === 'lost' && <X size={16} color={T.red} />}
                {activity.action === 'defended' && <Shield size={16} color='#2563EB' />}
                {activity.action === 'joined' && <UserPlus size={16} color='#7C3AED' />}
                {activity.action === 'leveled_up' && <TrendingUp size={16} color={T.amber} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, color: T.t2, fontFamily: F, margin: 0 }}>
                  <span style={{ fontWeight: 600, color: T.black }}>{activity.userName}</span>
                  {' '}{actionLabels[activity.action].toLowerCase()}{' '}
                  <span style={{ fontWeight: 600, color: T.black }}>{activity.detail}</span>
                </p>
              </div>
              <span style={{ fontSize: 11, color: T.t3, fontFamily: F, flexShrink: 0 }}>{activity.time}</span>
            </div>
          ))}
        </div>

        {/* Exit group */}
        <div style={{ background: T.white, marginTop: 8, marginBottom: 32, borderTop: `0.5px solid ${T.mid}`, borderBottom: `0.5px solid ${T.mid}` }}>
          <button
            onClick={async () => {
              haptic('medium');
              if (selectedClub) {
                try { await leaveClub(selectedClub.id); } catch { /* non-fatal */ }
                await loadMyClubs();
              }
              handleBackToMain();
            }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 16,
              padding: '14px 20px', background: 'transparent', border: 'none', cursor: 'pointer',
            }}
          >
            <LogOut size={20} color={T.red} />
            <span style={{ fontSize: 15, color: T.red, fontFamily: F, fontWeight: 500 }}>Exit group</span>
          </button>
        </div>

        <div style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }} />
      </div>
    );
  }

  // =============================================
  // MAIN VIEW (Tabs)
  // =============================================
  return (
    <div style={{ height: '100%', background: T.bg, overflowY: 'auto', paddingBottom: 96 }}>
      {/* Header */}
      <div style={{
        background: T.white,
        paddingTop: 'max(14px, env(safe-area-inset-top))',
        borderBottom: `0.5px solid ${T.border}`,
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        {/* Top row */}
        <div style={{ padding: '0 18px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 20, fontStyle: 'italic', fontFamily: FD, color: T.black }}>Clubs</span>
          <div style={{ display: 'flex', flexDirection: 'row', gap: 8 }}>
            <button
              onClick={() => haptic('light')}
              style={{
                width: 28, height: 28, borderRadius: '50%', background: T.bg,
                border: `0.5px solid ${T.border}`, display: 'flex',
                alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}
            >
              <Search size={13} color={T.t3} />
            </button>
            <button
              onClick={() => { setShowCreateModal(true); haptic('light'); }}
              style={{
                width: 28, height: 28, borderRadius: '50%', background: T.bg,
                border: `0.5px solid ${T.border}`, display: 'flex',
                alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}
            >
              <Plus size={13} color={T.t3} />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderTop: `0.5px solid ${T.mid}` }}>
          {[
            { id: 'my-clubs' as ClubTab, label: 'My clubs' },
            { id: 'rankings' as ClubTab, label: 'Rankings' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); haptic('light'); }}
              style={{
                flex: 1, padding: '10px 0', textAlign: 'center' as const,
                fontSize: 11, fontFamily: F, cursor: 'pointer',
                border: 'none', background: 'transparent',
                fontWeight: activeTab === tab.id ? 500 : 400,
                color: activeTab === tab.id ? T.black : T.t3,
                borderBottom: activeTab === tab.id ? `1.5px solid ${T.black}` : '1.5px solid transparent',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* MY CLUBS TAB */}
      {activeTab === 'my-clubs' && (
        <div>
          {clubsLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid ${T.mid}`, borderTopColor: T.red }}
              />
            </div>
          ) : myClubsData.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 18px', gap: 8 }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: T.redLo, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                <Users size={28} color={T.red} />
              </div>
              <p style={{ fontSize: 13, fontWeight: 500, color: T.black, fontFamily: F, margin: 0 }}>No clubs yet</p>
              <p style={{ fontSize: 11, fontWeight: 300, color: T.t3, fontFamily: F, margin: 0 }}>Create a club to start</p>
              <button
                onClick={() => { setShowCreateModal(true); haptic('light'); }}
                style={{
                  marginTop: 8, background: T.black, color: T.white,
                  padding: '10px 20px', borderRadius: 4,
                  fontSize: 11, fontWeight: 500, fontFamily: F,
                  textTransform: 'uppercase' as const, letterSpacing: '0.06em',
                  border: 'none', cursor: 'pointer',
                }}
              >
                Create a club
              </button>
            </div>
          ) : (
            myClubsData.map(club => (
              <button
                key={club.id}
                onClick={() => handleOpenChat(club)}
                style={{
                  width: '100%', background: T.white, padding: '13px 18px',
                  borderBottom: `0.5px solid ${T.mid}`, display: 'flex',
                  flexDirection: 'row', gap: 12, alignItems: 'center',
                  border: 'none', borderBottomWidth: 0.5, borderBottomStyle: 'solid', borderBottomColor: T.mid,
                  cursor: 'pointer', textAlign: 'left' as const,
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 48, height: 48, borderRadius: 13,
                  background: getAvatarBg(club.name),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, flexShrink: 0,
                }}>🏃</div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Name + timestamp */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: T.black, fontFamily: F, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {club.name}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 300, color: T.t3, fontFamily: F, flexShrink: 0, marginLeft: 8 }}>
                      {club.createdAt}
                    </span>
                  </div>

                  {/* Meta row */}
                  <div style={{ fontSize: 10, fontWeight: 400, color: T.t3, fontFamily: F, marginBottom: 3 }}>
                    {club.memberCount} members · {club.totalTerritories} zones
                  </div>

                  {/* Last message preview + unread */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, fontWeight: 300, color: T.t3, fontFamily: F, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {club.description || 'Tap to open chat'}
                    </span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* RANKINGS TAB */}
      {activeTab === 'rankings' && (
        <div>
          {rankingsLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid ${T.mid}`, borderTopColor: T.red }}
              />
            </div>
          ) : (
            <>
              {/* Scope pills */}
              <div style={{
                display: 'flex', gap: 6, padding: '10px 18px',
                background: T.white, borderBottom: `0.5px solid ${T.border}`,
              }}>
                {(['local', 'national', 'international'] as RankingScope[]).map(scope => {
                  const { label, icon: ScopeIcon } = scopeLabels[scope];
                  const active = rankingScope === scope;
                  return (
                    <button
                      key={scope}
                      onClick={() => { setRankingScope(scope); setRankingSearch(''); haptic('light'); }}
                      style={{
                        padding: '6px 12px', borderRadius: 20,
                        border: `0.5px solid ${active ? redBo : T.border}`,
                        fontSize: 9, fontWeight: active ? 500 : 400,
                        fontFamily: F, cursor: 'pointer',
                        background: active ? T.redLo : T.bg,
                        color: active ? T.red : T.t3,
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}
                    >
                      <ScopeIcon size={10} />
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Search bar */}
              <div style={{
                margin: '10px 18px',
                background: T.bg, border: `0.5px solid ${T.border}`,
                borderRadius: 20, padding: '8px 14px',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <Search size={13} color={T.t3} />
                <input
                  type="text"
                  value={rankingSearch}
                  onChange={e => setRankingSearch(e.target.value)}
                  placeholder="Search clubs..."
                  style={{
                    flex: 1, background: 'transparent', border: 'none',
                    outline: 'none', fontSize: 12, fontFamily: F, color: T.black,
                  }}
                />
                {rankingSearch && (
                  <button
                    onClick={() => setRankingSearch('')}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }}
                  >
                    <X size={13} color={T.t3} />
                  </button>
                )}
              </div>

              {/* Search results */}
              {filteredRankedClubs !== null ? (
                filteredRankedClubs.length === 0 ? (
                  <div style={{ margin: '0 18px 16px', background: T.white, borderRadius: 8, border: `0.5px solid ${T.border}`, padding: '40px 20px', textAlign: 'center' as const }}>
                    <p style={{ fontSize: 14, color: T.t3, fontFamily: F }}>No clubs found for "{rankingSearch}"</p>
                  </div>
                ) : (
                  <div style={{ margin: '0 18px 16px', background: T.white, borderRadius: 8, border: `0.5px solid ${T.border}`, overflow: 'hidden' }}>
                    {filteredRankedClubs.map((club, i) => {
                      const status = joinRequests[club.id];
                      return (
                        <button
                          key={club.id}
                          onClick={() => handleClubTap(club)}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                            padding: '12px 16px', background: 'transparent',
                            border: 'none', borderBottom: i < filteredRankedClubs.length - 1 ? `0.5px solid ${T.mid}` : 'none',
                            cursor: 'pointer', textAlign: 'left' as const,
                          }}
                        >
                          <span style={{ fontSize: 13, fontWeight: 700, color: T.t3, fontFamily: F, width: 20, textAlign: 'center' as const }}>{club.rank}</span>
                          <div style={{
                            width: 40, height: 40, borderRadius: 8,
                            background: getAvatarBg(club.name),
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0,
                          }}>🏃</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 13, fontWeight: 500, color: T.black, fontFamily: F, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{club.name}</span>
                              {status && (
                                <span style={{
                                  fontSize: 9, fontWeight: 500, padding: '2px 6px', borderRadius: 10,
                                  background: status === 'joined' ? T.redLo : T.amberLo,
                                  color: status === 'joined' ? T.red : T.amber,
                                }}>{status === 'joined' ? 'Joined' : 'Pending'}</span>
                              )}
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 300, color: T.t3, fontFamily: F }}>{club.members} members · {club.region}</span>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 300, color: T.black, fontFamily: F }}>{club.territories} <span style={{ fontSize: 9, color: T.t3 }}>zones</span></span>
                        </button>
                      );
                    })}
                  </div>
                )
              ) : (
                <>
                  {/* Podium top 3 */}
                  <div style={{ margin: '0 18px 16px', background: T.black, borderRadius: 16, padding: '18px 16px 0', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18 }}>
                      <MapPin size={12} color='rgba(255,255,255,0.4)' />
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontFamily: F, fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.12em' }}>
                        {scopeLabels[rankingScope].heading}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 6 }}>
                      {[activeRankedClubs[1], activeRankedClubs[0], activeRankedClubs[2]].map((club, idx) => {
                        if (!club) return null;
                        const podiumHeights = [72, 96, 56];
                        const avatarSizes = [44, 52, 38];
                        const ranks = [2, 1, 3];
                        const podiumOpacity = ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.14)', 'rgba(255,255,255,0.06)'];
                        const status = joinRequests[club.id];
                        return (
                          <button
                            key={club.id}
                            onClick={() => handleClubTap(club)}
                            style={{
                              display: 'flex', flexDirection: 'column', alignItems: 'center',
                              flex: 1, background: 'transparent', border: 'none', cursor: 'pointer',
                            }}
                          >
                            {/* Gold award icon for 1st */}
                            {idx === 1 && (
                              <Award size={16} color='#FCD34D' style={{ marginBottom: 6 }} />
                            )}
                            {idx !== 1 && <div style={{ height: 22 }} />}

                            {/* Avatar */}
                            <div style={{
                              width: avatarSizes[idx], height: avatarSizes[idx],
                              borderRadius: 12,
                              background: getAvatarBg(club.name),
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: avatarSizes[idx] * 0.5, marginBottom: 8,
                              border: idx === 1 ? '1.5px solid #FCD34D' : 'none',
                            }}>🏃</div>

                            <span style={{ fontSize: idx === 1 ? 12 : 10, fontWeight: 600, color: '#fff', fontFamily: F, textAlign: 'center' as const, marginBottom: 2, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 4px' }}>
                              {club.name}
                            </span>
                            {status && (
                              <span style={{ fontSize: 9, fontWeight: 500, padding: '2px 6px', borderRadius: 10, marginBottom: 4, background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' }}>
                                {status === 'joined' ? 'Joined' : 'Pending'}
                              </span>
                            )}
                            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', fontFamily: F, marginBottom: 8 }}>{club.territories} zones</span>

                            {/* Podium block */}
                            <div style={{ width: '100%', borderRadius: '10px 10px 0 0', height: podiumHeights[idx], background: podiumOpacity[idx], display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                              <span style={{ color: '#fff', fontWeight: 700, fontSize: 18, fontFamily: F, lineHeight: 1 }}>#{ranks[idx]}</span>
                              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontFamily: F }}>+{club.weeklyGain}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Rankings list 4th+ */}
                  <div style={{ margin: '0 18px 16px', background: T.white, borderRadius: 12, border: `0.5px solid ${T.border}`, overflow: 'hidden' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 16px', borderBottom: `0.5px solid ${T.border}`,
                      background: T.stone,
                    }}>
                      <span style={{ fontSize: 9, color: T.t3, fontFamily: F, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>Club</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                        <span style={{ fontSize: 9, color: T.t3, fontFamily: F, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.1em', width: 48, textAlign: 'right' as const }}>Zones</span>
                        <span style={{ fontSize: 9, color: T.t3, fontFamily: F, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.1em', width: 40, textAlign: 'right' as const }}>+/-</span>
                      </div>
                    </div>
                    {activeRankedClubs.slice(3).map((club, i) => {
                      const status = joinRequests[club.id];
                      return (
                        <button
                          key={club.id}
                          onClick={() => handleClubTap(club)}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                            padding: '12px 16px', background: 'transparent',
                            border: 'none', borderBottom: i < activeRankedClubs.length - 4 ? `0.5px solid ${T.mid}` : 'none',
                            cursor: 'pointer', textAlign: 'left' as const,
                          }}
                        >
                          <span style={{ fontSize: 13, fontWeight: 700, color: T.t3, fontFamily: F, width: 20, textAlign: 'center' as const }}>{club.rank}</span>
                          <div style={{
                            width: 40, height: 40, borderRadius: 8,
                            background: getAvatarBg(club.name),
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0,
                          }}>🏃</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 13, fontWeight: 500, color: T.black, fontFamily: F, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{club.name}</span>
                              {status && (
                                <span style={{
                                  fontSize: 9, fontWeight: 500, padding: '2px 6px', borderRadius: 10,
                                  background: status === 'joined' ? T.redLo : T.amberLo,
                                  color: status === 'joined' ? T.red : T.amber,
                                }}>{status === 'joined' ? 'Joined' : 'Pending'}</span>
                              )}
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 300, color: T.t3, fontFamily: F }}>{club.members} members · {club.streak}d streak</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                            <span style={{ fontSize: 12, fontWeight: 300, color: T.black, fontFamily: F, width: 48, textAlign: 'right' as const }}>{club.territories}</span>
                            <span style={{
                              fontSize: 10, fontWeight: 500, fontFamily: F, width: 40, textAlign: 'right' as const,
                              color: club.weeklyGain > 0 ? T.green : club.weeklyGain < 0 ? T.red : T.t3,
                            }}>
                              {club.weeklyGain > 0 ? '+' : ''}{club.weeklyGain}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Club Preview Bottom Sheet */}
      <AnimatePresence>
        {previewClub && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setPreviewClub(null); setSheetStep('preview'); setRequestMessage(''); }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100 }}
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              style={{
                position: 'fixed', bottom: 0, left: 0, right: 0,
                background: T.bg, borderRadius: '24px 24px 0 0',
                zIndex: 101, maxHeight: '88vh',
                display: 'flex', flexDirection: 'column',
              }}
            >
              {/* Drag handle */}
              <div style={{ width: 36, height: 4, borderRadius: 2, background: T.border, margin: '12px auto 0', flexShrink: 0 }} />

              {/* Scrollable body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 0' }}>

                {/* STEP: Preview */}
                {sheetStep === 'preview' && (
                  <div>
                    {/* Header row: avatar + name + close */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                      <div style={{
                        width: 56, height: 56, borderRadius: 14, flexShrink: 0,
                        background: getAvatarBg(previewClub.name),
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
                      }}>🏃</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 18, fontStyle: 'italic', fontFamily: FD, color: T.black, lineHeight: 1.2, marginBottom: 4 }}>
                          {previewClub.name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 10, fontWeight: 300, color: T.t3, fontFamily: F }}>
                            {previewClub.region}, {previewClub.country} · Rank #{previewClub.rank}
                          </span>
                          <span style={{
                            fontSize: 8, fontWeight: 500, padding: '2px 7px', borderRadius: 10, fontFamily: F,
                            textTransform: 'uppercase' as const, letterSpacing: '0.06em',
                            background: previewClub.joinPolicy === 'open' ? T.greenLo : previewClub.joinPolicy === 'request' ? T.amberLo : T.stone,
                            color: previewClub.joinPolicy === 'open' ? T.green : previewClub.joinPolicy === 'request' ? T.amber : T.t2,
                          }}>
                            {previewClub.joinPolicy === 'open' ? 'Open' : previewClub.joinPolicy === 'request' ? 'Request' : 'Invite only'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => { setPreviewClub(null); setSheetStep('preview'); setRequestMessage(''); haptic('light'); }}
                        style={{ width: 28, height: 28, borderRadius: '50%', background: T.mid, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                      >
                        <X size={12} color={T.t2} />
                      </button>
                    </div>

                    {/* Description */}
                    {previewClub.description && (
                      <p style={{ fontSize: 12, fontWeight: 300, color: T.t2, fontFamily: F, lineHeight: 1.65, margin: '0 0 18px' }}>
                        {previewClub.description}
                      </p>
                    )}

                    {/* Stats — 4 cells */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
                      {[
                        { value: previewClub.territories, label: 'Zones' },
                        { value: previewClub.members,     label: 'Members' },
                        { value: `${previewClub.streak}d`, label: 'Streak' },
                        { value: previewClub.weeklyGain > 0 ? `+${previewClub.weeklyGain}` : String(previewClub.weeklyGain), label: 'This week' },
                      ].map((stat, i) => (
                        <div key={i} style={{ background: T.white, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: '12px 8px', textAlign: 'center' as const }}>
                          <div style={{ fontSize: 18, fontWeight: 300, color: T.black, fontFamily: F, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 4 }}>{stat.value}</div>
                          <div style={{ fontSize: 8, fontWeight: 400, color: T.t3, fontFamily: F, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>{stat.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Top members */}
                    {previewClub.topMembers.length > 0 && (
                      <div style={{ background: T.white, border: `0.5px solid ${T.border}`, borderRadius: 16, padding: '14px 16px', marginBottom: 20 }}>
                        <div style={{ fontSize: 9, fontWeight: 500, color: T.t3, fontFamily: F, textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: 12 }}>Top members</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {previewClub.topMembers.slice(0, 3).map((member, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{
                                width: 32, height: 32, borderRadius: '50%',
                                background: getAvatarBg(member.name),
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                              }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{member.name.charAt(0)}</span>
                              </div>
                              <span style={{ flex: 1, fontSize: 13, fontWeight: 400, color: T.black, fontFamily: F }}>{member.name}</span>
                              <span style={{ fontSize: 10, fontWeight: 300, color: T.t3, fontFamily: F }}>Lv. {member.level}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* STEP: Message */}
                {sheetStep === 'message' && (
                  <div>
                    <div style={{ fontSize: 18, fontStyle: 'italic', fontFamily: FD, color: T.black, marginBottom: 6 }}>
                      Request to join
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 300, color: T.t3, fontFamily: F, marginBottom: 16 }}>
                      Introduce yourself to {previewClub.name}
                    </div>
                    <textarea
                      value={requestMessage}
                      onChange={e => setRequestMessage(e.target.value)}
                      placeholder="Tell them why you want to join..."
                      maxLength={150}
                      rows={4}
                      autoFocus
                      style={{
                        width: '100%', background: T.white, border: `0.5px solid ${T.border}`,
                        borderRadius: 14, padding: '14px', fontSize: 13,
                        fontWeight: 300, fontFamily: F,
                        resize: 'none', outline: 'none', color: T.black,
                        boxSizing: 'border-box', lineHeight: 1.6,
                      }}
                    />
                    <div style={{ fontSize: 9, fontWeight: 300, color: T.t3, fontFamily: F, textAlign: 'right' as const, marginTop: 6, marginBottom: 8 }}>
                      {requestMessage.length}/150
                    </div>
                  </div>
                )}

                {/* STEP: Confirmed */}
                {sheetStep === 'confirmed' && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0 20px' }}>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                      style={{
                        width: 60, height: 60, borderRadius: '50%',
                        background: T.greenLo, border: `1px solid rgba(26,107,64,0.2)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18,
                      }}
                    >
                      <Check size={26} color={T.green} />
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                      style={{ fontSize: 22, fontStyle: 'italic', fontFamily: FD, color: T.black, margin: '0 0 8px', textAlign: 'center' as const }}
                    >
                      {joinRequests[previewClub.id] === 'joined' ? 'Welcome!' : 'Request Sent!'}
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      style={{ fontSize: 13, fontWeight: 300, color: T.t2, fontFamily: F, textAlign: 'center' as const }}
                    >
                      {joinRequests[previewClub.id] === 'joined'
                        ? `You're now a member of ${previewClub.name}`
                        : `${previewClub.name} will review your request`}
                    </motion.div>
                  </div>
                )}
              </div>

              {/* Pinned footer — always above nav bar */}
              {sheetStep !== 'confirmed' && (
                <div style={{
                  padding: '12px 20px',
                  paddingBottom: 'max(calc(env(safe-area-inset-bottom) + 80px), 96px)',
                  background: T.bg,
                  borderTop: `0.5px solid ${T.border}`,
                  flexShrink: 0,
                }}>
                  {sheetStep === 'preview' && (() => {
                    const btn = getJoinButtonState(previewClub);
                    return (
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => !btn.disabled && handleJoinAction(previewClub)}
                        disabled={btn.disabled}
                        style={{
                          width: '100%', borderRadius: 14, padding: '15px',
                          fontSize: 13, fontWeight: 600, fontFamily: F,
                          letterSpacing: '0.02em',
                          border: 'none', cursor: btn.disabled ? 'default' : 'pointer',
                          background: btn.disabled ? T.mid : T.black,
                          color: btn.disabled ? T.t3 : T.white,
                        }}
                      >
                        {btn.label}
                      </motion.button>
                    );
                  })()}
                  {sheetStep === 'message' && (
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        onClick={handleSendRequest}
                        style={{
                          flex: 1, borderRadius: 14, padding: '14px',
                          fontSize: 13, fontWeight: 400, fontFamily: F, color: T.t2,
                          background: T.mid, border: 'none', cursor: 'pointer',
                        }}
                      >
                        Skip
                      </button>
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={handleSendRequest}
                        style={{
                          flex: 2, borderRadius: 14, padding: '14px',
                          fontSize: 13, fontWeight: 600, fontFamily: F,
                          background: T.black, color: T.white,
                          border: 'none', cursor: 'pointer',
                        }}
                      >
                        Send Request
                      </motion.button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <CreateClubModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreateClub={handleCreateClub}
        existingClubNames={[]}
      />
    </div>
  );
}
