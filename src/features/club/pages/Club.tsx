import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crown, Shield, Zap, ChevronRight, ArrowLeft, Send,
  Users, MapPin, X, UserPlus, LogOut, MoreVertical,
  Search, TrendingUp, Link2, Bell, BellOff,
  Check, CheckCheck, Image, FileText, Flame,
  Globe, Clock, Flag, MessageCircle, Lock,
} from 'lucide-react';
import { haptic } from '@shared/lib/haptics';
import { useNavVisibility } from '@shared/hooks/useNavVisibility';
import { CreateClubModal } from '@features/club/components/CreateClubModal';
import { supabase } from '@shared/services/supabase';

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

// --- Mock Data ---



const clubMembers: Record<string, Member[]> = {
  c1: [
    { id: '1', name: 'Alex Chen', level: 28, status: 'online', territories: 32, role: 'leader' },
    { id: '2', name: 'Sarah Park', level: 25, status: 'running', territories: 24, role: 'admin' },
    { id: '3', name: 'Mike Ross', level: 23, status: 'online', territories: 18, role: 'admin' },
    { id: '4', name: 'Emma Stone', level: 22, status: 'offline', territories: 14, role: 'member' },
    { id: '5', name: 'John Doe', level: 20, status: 'offline', territories: 11, role: 'member' },
    { id: '6', name: 'Lisa Wang', level: 19, status: 'online', territories: 9, role: 'member' },
  ],
  'c-local': [
    { id: '11', name: 'Dave Kim', level: 18, status: 'running', territories: 6, role: 'leader' },
    { id: '10', name: 'You', level: 22, status: 'online', territories: 8, role: 'admin' },
    { id: '12', name: 'Amy Liu', level: 15, status: 'offline', territories: 4, role: 'member' },
  ],
};

const clubActivities: Record<string, ActivityItem[]> = {
  c1: [
    { id: 'a1', userId: '1', userName: 'Alex', action: 'captured', detail: 'Tokyo Station', time: '2m ago' },
    { id: 'a2', userId: '2', userName: 'Sarah', action: 'defended', detail: 'Central Park', time: '15m ago' },
    { id: 'a3', userId: '3', userName: 'Mike', action: 'captured', detail: 'London Bridge', time: '1h ago' },
    { id: 'a4', userId: '4', userName: 'Emma', action: 'lost', detail: 'Times Square', time: '2h ago' },
    { id: 'a5', userId: '6', userName: 'Lisa', action: 'leveled_up', detail: 'Level 19', time: '3h ago' },
    { id: 'a6', userId: '5', userName: 'John', action: 'captured', detail: 'Brooklyn Heights', time: '5h ago' },
  ],
  'c-local': [
    { id: 'a10', userId: '11', userName: 'Dave', action: 'captured', detail: 'Union Square', time: '30m ago' },
    { id: 'a11', userId: '10', userName: 'You', action: 'defended', detail: 'Prospect Park', time: '2h ago' },
    { id: 'a12', userId: '12', userName: 'Amy', action: 'joined', detail: 'NYC Runners', time: '1d ago' },
  ],
};

const clubChats: Record<string, ChatMessage[]> = {
  c1: [
    { id: 'm1', userId: '1', userName: 'Alex Chen', message: 'Just captured Tokyo Station! Let\'s keep pushing!', timestamp: '10:30 AM', date: 'Today', type: 'message', status: 'read' },
    { id: 'm2', userId: '2', userName: 'Sarah Park', message: 'Nice one! I defended Central Park this morning', timestamp: '10:32 AM', type: 'message', status: 'read' },
    { id: 'm-act1', userId: '3', userName: 'Mike Ross', message: 'Mike Ross captured London Bridge', timestamp: '10:45 AM', type: 'activity' },
    { id: 'm3', userId: '3', userName: 'Mike Ross', message: 'That makes 3 captures today for the club! We\'re crushing it', timestamp: '10:46 AM', type: 'message', status: 'read' },
    { id: 'm4', userId: '4', userName: 'Emma Stone', message: 'Great work team! We\'re on fire this week', timestamp: '11:00 AM', type: 'message', status: 'read' },
    { id: 'm-act2', userId: '4', userName: 'Emma Stone', message: 'Emma Stone lost Times Square to Speed Demons', timestamp: '11:15 AM', type: 'activity' },
    { id: 'm5', userId: '1', userName: 'Alex Chen', message: 'We need to recapture Times Square. Who\'s up for an evening run?', timestamp: '11:20 AM', type: 'message', status: 'read' },
    { id: 'm6', userId: '6', userName: 'Lisa Wang', message: 'I\'m in! Let\'s meet at 6 PM near the station', timestamp: '11:25 AM', type: 'message', status: 'delivered' },
  ],
  'c-local': [
    { id: 'ml0', userId: '11', userName: 'Dave Kim', message: 'Hey everyone! New week, new goals', timestamp: '8:45 AM', date: 'Today', type: 'message', status: 'read' },
    { id: 'ml1', userId: '11', userName: 'Dave Kim', message: 'Morning run at 7 AM tomorrow?', timestamp: '9:00 AM', type: 'message', status: 'read' },
    { id: 'ml2', userId: '10', userName: 'You', message: 'Count me in!', timestamp: '9:15 AM', type: 'message', status: 'read' },
    { id: 'ml-act1', userId: '11', userName: 'Dave Kim', message: 'Dave Kim captured Union Square', timestamp: '10:00 AM', type: 'activity' },
    { id: 'ml3', userId: '12', userName: 'Amy Liu', message: 'Welcome to the crew! Glad to be here', timestamp: '10:30 AM', type: 'message', status: 'delivered' },
  ],
};

