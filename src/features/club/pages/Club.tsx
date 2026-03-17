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
import {
  fetchClubMessages,
  sendClubMessage,
  subscribeToClubChat,
  submitJoinRequest,
  joinClub,
  leaveClub,
  type ClubChatMessage,
} from '@features/club/services/clubService';

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


const existingClubNames = ['Thunder Runners', 'Speed Demons', 'Elite Runners', 'NYC Runners'];

const RANKED_CLUBS_BY_SCOPE: Record<RankingScope, RankedClub[]> = {
  local: [
    { id: 'l1', name: 'NYC Runners', rank: 1, territories: 148, members: 34, streak: 12, badge: 'zap', weeklyGain: 18, weeklyRuns: 64, region: 'New York', country: 'US', joinPolicy: 'open', description: 'The fastest crew in all five boroughs. We run hard and claim everything.', topMembers: [{ name: 'Alex Chen', level: 28 }, { name: 'Sarah Park', level: 25 }, { name: 'Mike Ross', level: 23 }] },
    { id: 'l2', name: 'Brooklyn Blaze', rank: 2, territories: 121, members: 28, streak: 9, badge: 'flame', weeklyGain: 12, weeklyRuns: 51, region: 'New York', country: 'US', joinPolicy: 'request', description: 'Brooklyn-based runners conquering territory one block at a time.', topMembers: [{ name: 'James Wu', level: 24 }, { name: 'Priya K', level: 22 }, { name: 'Omar S', level: 20 }] },
    { id: 'l3', name: 'Bronx Legends', rank: 3, territories: 98, members: 22, streak: 7, badge: 'crown', weeklyGain: 8, weeklyRuns: 38, region: 'New York', country: 'US', joinPolicy: 'open', description: 'Born in the Bronx. Running for glory.', topMembers: [{ name: 'Carlos R', level: 21 }, { name: 'Nina B', level: 19 }, { name: 'Tyler M', level: 18 }] },
    { id: 'l4', name: 'Queens Elite', rank: 4, territories: 87, members: 19, streak: 5, badge: 'shield', weeklyGain: 6, weeklyRuns: 32, region: 'New York', country: 'US', joinPolicy: 'invite-only', description: 'Elite runners by invite only. Performance standards required.', topMembers: [{ name: 'Aisha T', level: 26 }, { name: 'Leo V', level: 24 }, { name: 'Mia F', level: 22 }] },
    { id: 'l5', name: 'Manhattan Mile', rank: 5, territories: 74, members: 17, streak: 4, badge: 'map-pin', weeklyGain: 4, weeklyRuns: 27, region: 'New York', country: 'US', joinPolicy: 'request', description: 'Midtown milers pushing the pace through the city grid.', topMembers: [{ name: 'Sam H', level: 20 }, { name: 'Eva C', level: 18 }, { name: 'Raj D', level: 16 }] },
    { id: 'l6', name: 'Harlem Hustle', rank: 6, territories: 63, members: 15, streak: 3, badge: 'zap', weeklyGain: 3, weeklyRuns: 22, region: 'New York', country: 'US', joinPolicy: 'open', description: 'Hustle never stops up in Harlem. Join and keep up.', topMembers: [{ name: 'Darius J', level: 17 }, { name: 'Keisha N', level: 15 }, { name: 'Marcus B', level: 14 }] },
    { id: 'l7', name: 'Staten Speedsters', rank: 7, territories: 52, members: 12, streak: 2, badge: 'activity', weeklyGain: 2, weeklyRuns: 18, region: 'New York', country: 'US', joinPolicy: 'open', description: 'Representing the forgotten borough — fastest on the island.', topMembers: [{ name: 'Tony R', level: 16 }, { name: 'Lena K', level: 14 }, { name: 'Joe M', level: 13 }] },
    { id: 'l8', name: 'Park Slope Pace', rank: 8, territories: 41, members: 10, streak: 1, badge: 'tree-pine', weeklyGain: 1, weeklyRuns: 14, region: 'New York', country: 'US', joinPolicy: 'invite-only', description: 'Scenic routes through Prospect Park and beyond. Invite only.', topMembers: [{ name: 'Amy L', level: 15 }, { name: 'Chris P', level: 13 }, { name: 'Dana W', level: 11 }] },
  ],
  national: [
    { id: 'n1', name: 'West Coast Wolves', rank: 1, territories: 312, members: 67, streak: 21, badge: 'zap', weeklyGain: 34, weeklyRuns: 124, region: 'California', country: 'US', joinPolicy: 'request', description: 'From San Diego to Seattle — we own the West Coast trail network.', topMembers: [{ name: 'Jake S', level: 32 }, { name: 'Olivia M', level: 30 }, { name: 'Ethan W', level: 28 }] },
    { id: 'n2', name: 'NYC Runners', rank: 2, territories: 285, members: 58, streak: 18, badge: 'flame', weeklyGain: 28, weeklyRuns: 108, region: 'New York', country: 'US', joinPolicy: 'open', description: "New York's number one club taking the fight nationwide.", topMembers: [{ name: 'Alex Chen', level: 28 }, { name: 'Sarah Park', level: 25 }, { name: 'Mike Ross', level: 23 }] },
    { id: 'n3', name: 'Chicago Charge', rank: 3, territories: 241, members: 49, streak: 14, badge: 'shield', weeklyGain: 21, weeklyRuns: 91, region: 'Illinois', country: 'US', joinPolicy: 'open', description: 'Windy City warriors charging through every district.', topMembers: [{ name: 'Derek L', level: 27 }, { name: 'Vanessa T', level: 25 }, { name: 'Hassan K', level: 23 }] },
    { id: 'n4', name: 'Texas Thunder', rank: 4, territories: 198, members: 43, streak: 11, badge: 'zap', weeklyGain: 15, weeklyRuns: 78, region: 'Texas', country: 'US', joinPolicy: 'invite-only', description: "Everything's bigger in Texas, especially our territory count.", topMembers: [{ name: 'Brock H', level: 29 }, { name: 'Cassie J', level: 26 }, { name: 'Wade R', level: 24 }] },
    { id: 'n5', name: 'Miami Heat Runners', rank: 5, territories: 167, members: 38, streak: 9, badge: 'flame', weeklyGain: 12, weeklyRuns: 65, region: 'Florida', country: 'US', joinPolicy: 'open', description: 'South Beach to Downtown — we run year-round in the heat.', topMembers: [{ name: 'Sofia G', level: 23 }, { name: 'Marco D', level: 21 }, { name: 'Aria F', level: 20 }] },
    { id: 'n6', name: 'Seattle Storm', rank: 6, territories: 143, members: 32, streak: 7, badge: 'activity', weeklyGain: 9, weeklyRuns: 56, region: 'Washington', country: 'US', joinPolicy: 'request', description: 'Running rain or shine through the Emerald City streets.', topMembers: [{ name: 'Finn O', level: 22 }, { name: 'Maya S', level: 20 }, { name: 'Caleb N', level: 18 }] },
    { id: 'n7', name: 'Boston Blazers', rank: 7, territories: 121, members: 27, streak: 6, badge: 'flame', weeklyGain: 7, weeklyRuns: 48, region: 'Massachusetts', country: 'US', joinPolicy: 'request', description: 'Inspired by the marathon. Powered by the city.', topMembers: [{ name: 'Liam B', level: 21 }, { name: 'Nora C', level: 19 }, { name: 'Owen P', level: 17 }] },
    { id: 'n8', name: 'Denver Altitude', rank: 8, territories: 98, members: 22, streak: 4, badge: 'mountain', weeklyGain: 5, weeklyRuns: 39, region: 'Colorado', country: 'US', joinPolicy: 'open', description: 'Training at elevation gives us the edge at sea level.', topMembers: [{ name: 'Zara K', level: 20 }, { name: 'Ben T', level: 18 }, { name: 'Isla H', level: 16 }] },
    { id: 'n9', name: 'Portland Trail Blazers', rank: 9, territories: 79, members: 18, streak: 3, badge: 'tree-pine', weeklyGain: 3, weeklyRuns: 31, region: 'Oregon', country: 'US', joinPolicy: 'invite-only', description: 'Trail runners conquering the Pacific Northwest wilderness.', topMembers: [{ name: 'River J', level: 19 }, { name: 'Willow E', level: 17 }, { name: 'Knox V', level: 15 }] },
  ],
  international: [
    { id: 'i1', name: 'Tokyo Titans', rank: 1, territories: 521, members: 112, streak: 38, badge: 'crown', weeklyGain: 61, weeklyRuns: 218, region: 'Tokyo', country: 'JP', joinPolicy: 'invite-only', description: 'Japan\'s most dominant running club. Legendary territory control.', topMembers: [{ name: 'Kenji H', level: 42 }, { name: 'Yuki T', level: 38 }, { name: 'Rin S', level: 35 }] },
    { id: 'i2', name: 'London Legends', rank: 2, territories: 487, members: 98, streak: 32, badge: 'shield', weeklyGain: 54, weeklyRuns: 192, region: 'London', country: 'UK', joinPolicy: 'request', description: 'Ruling the streets from Shoreditch to Hyde Park since day one.', topMembers: [{ name: 'Oliver B', level: 39 }, { name: 'Amelia S', level: 37 }, { name: 'Harry C', level: 34 }] },
    { id: 'i3', name: 'West Coast Wolves', rank: 3, territories: 441, members: 87, streak: 27, badge: 'zap', weeklyGain: 47, weeklyRuns: 174, region: 'California', country: 'US', joinPolicy: 'request', description: 'America\'s finest on the world stage.', topMembers: [{ name: 'Jake S', level: 32 }, { name: 'Olivia M', level: 30 }, { name: 'Ethan W', level: 28 }] },
    { id: 'i4', name: 'Berlin Breakers', rank: 4, territories: 398, members: 79, streak: 23, badge: 'flame', weeklyGain: 41, weeklyRuns: 158, region: 'Berlin', country: 'DE', joinPolicy: 'open', description: 'Precision and power — the German way. Anyone can join.', topMembers: [{ name: 'Hans K', level: 35 }, { name: 'Elsa M', level: 33 }, { name: 'Lukas P', level: 31 }] },
    { id: 'i5', name: 'Mumbai Monsoon', rank: 5, territories: 356, members: 71, streak: 19, badge: 'activity', weeklyGain: 35, weeklyRuns: 142, region: 'Mumbai', country: 'IN', joinPolicy: 'open', description: 'Rain doesn\'t stop us. Monsoon season is our peak season.', topMembers: [{ name: 'Arjun P', level: 31 }, { name: 'Meera S', level: 29 }, { name: 'Vikram N', level: 27 }] },
    { id: 'i6', name: 'São Paulo Sprint', rank: 6, territories: 312, members: 63, streak: 16, badge: 'zap', weeklyGain: 28, weeklyRuns: 126, region: 'São Paulo', country: 'BR', joinPolicy: 'open', description: 'Brazil\'s urban running elite — the city is our track.', topMembers: [{ name: 'Gabriel L', level: 28 }, { name: 'Ana R', level: 26 }, { name: 'Thiago C', level: 24 }] },
    { id: 'i7', name: 'Sydney Surge', rank: 7, territories: 278, members: 55, streak: 13, badge: 'crown', weeklyGain: 22, weeklyRuns: 110, region: 'Sydney', country: 'AU', joinPolicy: 'request', description: 'Harbour bridge to Bondi — we\'ve claimed it all down under.', topMembers: [{ name: 'Jack M', level: 26 }, { name: 'Charlotte B', level: 24 }, { name: 'Noah W', level: 22 }] },
    { id: 'i8', name: 'Dubai Dashers', rank: 8, territories: 241, members: 48, streak: 10, badge: 'flame', weeklyGain: 17, weeklyRuns: 94, region: 'Dubai', country: 'AE', joinPolicy: 'invite-only', description: 'Running in the desert builds champions. Elite only.', topMembers: [{ name: 'Omar Al-F', level: 30 }, { name: 'Layla H', level: 27 }, { name: 'Faris K', level: 25 }] },
    { id: 'i9', name: 'Paris Pace', rank: 9, territories: 198, members: 41, streak: 8, badge: 'map-pin', weeklyGain: 12, weeklyRuns: 78, region: 'Paris', country: 'FR', joinPolicy: 'open', description: 'From Marais to Montmartre — the city of light is our territory.', topMembers: [{ name: 'Camille B', level: 24 }, { name: 'Louis D', level: 22 }, { name: 'Emma L', level: 20 }] },
    { id: 'i10', name: 'Seoul Speedforce', rank: 10, territories: 163, members: 35, streak: 6, badge: 'zap', weeklyGain: 8, weeklyRuns: 63, region: 'Seoul', country: 'KR', joinPolicy: 'request', description: 'K-running culture goes global. Fast, disciplined, unstoppable.', topMembers: [{ name: 'Ji-ho K', level: 23 }, { name: 'Soo-yeon P', level: 21 }, { name: 'Min-jun L', level: 19 }] },
  ],
};

// --- Helpers ---

const statusColors: Record<string, string> = {
  online: 'bg-green-400',
  running: 'bg-[#E8435A]',
  offline: 'bg-gray-300',
};

const actionColors: Record<string, { bg: string; text: string; label: string }> = {
  captured: { bg: 'bg-[#F9E4E7]', text: 'text-[#E8435A]', label: 'Captured' },
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
  'from-[#E8435A] to-[#D03A4F]',
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
  'text-[#E8435A]', 'text-purple-600', 'text-blue-600',
  'text-pink-600', 'text-amber-600', 'text-emerald-600',
];
const getNameColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return nameColors[Math.abs(hash) % nameColors.length];
};

// isOwnMessage is resolved inside the component using currentUserId ref

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

  // Use Supabase data when available; fall back to scoped mock data for dev/testing
  const activeRankedClubs = rankedClubs.length > 0
    ? rankedClubs
    : RANKED_CLUBS_BY_SCOPE[rankingScope];

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
      // Map service type to component ChatMessage type
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
      // Avoid adding messages the current user already added optimistically
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

    // Optimistic UI update
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

    // Persist to Supabase (fire-and-forget; realtime will deliver the real record back)
    sendClubMessage(selectedClub.id, content)
      .then(() => {
        setChatMessages(prev =>
          prev.map(m => m.id === optimisticId ? { ...m, status: 'delivered' } : m)
        );
      })
      .catch(() => {
        // Remove optimistic message on failure
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
        await loadMyClubs(); // refresh my clubs list
      } catch {
        // Non-fatal (e.g. already a member)
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

  const getJoinButtonProps = (club: RankedClub) => {
    const status = joinRequests[club.id];
    if (status === 'joined') return { label: 'Joined', icon: Check, disabled: true, style: 'bg-gray-100 text-gray-400' };
    if (status === 'pending') return { label: 'Requested', icon: Clock, disabled: true, style: 'bg-gray-100 text-gray-400' };
    if (club.joinPolicy === 'open') return { label: 'Join Club', icon: UserPlus, disabled: false, style: 'bg-[#E8435A] text-white active:bg-[#D03A4F]' };
    if (club.joinPolicy === 'request') return { label: 'Request to Join', icon: MessageCircle, disabled: false, style: 'bg-[#E8435A] text-white active:bg-[#D03A4F]' };
    return { label: 'Invite Only', icon: Lock, disabled: true, style: 'bg-gray-100 text-gray-400' };
  };

  // =============================================
  // CHAT VIEW
  // =============================================
  if (view === 'chat' && selectedClub) {
    let lastDate = '';
    const isOwnMessage = (msg: ChatMessage) =>
      !!currentUserIdRef.current && msg.userId === currentUserIdRef.current;

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
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#E8435A] to-[#D03A4F] flex items-center justify-center flex-shrink-0">
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
          {chatLoading ? (
            <div className="space-y-3 px-1 pt-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                  <div className={`h-10 rounded-2xl bg-gray-100 animate-pulse ${i % 2 === 0 ? 'w-40' : 'w-52'}`} />
                </div>
              ))}
            </div>
          ) : chatMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 gap-2">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-1">
                <MessageCircle className="w-6 h-6 text-gray-300" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-medium text-gray-400">No messages yet</p>
              <p className="text-xs text-gray-300">Be the first to say something!</p>
            </div>
          ) : null}
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
                      <span className="text-[11px] text-[#D03A4F] bg-[#F9E4E7] px-3.5 py-1 rounded-full border border-[#F9E4E7]">
                        {msg.message}
                      </span>
                    </div>
                  ) : (
                    <div className={`flex ${isOwnMessage(msg) ? 'justify-end' : 'justify-start'} mb-0.5`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 pt-1.5 pb-1.5 shadow-sm ${
                        isOwnMessage(msg)
                          ? 'bg-[#E8435A] text-white rounded-br-md'
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
                  ? 'bg-[#E8435A] active:scale-90 shadow-[rgba(232,67,90,0.15)]'
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
      <div className="h-full bg-[#FAFAFA] dark:bg-[#0A0A0A] overflow-y-auto">
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
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#E8435A] to-[#D03A4F] flex items-center justify-center mx-auto mb-3
                          shadow-[0_4px_20px_rgba(232,67,90,0.2)]">
            <Zap className="w-10 h-10 text-white" strokeWidth={1.5} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-0.5">{selectedClub.name}</h2>
          <p className="text-[13px] text-gray-400">Club &middot; {selectedClub.memberCount} members</p>
        </div>

        {/* Stats row */}
        <div className="bg-white mt-2 px-4 py-3.5 border-y border-gray-100">
          <div className="grid grid-cols-4 gap-1">
            {[
              { value: selectedClub.totalTerritories, label: 'Zones', color: 'text-[#E8435A]' },
              { value: selectedClub.weeklyRuns, label: 'Runs/wk', color: 'text-gray-900' },
              { value: `${selectedClub.clubStreak}d`, label: 'Streak', color: 'text-orange-500' },
              { value: `#${selectedClub.rank}`, label: 'Rank', color: 'text-[#E8435A]' },
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
            <div className="w-10 h-10 rounded-xl bg-[#F9E4E7] flex items-center justify-center">
              <Link2 className="w-5 h-5 text-[#E8435A]" strokeWidth={2} />
            </div>
            <span className="text-[15px] text-[#E8435A] font-medium">Invite via link</span>
          </button>

          {/* Add members */}
          <button className="w-full flex items-center gap-4 px-5 py-3 active:bg-gray-50 transition">
            <div className="w-10 h-10 rounded-xl bg-[#F9E4E7] flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-[#E8435A]" strokeWidth={2} />
            </div>
            <span className="text-[15px] text-[#E8435A] font-medium">Add members</span>
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
            onClick={async () => {
              haptic('medium');
              if (selectedClub) {
                try { await leaveClub(selectedClub.id); } catch {/* non-fatal */}
                await loadMyClubs();
              }
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
    <div className="h-full bg-[#FAFAFA] dark:bg-[#0A0A0A] overflow-y-auto pb-24">
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
                  className="w-6 h-6 border-2 border-gray-200 border-t-[#E8435A] rounded-full" />
              </div>
            ) : myClubsData.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center border border-gray-100 shadow-sm">
                <div className="w-14 h-14 rounded-2xl bg-[#F9E4E7] flex items-center justify-center mx-auto mb-3">
                  <Users className="w-7 h-7 text-[#E8435A]" strokeWidth={1.5} />
                </div>
                <p className="text-base font-bold text-gray-900 mb-1">No Clubs Yet</p>
                <p className="text-xs text-gray-400 mb-4">Join or create a club to start conquering together</p>
                <button
                  onClick={() => { setShowCreateModal(true); haptic('light'); }}
                  className="px-6 py-2.5 rounded-xl bg-[#E8435A] text-white text-sm font-semibold active:scale-95 transition"
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
                      <div className="w-[52px] h-[52px] rounded-2xl bg-gradient-to-br from-[#E8435A] to-[#D03A4F] flex items-center justify-center flex-shrink-0
                                      shadow-[0_2px_12px_rgba(232,67,90,0.15)]">
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
                      <div className="mt-2.5 flex items-center gap-2 bg-[#F9E4E7]/50 rounded-lg px-3 py-1.5 border border-[#F9E4E7]/50">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#E8435A] animate-pulse flex-shrink-0" />
                        <span className="text-[11px] text-[#D03A4F] truncate">
                          <span className="font-medium">{latestActivity.userName}</span>
                          {' '}{actionColors[latestActivity.action].label.toLowerCase()}{' '}
                          {latestActivity.detail}
                        </span>
                        <span className="text-[10px] text-[#E8435A] flex-shrink-0">{latestActivity.time}</span>
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
                  className="w-6 h-6 border-2 border-gray-200 border-t-[#E8435A] rounded-full" />
              </div>
            )}
            {!rankingsLoading && <>
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
                        ? 'bg-[#F9E4E7] text-[#E8435A] border-[#F9E4E7]'
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
                className="w-full bg-white border border-gray-200 rounded-xl py-2.5 pl-9 pr-9 text-[14px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#E8435A]/30 shadow-sm"
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
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#F9E4E7] to-purple-50 flex items-center justify-center">
                          <Zap className="w-4 h-4 text-[#E8435A]" strokeWidth={2} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[14px] font-medium text-gray-900 truncate">{club.name}</span>
                            {status && (
                              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                                status === 'joined' ? 'bg-[#F9E4E7] text-[#E8435A]' : 'bg-amber-50 text-amber-600'
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
            <div className="bg-gradient-to-b from-[#D03A4F] to-[#B5303F] rounded-2xl p-5 pb-3 mb-4 shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <Flame className="w-4 h-4 text-amber-300" strokeWidth={2} />
                <span className="text-[12px] text-white/80 font-semibold uppercase tracking-wider">
                  {scopeLabels[rankingScope].heading}
                </span>
              </div>
              <div className="flex items-end justify-center gap-2">
                {[activeRankedClubs[1], activeRankedClubs[0], activeRankedClubs[2]].map((club, idx) => {
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
                        idx === 1 ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-[#D03A4F]' : ''
                      }`}>
                        <Zap className={`${iconSizes[idx]} text-white`} strokeWidth={2} />
                      </div>
                      <span className={`${idx === 1 ? 'text-[13px]' : 'text-[11px]'} font-bold text-white text-center leading-tight mb-0.5 truncate w-full px-1`}>
                        {club.name}
                      </span>
                      {status && (
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full mb-0.5 ${
                          status === 'joined' ? 'bg-[#E8435A]/30 text-white/80' : 'bg-amber-400/30 text-amber-100'
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
              {activeRankedClubs.slice(3).map((club, i) => {
                const status = joinRequests[club.id];
                return (
                  <button
                    key={club.id}
                    onClick={() => handleClubTap(club)}
                    className={`w-full flex items-center gap-3 px-4 py-3 active:bg-gray-50 transition text-left ${
                      i < activeRankedClubs.length - 4 ? 'border-b border-gray-50' : ''
                    }`}
                  >
                    <span className="text-[13px] font-bold text-gray-400 w-5 text-center">{club.rank}</span>
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#F9E4E7] to-purple-50 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-[#E8435A]" strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[14px] font-medium text-gray-900 truncate">{club.name}</span>
                        {status && (
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                            status === 'joined' ? 'bg-[#F9E4E7] text-[#E8435A]' : 'bg-amber-50 text-amber-600'
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
                      <span className="text-[12px] font-bold text-[#E8435A]">#{previewClub.rank}</span>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-[13px] text-gray-600 text-center leading-relaxed mb-4">
                    {previewClub.description}
                  </p>

                  {/* Stats grid */}
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {[
                      { value: previewClub.territories, label: 'Zones', color: 'text-[#E8435A]' },
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
                               placeholder:text-gray-400 focus:outline-none focus:border-[#E8435A]/30 resize-none mb-1"
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
                      className="flex-1 py-3.5 rounded-xl bg-[#E8435A] text-white font-semibold text-[15px] flex items-center justify-center gap-2 active:bg-[#D03A4F] transition"
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
                    className="w-16 h-16 rounded-full bg-[#F9E4E7] flex items-center justify-center mb-4"
                  >
                    <Check className="w-8 h-8 text-[#E8435A]" strokeWidth={2.5} />
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