const existingClubNames = ['Thunder Runners', 'Speed Demons', 'Elite Runners', 'NYC Runners'];

// --- Helpers ---

const statusColors: Record<string, string> = {
  online: 'bg-green-400',
  running: 'bg-teal-400',
  offline: 'bg-gray-300',
};

const actionColors: Record<string, { bg: string; text: string; label: string }> = {
  captured: { bg: 'bg-teal-50', text: 'text-teal-600', label: 'Captured' },
  lost: { bg: 'bg-red-50', text: 'text-red-500', label: 'Lost' },
  defended: { bg: 'bg-blue-50', text: 'text-blue-500', label: 'Defended' },
  joined: { bg: 'bg-purple-50', text: 'text-purple-500', label: 'Joined' },
  leveled_up: { bg: 'bg-amber-50', text: 'text-amber-500', label: 'Leveled Up' },
};

const roleBadgeColor: Record<string, string> = {
  leader: 'bg-amber-50 text-amber-600',
  admin: 'bg-blue-50 text-blue-600',
  member: '',
};

const avatarColors = [
  'from-teal-400 to-teal-600',
  'from-purple-400 to-purple-600',
  'from-blue-400 to-blue-600',
  'from-pink-400 to-pink-600',
  'from-amber-400 to-amber-600',
  'from-emerald-400 to-emerald-600',
];

const getAvatarColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
};

const nameColors = [
  'text-teal-600', 'text-purple-600', 'text-blue-600',
  'text-pink-600', 'text-amber-600', 'text-emerald-600',
];
const getNameColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return nameColors[Math.abs(hash) % nameColors.length];
};

const isOwnMessage = (msg: ChatMessage) => msg.userId === 'current-user' || msg.userName === 'You';

const scopeLabels: Record<RankingScope, { label: string; icon: typeof MapPin; heading: string }> = {
  local: { label: 'Local', icon: MapPin, heading: 'Top Clubs in New York' },
  national: { label: 'National', icon: Flag, heading: 'Top Clubs in US' },
  international: { label: 'International', icon: Globe, heading: 'Top Clubs Worldwide' },
};

const policyDisplay: Record<JoinPolicy, { label: string; color: string; border: string }> = {
  open: { label: 'Open to All', color: 'text-green-600 bg-green-50', border: 'border-green-200' },
  request: { label: 'Requires Request', color: 'text-amber-600 bg-amber-50', border: 'border-amber-200' },
  'invite-only': { label: 'Invite Only', color: 'text-gray-500 bg-gray-50', border: 'border-gray-200' },
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

  const loadMyClubs = async () => {
    setClubsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setClubsLoading(false); return; }

    const { data: memberships } = await supabase
      .from('club_members')
      .select('club_id, role, clubs(id, name, description, badge_emoji, owner_id, member_count, total_km, created_at)')
      .eq('user_id', user.id);

    const clubs: ClubData[] = (memberships ?? []).map(m => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = m.clubs as any as {
        id: string; name: string; description: string | null; badge_emoji: string;
        owner_id: string; member_count: number; total_km: number; created_at: string;
      };
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clubs: RankedClub[] = (data ?? []).map((c: any, i: number) => ({
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
  const [messageInput, setMessageInput] = useState('');
  const [chatHeight, setChatHeight] = useState<string | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Rankings state
  const [rankingScope, setRankingScope] = useState<RankingScope>('local');
  const [previewClub, setPreviewClub] = useState<RankedClub | null>(null);
  const [joinRequests, setJoinRequests] = useState<Record<string, 'pending' | 'joined'>>({});
  const [requestMessage, setRequestMessage] = useState('');
  const [sheetStep, setSheetStep] = useState<SheetStep>('preview');

  const [rankingSearch, setRankingSearch] = useState('');

  const filteredRankedClubs = rankingSearch
    ? rankedClubs.filter(c => c.name.toLowerCase().includes(rankingSearch.toLowerCase()))
    : null;

  // Hide bottom nav when in chat view
  useEffect(() => {
    setNavVisible(view !== 'chat');
    return () => setNavVisible(true);
  }, [view, setNavVisible]);

  useEffect(() => {
    if (view === 'chat' && selectedClub) {
      setChatMessages(clubChats[selectedClub.id] || []);
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [view, selectedClub]);

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

  const handleOpenChat = (club: ClubData) => {
    setSelectedClub(club);
    setView('chat');
    haptic('light');
  };

  const handleOpenProfile = () => {
    setView('profile');
    setShowDropdown(false);
    haptic('light');
  };

  const handleBackToMain = () => {
    setView('main');
    setSelectedClub(null);
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
    if (!messageInput.trim()) return;
    const msg: ChatMessage = {
      id: Date.now().toString(),
      userId: 'current-user',
      userName: 'You',
      message: messageInput.trim(),
      timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      type: 'message',
      status: 'sent',
    };
    setChatMessages(prev => [...prev, msg]);
    setMessageInput('');
    haptic('light');
    setTimeout(() => {
      setChatMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: 'delivered' } : m));
    }, 800);
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

  const handleJoinAction = (club: RankedClub) => {
    if (club.joinPolicy === 'open') {
      setJoinRequests(prev => ({ ...prev, [club.id]: 'joined' }));
      setSheetStep('confirmed');
      haptic('medium');
    } else if (club.joinPolicy === 'request') {
      setSheetStep('message');
      haptic('light');
    }
  };

  const handleSendRequest = () => {
    if (previewClub) {
      setJoinRequests(prev => ({ ...prev, [previewClub.id]: 'pending' }));
      setSheetStep('confirmed');
      haptic('medium');
    }
  };

  const getJoinButtonProps = (club: RankedClub) => {
    const status = joinRequests[club.id];
    if (status === 'joined') return { label: 'Joined', icon: Check, disabled: true, style: 'bg-gray-100 text-gray-400' };
    if (status === 'pending') return { label: 'Requested', icon: Clock, disabled: true, style: 'bg-gray-100 text-gray-400' };
    if (club.joinPolicy === 'open') return { label: 'Join Club', icon: UserPlus, disabled: false, style: 'bg-teal-500 text-white active:bg-teal-600' };
    if (club.joinPolicy === 'request') return { label: 'Request to Join', icon: MessageCircle, disabled: false, style: 'bg-teal-500 text-white active:bg-teal-600' };
    return { label: 'Invite Only', icon: Lock, disabled: true, style: 'bg-gray-100 text-gray-400' };
  };

  // =============================================
  // CHAT VIEW
  // =============================================
  if (view === 'chat' && selectedClub) {
    let lastDate = '';

    return (
      <div className="flex flex-col bg-gray-50" style={{ height: chatHeight ?? '100%' }}>
        {/* Header */}
        <div className="bg-white border-b border-gray-100 shadow-sm z-10"
             style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}>
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            <button onClick={handleBackToMain} className="p-1.5 -ml-1 rounded-full active:bg-gray-100 transition">
              <ArrowLeft className="w-5 h-5 text-gray-700" strokeWidth={2} />
            </button>
            <button
              onClick={handleOpenProfile}
              className="flex-1 flex items-center gap-2.5 active:opacity-70 transition min-w-0"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center flex-shrink-0">
                <Zap className="w-4.5 h-4.5 text-white" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold text-gray-900 truncate">{selectedClub.name}</h2>
                <p className="text-[11px] text-gray-400 truncate">
                  {(clubMembers[selectedClub.id] || []).filter(m => m.status !== 'offline').map(m => m.name).slice(0, 3).join(', ')}
                  {(clubMembers[selectedClub.id] || []).filter(m => m.status !== 'offline').length > 3 && '...'}
                </p>
              </div>
            </button>
            <button
              onClick={() => { setShowDropdown(!showDropdown); haptic('light'); }}
              className="p-2 rounded-full active:bg-gray-100 transition"
            >
              <MoreVertical className="w-5 h-5 text-gray-500" strokeWidth={2} />
            </button>
          </div>

          {/* Dropdown menu */}
          <AnimatePresence>
            {showDropdown && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute right-3 top-full mt-1 bg-white rounded-2xl shadow-lg border border-gray-100 py-1 z-50 w-48"
              >
                {[
                  { label: 'Group info', action: () => handleOpenProfile() },
                  { label: muted ? 'Unmute notifications' : 'Mute notifications', action: () => { setMuted(!muted); setShowDropdown(false); haptic('light'); } },
                  { label: 'Search', action: () => setShowDropdown(false) },
                ].map((item, i) => (
                  <button
                    key={i}
                    onClick={item.action}
                    className="w-full text-left px-4 py-2.5 text-[13px] text-gray-700 active:bg-gray-50 transition"
                  >
                    {item.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {showDropdown && (
          <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-3 py-3" onClick={() => setShowDropdown(false)}>
          <div className="space-y-1">
            {chatMessages.map((msg) => {
              const showDate = msg.date && msg.date !== lastDate;
              if (msg.date) lastDate = msg.date;

              return (
                <div key={msg.id}>
                  {showDate && (
                    <div className="flex justify-center my-3">
                      <span className="text-[11px] text-gray-500 bg-white px-3.5 py-1 rounded-full shadow-sm border border-gray-100 font-medium">
                        {msg.date}
                      </span>
                    </div>
                  )}

                  {msg.type === 'activity' ? (
                    <div className="flex justify-center my-2.5">
                      <span className="text-[11px] text-teal-700 bg-teal-50 px-3.5 py-1 rounded-full border border-teal-100">
                        {msg.message}
                      </span>
                    </div>
                  ) : (
                    <div className={`flex ${isOwnMessage(msg) ? 'justify-end' : 'justify-start'} mb-0.5`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 pt-1.5 pb-1.5 shadow-sm ${
                        isOwnMessage(msg)
                          ? 'bg-teal-500 text-white rounded-br-md'
                          : 'bg-white border border-gray-100 text-gray-900 rounded-bl-md'
                      }`}>
                        {!isOwnMessage(msg) && (
                          <p className={`text-[12px] font-semibold mb-0.5 ${getNameColor(msg.userName)}`}>
                            {msg.userName}
                          </p>
                        )}
                        <div className="flex items-end gap-2">
                          <p className={`text-[14px] leading-[1.4] break-words ${
                            isOwnMessage(msg) ? 'text-white' : 'text-gray-800'
                          }`}>{msg.message}</p>
                          <span className="flex items-center gap-0.5 flex-shrink-0 -mb-0.5 ml-1">
                            <span className={`text-[10px] whitespace-nowrap ${
                              isOwnMessage(msg) ? 'text-white/60' : 'text-gray-300'
                            }`}>{msg.timestamp}</span>
                            {isOwnMessage(msg) && msg.status && (
                              msg.status === 'read' ? (
                                <CheckCheck className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                              ) : msg.status === 'delivered' ? (
                                <CheckCheck className="w-3.5 h-3.5 text-white/50" strokeWidth={2.5} />
                              ) : (
                                <Check className="w-3.5 h-3.5 text-white/50" strokeWidth={2.5} />
                              )
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input bar */}
        <div className="bg-white border-t border-gray-100 px-3 py-2"
             style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
          <div className="flex items-end gap-2">
            <div className="flex-1 bg-gray-50 rounded-full flex items-center px-4 border border-gray-200">
              <input
                ref={inputRef}
                type="text"
                value={messageInput}
                onChange={e => setMessageInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                placeholder="Type a message..."
                className="flex-1 bg-transparent border-none outline-none text-[15px] text-gray-900
                           placeholder:text-gray-400 py-2.5"
              />
            </div>
            <button
              onClick={handleSendMessage}
              disabled={!messageInput.trim()}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm ${
                messageInput.trim()
                  ? 'bg-teal-500 active:scale-90 shadow-teal-200'
                  : 'bg-gray-100'
              }`}
            >
              <Send className={`w-4.5 h-4.5 ${messageInput.trim() ? 'text-white' : 'text-gray-300'} ml-0.5`} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =============================================
  // CLUB PROFILE VIEW
  // =============================================
  if (view === 'profile' && selectedClub) {
    const members = clubMembers[selectedClub.id] || [];
    const activities = clubActivities[selectedClub.id] || [];
    const sortedMembers = [...members].sort((a, b) => {
      const order = { leader: 0, admin: 1, member: 2 };
      return order[a.role] - order[b.role];
    });

    return (
      <div className="h-full bg-[#FAFAFA] overflow-y-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 shadow-sm z-10"
             style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}>
          <div className="flex items-center gap-3 px-3 py-2.5">
            <button onClick={handleBackFromProfile} className="p-1.5 rounded-full active:bg-gray-100 transition">
              <ArrowLeft className="w-5 h-5 text-gray-700" strokeWidth={2} />
            </button>
            <h1 className="text-[16px] font-bold text-gray-900">Club Info</h1>
          </div>
        </div>

        {/* Club avatar + name centered */}
        <div className="bg-white px-5 pt-7 pb-5 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center mx-auto mb-3
                          shadow-[0_4px_20px_rgba(0,180,198,0.2)]">
            <Zap className="w-10 h-10 text-white" strokeWidth={1.5} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-0.5">{selectedClub.name}</h2>
          <p className="text-[13px] text-gray-400">Club &middot; {selectedClub.memberCount} members</p>
        </div>

        {/* Stats row */}
        <div className="bg-white mt-2 px-4 py-3.5 border-y border-gray-100">
          <div className="grid grid-cols-4 gap-1">
            {[
              { value: selectedClub.totalTerritories, label: 'Zones', color: 'text-teal-600' },
              { value: selectedClub.weeklyRuns, label: 'Runs/wk', color: 'text-gray-900' },
              { value: `${selectedClub.clubStreak}d`, label: 'Streak', color: 'text-orange-500' },
              { value: `#${selectedClub.rank}`, label: 'Rank', color: 'text-teal-600' },
            ].map((stat, i) => (
              <div key={i} className="text-center py-1">
                <span className={`text-stat text-[16px] font-bold block ${stat.color}`}>{stat.value}</span>
                <span className="text-[10px] text-gray-400 uppercase tracking-wider">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Description + Created */}
        <div className="bg-white mt-2 px-5 py-4 border-y border-gray-100">
          <p className="text-[14px] text-gray-700 leading-relaxed">{selectedClub.description}</p>
          <p className="text-[12px] text-gray-300 mt-2">
            Created by {selectedClub.createdBy} on {selectedClub.createdAt}
          </p>
        </div>

        {/* Media, Links, Docs */}
        <div className="bg-white mt-2 border-y border-gray-100">
          <button className="w-full flex items-center justify-between px-5 py-3.5 active:bg-gray-50 transition">
            <span className="text-[14px] text-gray-700">Media, links and docs</span>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {[Image, Link2, FileText].map((Icon, i) => (
                  <div key={i} className="w-6 h-6 rounded-lg bg-gray-50 flex items-center justify-center">
                    <Icon className="w-3 h-3 text-gray-400" strokeWidth={2} />
                  </div>
                ))}
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300" strokeWidth={2} />
            </div>
          </button>
        </div>

        {/* Mute */}
        <div className="bg-white mt-2 border-y border-gray-100">
          <button
            onClick={() => { setMuted(!muted); haptic('light'); }}
            className="w-full flex items-center gap-4 px-5 py-3.5 active:bg-gray-50 transition"
          >
            {muted
              ? <BellOff className="w-5 h-5 text-gray-400" strokeWidth={1.8} />
              : <Bell className="w-5 h-5 text-gray-400" strokeWidth={1.8} />
            }
            <span className="flex-1 text-[14px] text-gray-700 text-left">
              {muted ? 'Unmute notifications' : 'Mute notifications'}
            </span>
          </button>
        </div>

        {/* Members */}
        <div className="bg-white mt-2 border-y border-gray-100">
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <span className="text-[13px] text-gray-500 font-medium">{members.length} members</span>
            <Search className="w-4 h-4 text-gray-300" strokeWidth={2} />
          </div>

          {/* Invite via link */}
          <button className="w-full flex items-center gap-4 px-5 py-3 active:bg-gray-50 transition">
            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
              <Link2 className="w-5 h-5 text-teal-500" strokeWidth={2} />
            </div>
            <span className="text-[15px] text-teal-600 font-medium">Invite via link</span>
          </button>

          {/* Add members */}
          <button className="w-full flex items-center gap-4 px-5 py-3 active:bg-gray-50 transition">
            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-teal-500" strokeWidth={2} />
            </div>
            <span className="text-[15px] text-teal-600 font-medium">Add members</span>
          </button>

          {/* Member list */}
          {sortedMembers.map((member, i) => (
            <button key={member.id} className={`w-full flex items-center gap-3.5 px-5 py-2.5 active:bg-gray-50 transition ${
              i < sortedMembers.length - 1 ? 'border-b border-gray-50' : ''
            }`}>
              <div className="relative">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getAvatarColor(member.name)} flex items-center justify-center`}>
                  <span className="text-sm font-bold text-white">{member.name.charAt(0)}</span>
                </div>
                {member.status !== 'offline' && (
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${statusColors[member.status]}`} />
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-[14px] font-medium text-gray-900 truncate">{member.name}</span>
                  {member.role !== 'member' && (
                    <span className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-md ${roleBadgeColor[member.role]}`}>
                      {member.role}
                    </span>
                  )}
                </div>
                <span className="text-[12px] text-gray-400">
                  Lv.{member.level} &middot; {member.territories} zones
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Live Activity */}
        <div className="bg-white mt-2 border-y border-gray-100">
          <div className="flex items-center gap-2 px-5 pt-4 pb-2">
            <span className="text-[13px] text-gray-500 font-medium">Recent activity</span>
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          </div>
          {activities.slice(0, 4).map((activity) => {
            const style = actionColors[activity.action];
            return (
              <div key={activity.id} className="flex items-center gap-3 px-5 py-2.5">
                <div className={`w-8 h-8 rounded-xl ${style.bg} flex items-center justify-center flex-shrink-0`}>
                  {activity.action === 'captured' && <MapPin className={`w-4 h-4 ${style.text}`} strokeWidth={2} />}
                  {activity.action === 'lost' && <X className={`w-4 h-4 ${style.text}`} strokeWidth={2} />}
                  {activity.action === 'defended' && <Shield className={`w-4 h-4 ${style.text}`} strokeWidth={2} />}
                  {activity.action === 'joined' && <UserPlus className={`w-4 h-4 ${style.text}`} strokeWidth={2} />}
                  {activity.action === 'leveled_up' && <TrendingUp className={`w-4 h-4 ${style.text}`} strokeWidth={2} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-gray-600">
                    <span className="font-medium text-gray-800">{activity.userName}</span>
                    {' '}{style.label.toLowerCase()}{' '}
                    <span className="font-medium text-gray-800">{activity.detail}</span>
                  </p>
                </div>
                <span className="text-[11px] text-gray-300 flex-shrink-0">{activity.time}</span>
              </div>
            );
          })}
        </div>

        {/* Exit group */}
        <div className="bg-white mt-2 mb-8 border-y border-gray-100">
          <button
            onClick={() => {
              haptic('medium');
              handleBackToMain();
            }}
            className="w-full flex items-center gap-4 px-5 py-3.5 active:bg-red-50 transition"
          >
            <LogOut className="w-5 h-5 text-red-500" strokeWidth={1.8} />
            <span className="text-[15px] text-red-500 font-medium">Exit group</span>
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
    <div className="h-full bg-[#FAFAFA] overflow-y-auto pb-24">
      <div className="px-5" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">Clubs</h1>
          <button
            onClick={() => { setShowCreateModal(true); haptic('light'); }}
            className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-gray-200 shadow-sm"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        <div className="flex gap-1 bg-gray-50 rounded-xl p-1 mb-5">
          {[
            { id: 'my-clubs' as ClubTab, label: 'My Clubs' },
            { id: 'rankings' as ClubTab, label: 'Rankings' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); haptic('light'); }}
              className={`flex-1 py-2.5 rounded-lg text-[12px] font-semibold transition-all ${
                activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5">
        {/* MY CLUBS TAB */}
        {activeTab === 'my-clubs' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            {clubsLoading ? (
              <div className="flex justify-center py-16">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-6 h-6 border-2 border-gray-200 border-t-teal-500 rounded-full" />
              </div>
            ) : myClubsData.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center border border-gray-100 shadow-sm">
                <div className="w-14 h-14 rounded-2xl bg-teal-50 flex items-center justify-center mx-auto mb-3">
                  <Users className="w-7 h-7 text-teal-500" strokeWidth={1.5} />
                </div>
                <p className="text-base font-bold text-gray-900 mb-1">No Clubs Yet</p>
                <p className="text-xs text-gray-400 mb-4">Join or create a club to start conquering together</p>
                <button
                  onClick={() => { setShowCreateModal(true); haptic('light'); }}
                  className="px-6 py-2.5 rounded-xl bg-teal-500 text-white text-sm font-semibold active:scale-95 transition"
                >
                  Create a Club
                </button>
              </div>
            ) : (
              myClubsData.map(club => {
                const latestActivity = undefined as ActivityItem | undefined;
                const lastMsg = undefined as ChatMessage | undefined;
                return (
                  <motion.button
                    key={club.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => handleOpenChat(club)}
                    className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-left active:bg-gray-50 transition"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-[52px] h-[52px] rounded-2xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center flex-shrink-0
                                      shadow-[0_2px_12px_rgba(0,180,198,0.15)]">
                        <Zap className="w-6 h-6 text-white" strokeWidth={2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-[15px] font-semibold text-gray-900 truncate">{club.name}</h3>
                          <span className="text-[11px] text-gray-300 flex-shrink-0 ml-2">
                            {lastMsg?.timestamp}
                          </span>
                        </div>
                        <p className="text-[13px] text-gray-500 truncate mt-0.5">
                          {lastMsg
                            ? <><span className="text-gray-400">{lastMsg.userName}:</span> {lastMsg.message}</>
                            : `${club.memberCount} members`
                          }
                        </p>
                      </div>
                    </div>

                    {latestActivity && (
                      <div className="mt-2.5 flex items-center gap-2 bg-teal-50/50 rounded-lg px-3 py-1.5 border border-teal-100/50">
                        <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse flex-shrink-0" />
                        <span className="text-[11px] text-teal-700 truncate">
                          <span className="font-medium">{latestActivity.userName}</span>
                          {' '}{actionColors[latestActivity.action].label.toLowerCase()}{' '}
                          {latestActivity.detail}
                        </span>
                        <span className="text-[10px] text-teal-400 flex-shrink-0">{latestActivity.time}</span>
                      </div>
                    )}
                  </motion.button>
                );
              })
            )}
          </motion.div>
        )}

        {/* RANKINGS TAB */}
        {activeTab === 'rankings' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {rankingsLoading && (
              <div className="flex justify-center py-16">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-6 h-6 border-2 border-gray-200 border-t-teal-500 rounded-full" />
              </div>
            )}
            {!rankingsLoading && rankedClubs.length === 0 && (
              <div className="bg-white rounded-2xl p-10 text-center border border-gray-100 shadow-sm">
                <p className="text-[14px] text-gray-400">No clubs yet — be the first to create one!</p>
              </div>
            )}
            {!rankingsLoading && rankedClubs.length > 0 && <>
            {/* Scope Filter Pills */}
            <div className="flex gap-2 mb-4">
              {(['local', 'national', 'international'] as RankingScope[]).map(scope => {
                const { label, icon: ScopeIcon } = scopeLabels[scope];
                return (
                  <button
                    key={scope}
                    onClick={() => { setRankingScope(scope); setRankingSearch(''); haptic('light'); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                      rankingScope === scope
                        ? 'bg-teal-50 text-teal-600 border-teal-200'
                        : 'bg-gray-50 text-gray-400 border-gray-100'
                    }`}
                  >
                    <ScopeIcon className="w-3 h-3" strokeWidth={2} />
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Search bar */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={2} />
              <input
                type="text"
                value={rankingSearch}
                onChange={e => setRankingSearch(e.target.value)}
                placeholder="Search clubs..."
                className="w-full bg-white border border-gray-200 rounded-xl py-2.5 pl-9 pr-9 text-[14px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-teal-300 shadow-sm"
              />
              {rankingSearch && (
                <button onClick={() => setRankingSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-4 h-4 text-gray-400" strokeWidth={2} />
                </button>
              )}
            </div>

            {/* Search results */}
            {filteredRankedClubs !== null ? (
              filteredRankedClubs.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center mb-4">
                  <p className="text-[14px] text-gray-400">No clubs found for "{rankingSearch}"</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
                  {filteredRankedClubs.map((club, i) => {
                    const status = joinRequests[club.id];
                    return (
                      <button
                        key={club.id}
                        onClick={() => handleClubTap(club)}
                        className={`w-full flex items-center gap-3 px-4 py-3 active:bg-gray-50 transition text-left ${
                          i < filteredRankedClubs.length - 1 ? 'border-b border-gray-50' : ''
                        }`}
                      >
                        <span className="text-[13px] font-bold text-gray-400 w-5 text-center">{club.rank}</span>
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-50 to-purple-50 flex items-center justify-center">
                          <Zap className="w-4 h-4 text-teal-600" strokeWidth={2} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[14px] font-medium text-gray-900 truncate">{club.name}</span>
                            {status && (
                              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                                status === 'joined' ? 'bg-teal-50 text-teal-600' : 'bg-amber-50 text-amber-600'
                              }`}>
                                {status === 'joined' ? 'Joined' : 'Pending'}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-gray-400">{club.members} members &middot; {club.region}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-stat text-[14px] font-bold text-gray-900">{club.territories} <span className="text-[10px] text-gray-400 font-normal">zones</span></span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            ) : (
              <>

            {/* Podium - top 3 */}
            <div className="bg-gradient-to-b from-teal-600 to-teal-700 rounded-2xl p-5 pb-3 mb-4 shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <Flame className="w-4 h-4 text-amber-300" strokeWidth={2} />
                <span className="text-[12px] text-white/80 font-semibold uppercase tracking-wider">
                  {scopeLabels[rankingScope].heading}
                </span>
              </div>
              <div className="flex items-end justify-center gap-2">
                {[rankedClubs[1], rankedClubs[0], rankedClubs[2]].map((club, idx) => {
                  const heights = [80, 104, 64];
                  const avatarSizes = ['w-11 h-11', 'w-14 h-14', 'w-10 h-10'];
                  const iconSizes = ['w-5 h-5', 'w-7 h-7', 'w-4 h-4'];
                  const ranks = [2, 1, 3];
                  const medalColors = ['text-gray-300', 'text-amber-300', 'text-orange-400'];
                  const status = joinRequests[club.id];
                  return (
                    <button
                      key={club.id}
                      onClick={() => handleClubTap(club)}
                      className="flex flex-col items-center flex-1 active:opacity-80 transition"
                    >
                      <div className={`${avatarSizes[idx]} rounded-full bg-white/15 flex items-center justify-center mb-1.5 ${
                        idx === 1 ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-teal-600' : ''
                      }`}>
                        <Zap className={`${iconSizes[idx]} text-white`} strokeWidth={2} />
                      </div>
                      <span className={`${idx === 1 ? 'text-[13px]' : 'text-[11px]'} font-bold text-white text-center leading-tight mb-0.5 truncate w-full px-1`}>
                        {club.name}
                      </span>
                      {status && (
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full mb-0.5 ${
                          status === 'joined' ? 'bg-teal-400/30 text-teal-100' : 'bg-amber-400/30 text-amber-100'
                        }`}>
                          {status === 'joined' ? 'Joined' : 'Pending'}
                        </span>
                      )}
                      <span className="text-[10px] text-white/60 mb-1.5">{club.territories} zones</span>
                      <div className="w-full rounded-t-lg overflow-hidden" style={{ height: heights[idx] }}>
                        <div className={`w-full h-full flex flex-col items-center justify-start pt-2 ${
                          idx === 1 ? 'bg-amber-400/30' : 'bg-white/10'
                        }`}>
                          <Crown className={`w-4 h-4 ${medalColors[idx]} mb-0.5`} strokeWidth={2} />
                          <span className="text-white font-bold text-base">#{ranks[idx]}</span>
                          <span className="text-[10px] text-white/60 mt-0.5">+{club.weeklyGain}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Leaderboard list */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">Club</span>
                <div className="flex items-center gap-6">
                  <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider w-12 text-right">Zones</span>
                  <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider w-10 text-right">+/-</span>
                </div>
              </div>
              {rankedClubs.slice(3).map((club, i) => {
                const status = joinRequests[club.id];
                return (
                  <button
                    key={club.id}
                    onClick={() => handleClubTap(club)}
                    className={`w-full flex items-center gap-3 px-4 py-3 active:bg-gray-50 transition text-left ${
                      i < rankedClubs.length - 4 ? 'border-b border-gray-50' : ''
                    }`}
                  >
                    <span className="text-[13px] font-bold text-gray-400 w-5 text-center">{club.rank}</span>
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-50 to-purple-50 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-teal-600" strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[14px] font-medium text-gray-900 truncate">{club.name}</span>
                        {status && (
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                            status === 'joined' ? 'bg-teal-50 text-teal-600' : 'bg-amber-50 text-amber-600'
                          }`}>
                            {status === 'joined' ? 'Joined' : 'Pending'}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-gray-400">{club.members} members &middot; {club.streak}d streak</span>
                    </div>
                    <div className="flex items-center gap-6">
                      <span className="text-stat text-[14px] font-bold text-gray-900 w-12 text-right">{club.territories}</span>
                      <span className={`text-stat text-[12px] font-bold w-10 text-right ${
                        club.weeklyGain > 0 ? 'text-green-500' : club.weeklyGain < 0 ? 'text-red-500' : 'text-gray-400'
                      }`}>
                        {club.weeklyGain > 0 ? '+' : ''}{club.weeklyGain}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            </>
            )}
            </>}
          </motion.div>
        )}
      </div>

      {/* Club Preview Bottom Sheet */}
      <AnimatePresence>
        {previewClub && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-[60]"
              onClick={() => { setPreviewClub(null); setSheetStep('preview'); setRequestMessage(''); }}
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-[70] bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto"
              style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-gray-200" />
              </div>

              {/* STEP: Preview */}
              {sheetStep === 'preview' && (
                <div className="px-5 pb-5">
                  {/* Club header */}
                  <div className="flex flex-col items-center mb-5">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${getAvatarColor(previewClub.name)} flex items-center justify-center mb-3
                                    shadow-[0_4px_16px_rgba(0,0,0,0.1)]`}>
                      <Zap className="w-8 h-8 text-white" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-0.5">{previewClub.name}</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-gray-400">{previewClub.region}, {previewClub.country}</span>
                      <span className="text-[12px] font-bold text-teal-600">#{previewClub.rank}</span>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-[13px] text-gray-600 text-center leading-relaxed mb-4">
                    {previewClub.description}
                  </p>

                  {/* Stats grid */}
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {[
                      { value: previewClub.territories, label: 'Zones', color: 'text-teal-600' },
                      { value: previewClub.members, label: 'Members', color: 'text-gray-900' },
                      { value: `${previewClub.streak}d`, label: 'Streak', color: 'text-orange-500' },
                      { value: `+${previewClub.weeklyGain}`, label: 'This Week', color: 'text-green-500' },
                    ].map((stat, i) => (
                      <div key={i} className="bg-gray-50 rounded-xl p-2.5 text-center">
                        <span className={`text-[15px] font-bold block ${stat.color}`}>{stat.value}</span>
                        <span className="text-[10px] text-gray-400 uppercase tracking-wider">{stat.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Join policy badge */}
                  <div className="flex justify-center mb-4">
                    <span className={`text-[11px] font-medium px-3 py-1.5 rounded-full border ${policyDisplay[previewClub.joinPolicy].color} ${policyDisplay[previewClub.joinPolicy].border}`}>
                      {previewClub.joinPolicy === 'open' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 align-middle" />}
                      {previewClub.joinPolicy === 'request' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 align-middle" />}
                      {previewClub.joinPolicy === 'invite-only' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400 mr-1.5 align-middle" />}
                      {policyDisplay[previewClub.joinPolicy].label}
                    </span>
                  </div>

                  {/* Top members */}
                  <div className="mb-5">
                    <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-2 block">Top Members</span>
                    <div className="flex gap-3">
                      {previewClub.topMembers.map((member, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${getAvatarColor(member.name)} flex items-center justify-center`}>
                            <span className="text-[10px] font-bold text-white">{member.name.charAt(0)}</span>
                          </div>
                          <div>
                            <span className="text-[12px] font-medium text-gray-700 block leading-tight">{member.name}</span>
                            <span className="text-[10px] text-gray-400">Lv.{member.level}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action button */}
                  {(() => {
                    const btn = getJoinButtonProps(previewClub);
                    const BtnIcon = btn.icon;
                    return (
                      <button
                        onClick={() => !btn.disabled && handleJoinAction(previewClub)}
                        disabled={btn.disabled}
                        className={`w-full py-3.5 rounded-xl font-semibold text-[15px] flex items-center justify-center gap-2 transition-all ${btn.style}`}
                      >
                        <BtnIcon className="w-4.5 h-4.5" strokeWidth={2} />
                        {btn.label}
                      </button>
                    );
                  })()}
                </div>
              )}

              {/* STEP: Message (request policy only) */}
              {sheetStep === 'message' && (
                <div className="px-5 pb-5">
                  <h3 className="text-[16px] font-bold text-gray-900 mb-1">Request to join {previewClub.name}</h3>
                  <p className="text-[13px] text-gray-400 mb-4">Add an optional message to introduce yourself</p>

                  <textarea
                    value={requestMessage}
                    onChange={e => setRequestMessage(e.target.value)}
                    placeholder="Introduce yourself..."
                    maxLength={150}
                    rows={3}
                    autoFocus
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[14px] text-gray-900
                               placeholder:text-gray-400 focus:outline-none focus:border-teal-300 resize-none mb-1"
                  />
                  <span className="text-[11px] text-gray-300 block text-right mb-5">{requestMessage.length}/150</span>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSendRequest}
                      className="text-[14px] text-gray-400 font-medium px-4 py-3"
                    >
                      Skip
                    </button>
                    <button
                      onClick={handleSendRequest}
                      className="flex-1 py-3.5 rounded-xl bg-teal-500 text-white font-semibold text-[15px] flex items-center justify-center gap-2 active:bg-teal-600 transition"
                    >
                      <Send className="w-4 h-4" strokeWidth={2} />
                      Send Request
                    </button>
                  </div>
                </div>
              )}

              {/* STEP: Confirmed */}
              {sheetStep === 'confirmed' && (
                <div className="px-5 pb-8 flex flex-col items-center justify-center py-8">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                    className="w-16 h-16 rounded-full bg-teal-50 flex items-center justify-center mb-4"
                  >
                    <Check className="w-8 h-8 text-teal-500" strokeWidth={2.5} />
                  </motion.div>
                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="text-[18px] font-bold text-gray-900"
                  >
                    {joinRequests[previewClub.id] === 'joined' ? 'Welcome!' : 'Request Sent!'}
                  </motion.p>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-[13px] text-gray-400 mt-1"
                  >
                    {joinRequests[previewClub.id] === 'joined'
                      ? `You're now a member of ${previewClub.name}`
                      : `${previewClub.name} will review your request`
                    }
                  </motion.p>
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
        existingClubNames={existingClubNames}
      />
    </div>
  );
}
