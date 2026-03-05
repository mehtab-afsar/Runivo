import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { haptic } from '@shared/lib/haptics';
import {
  Heart,
  MessageCircle,
  Share2,
  MoreHorizontal,
  MapPin,
  Trophy,
  Zap,
  TrendingUp,
  Flag,
  Search,
  X,
  UserPlus,
  Check,
  ChevronRight,
  Users,
  Smartphone,
  Flame,
  Crown,
  Shield,
  ArrowLeft,
  Calendar,
  Swords,
  Send,
} from 'lucide-react';

type FeedTab = 'explore' | 'following';
type ReactionType = 'kudos' | 'fire' | 'crown' | 'muscle';
type ActivityType = 'run' | 'trail' | 'interval' | 'long_run';

const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: 'kudos', emoji: '\ud83d\udc4f', label: 'Kudos' },
  { type: 'fire', emoji: '\ud83d\udd25', label: 'Fire' },
  { type: 'crown', emoji: '\ud83d\udc51', label: 'Crown' },
  { type: 'muscle', emoji: '\ud83d\udcaa', label: 'Strong' },
];

interface PostUser {
  name: string;
  initial: string;
  avatar?: string;
  color: string;
}

interface PostActivity {
  type: ActivityType;
  title: string;
  description?: string;
  distance: number;
  duration: number;
  pace: string;
  elevation?: number;
  calories?: number;
  territoriesClaimed: number;
  enemyZonesCaptured?: number;
  route: [number, number][];
  pr?: { label: string; value: string };
}

interface KudosUser {
  name: string;
  initial: string;
  color: string;
}

interface Post {
  id: string;
  user: PostUser;
  activity: PostActivity;
  kudos: number;
  kudosUsers: KudosUser[];
  comments: number;
  timestamp: string;
  location?: string;
}

interface SuggestedRunner {
  id: string;
  name: string;
  initial: string;
  color: string;
  level: number;
  totalDistance: number;
  territories: number;
  mutualCount: number;
  mutualNames: string[];
  location?: string;
  isVerified?: boolean;
  recentRun?: string;
  badge?: 'top10' | 'streak' | 'conqueror';
  joinedDate?: string;
  avgPace?: string;
  weeklyKm?: number;
  recentActivities?: { title: string; distance: number; pace: string; time: string; zones: number }[];
}

interface ContactEntry {
  id: string;
  name: string;
  initial: string;
  color: string;
  phone: string;
  isOnRunivo: boolean;
  level?: number;
  totalDistance?: number;
  territories?: number;
}

const ACTIVITY_ICONS: Record<ActivityType, { icon: string; bg: string }> = {
  run: { icon: '\ud83c\udfc3', bg: 'bg-teal-500' },
  trail: { icon: '\u26f0\ufe0f', bg: 'bg-emerald-600' },
  interval: { icon: '\u26a1', bg: 'bg-amber-500' },
  long_run: { icon: '\ud83d\udea3', bg: 'bg-blue-500' },
};

const ROUTES: [number, number][][] = [
  [[10,80],[15,65],[25,50],[35,55],[45,40],[55,35],[60,20],[70,25],[80,40],[85,55],[75,65],[65,70],[55,75],[45,80],[35,85],[25,80],[15,78],[10,80]],
  [[15,20],[25,30],[30,45],[40,55],[50,50],[60,40],[65,30],[75,35],[80,50],[85,65],[75,75],[60,80],[45,75],[35,65],[25,55],[20,40],[15,20]],
  [[10,50],[20,35],[30,25],[45,20],[55,30],[60,45],[65,60],[55,70],[45,75],[35,70],[30,60],[25,50],[30,40],[40,35],[50,45],[45,55],[35,60],[25,55],[15,50],[10,50]],
  [[20,85],[25,70],[35,55],[45,45],[55,40],[65,35],[70,45],[65,55],[55,60],[50,70],[55,80],[65,75],[75,65],[80,55],[75,45],[65,40],[55,50],[50,60],[45,70],[35,80],[25,82],[20,85]],
  [[15,50],[25,40],[35,30],[50,25],[60,30],[70,40],[75,55],[70,65],[60,70],[50,65],[45,55],[50,45],[60,50],[65,60],[55,68],[45,62],[40,55],[35,50],[25,55],[15,50]],
];

const mockPosts: Post[] = [
  {
    id: '1',
    user: { name: 'Sarah Johnson', initial: 'S', color: 'from-rose-400 to-pink-500' },
    activity: { type: 'run', title: 'Morning Territory Run', description: 'Beautiful morning out. Claimed 3 new zones near the park! Defence is looking strong.', distance: 8.2, duration: 42, pace: '5:07', elevation: 87, calories: 520, territoriesClaimed: 3, route: ROUTES[0], pr: { label: 'Fastest 5K', value: '24:12' } },
    kudos: 24, kudosUsers: [{ name: 'Mike', initial: 'M', color: 'from-blue-400 to-indigo-500' }, { name: 'Alex', initial: 'A', color: 'from-purple-400 to-violet-500' }, { name: 'Kim', initial: 'K', color: 'from-amber-400 to-orange-500' }],
    comments: 5, timestamp: '2h ago', location: 'Central Park, New Delhi',
  },
  {
    id: '2',
    user: { name: 'Mike Chen', initial: 'M', color: 'from-blue-400 to-indigo-500' },
    activity: { type: 'interval', title: 'Speed Intervals', description: 'Tempo session with 6x800m repeats. Feeling the speed coming back!', distance: 5.0, duration: 28, pace: '5:36', elevation: 32, calories: 340, territoriesClaimed: 2, enemyZonesCaptured: 1, route: ROUTES[1] },
    kudos: 18, kudosUsers: [{ name: 'Sarah', initial: 'S', color: 'from-rose-400 to-pink-500' }, { name: 'Priya', initial: 'P', color: 'from-teal-400 to-cyan-500' }],
    comments: 3, timestamp: '4h ago', location: 'Lodi Garden Track',
  },
  {
    id: '3',
    user: { name: 'RunRebel', initial: 'R', color: 'from-orange-400 to-red-500' },
    activity: { type: 'long_run', title: 'Territory Conquest', description: 'Sunday long run turned into a massive territory sweep. 7 zones claimed, 2 enemy zones captured. Empire growing!', distance: 12.4, duration: 68, pace: '5:29', elevation: 156, calories: 845, territoriesClaimed: 7, enemyZonesCaptured: 2, route: ROUTES[2], pr: { label: 'Longest Run', value: '12.4 km' } },
    kudos: 42, kudosUsers: [{ name: 'Sarah', initial: 'S', color: 'from-rose-400 to-pink-500' }, { name: 'Mike', initial: 'M', color: 'from-blue-400 to-indigo-500' }, { name: 'Alex', initial: 'A', color: 'from-purple-400 to-violet-500' }, { name: 'Kim', initial: 'K', color: 'from-amber-400 to-orange-500' }, { name: 'Priya', initial: 'P', color: 'from-teal-400 to-cyan-500' }],
    comments: 8, timestamp: '6h ago', location: 'Hauz Khas - Safdarjung',
  },
  {
    id: '4',
    user: { name: 'Priya Sharma', initial: 'P', color: 'from-teal-400 to-cyan-500' },
    activity: { type: 'trail', title: 'Ridge Trail Run', description: 'Hit the trails before sunrise. That elevation gain was brutal but so worth it.', distance: 6.8, duration: 45, pace: '6:37', elevation: 210, calories: 480, territoriesClaimed: 4, route: ROUTES[3] },
    kudos: 31, kudosUsers: [{ name: 'RunRebel', initial: 'R', color: 'from-orange-400 to-red-500' }, { name: 'Sarah', initial: 'S', color: 'from-rose-400 to-pink-500' }],
    comments: 6, timestamp: '8h ago', location: 'Northern Ridge, Delhi',
  },
  {
    id: '5',
    user: { name: 'Alex Rivera', initial: 'A', color: 'from-purple-400 to-violet-500' },
    activity: { type: 'run', title: 'Recovery + Zone Defense', description: 'Easy recovery run but had to defend 2 of my zones. Nobody takes my territory!', distance: 4.2, duration: 26, pace: '6:11', elevation: 18, calories: 270, territoriesClaimed: 0, enemyZonesCaptured: 0, route: ROUTES[4] },
    kudos: 15, kudosUsers: [{ name: 'Mike', initial: 'M', color: 'from-blue-400 to-indigo-500' }],
    comments: 2, timestamp: '12h ago', location: 'Nehru Park Loop',
  },
];

// --- Discover / Following Mock Data ---

const suggestedNearby: SuggestedRunner[] = [
  { id: 'sn1', name: 'Arjun Kapoor', initial: 'A', color: 'from-indigo-400 to-blue-600', level: 24, totalDistance: 1240, territories: 38, mutualCount: 3, mutualNames: ['Sarah', 'Mike', 'Priya'], location: 'Connaught Place', recentRun: '5.2 km this morning', badge: 'conqueror', joinedDate: 'Aug 2024', avgPace: '5:22', weeklyKm: 28, recentActivities: [{ title: 'Morning Conquest', distance: 5.2, pace: '5:18', time: '2h ago', zones: 2 }, { title: 'Evening Defense', distance: 3.8, pace: '5:45', time: 'Yesterday', zones: 0 }, { title: 'Weekend Long Run', distance: 14.1, pace: '5:30', time: '3d ago', zones: 5 }] },
  { id: 'sn2', name: 'Neha Gupta', initial: 'N', color: 'from-rose-400 to-pink-500', level: 19, totalDistance: 890, territories: 22, mutualCount: 1, mutualNames: ['RunRebel'], location: 'Dwarka', recentRun: '3.1 km yesterday', joinedDate: 'Dec 2024', avgPace: '6:05', weeklyKm: 15, recentActivities: [{ title: 'Quick Run', distance: 3.1, pace: '6:10', time: 'Yesterday', zones: 1 }, { title: 'Park Loops', distance: 5.5, pace: '5:55', time: '3d ago', zones: 2 }] },
  { id: 'sn3', name: 'Rohit Malhotra', initial: 'R', color: 'from-amber-500 to-orange-600', level: 27, totalDistance: 2100, territories: 56, mutualCount: 5, mutualNames: ['Sarah', 'Mike', 'Alex', 'Priya', 'Kim'], location: 'South Delhi', isVerified: true, badge: 'top10', joinedDate: 'Mar 2024', avgPace: '4:48', weeklyKm: 42, recentActivities: [{ title: 'Territory Sweep', distance: 10.2, pace: '4:45', time: '1h ago', zones: 6 }, { title: 'Speed Session', distance: 6.0, pace: '4:20', time: 'Yesterday', zones: 1 }, { title: 'Long Conquest', distance: 18.5, pace: '5:05', time: '2d ago', zones: 8 }] },
  { id: 'sn4', name: 'Kavya Nair', initial: 'K', color: 'from-emerald-400 to-teal-600', level: 16, totalDistance: 620, territories: 14, mutualCount: 2, mutualNames: ['Mike', 'Alex'], location: 'Noida', recentRun: '7.5 km today', badge: 'streak', joinedDate: 'Jan 2025', avgPace: '6:20', weeklyKm: 18, recentActivities: [{ title: 'Morning Run', distance: 7.5, pace: '6:15', time: 'Today', zones: 3 }, { title: 'Recovery Jog', distance: 2.5, pace: '7:00', time: 'Yesterday', zones: 0 }] },
];

const suggestedPopular: SuggestedRunner[] = [
  { id: 'sp1', name: 'Virat Jogger', initial: 'V', color: 'from-slate-600 to-gray-800', level: 42, totalDistance: 5800, territories: 142, mutualCount: 0, mutualNames: [], isVerified: true, badge: 'top10', recentRun: '15 km conquest', joinedDate: 'Jan 2024', avgPace: '4:32', weeklyKm: 65, recentActivities: [{ title: 'Morning Conquest', distance: 15.0, pace: '4:28', time: '3h ago', zones: 9 }, { title: 'Speed Intervals', distance: 8.0, pace: '4:10', time: 'Yesterday', zones: 2 }, { title: 'Recovery', distance: 5.0, pace: '5:30', time: '2d ago', zones: 0 }] },
  { id: 'sp2', name: 'Ananya Runs', initial: 'A', color: 'from-fuchsia-400 to-pink-600', level: 36, totalDistance: 4200, territories: 98, mutualCount: 2, mutualNames: ['Sarah', 'RunRebel'], isVerified: true, badge: 'conqueror', joinedDate: 'Feb 2024', avgPace: '5:10', weeklyKm: 48, recentActivities: [{ title: 'Territory Defense', distance: 8.5, pace: '5:05', time: '5h ago', zones: 4 }, { title: 'Trail Blitz', distance: 12.0, pace: '5:25', time: 'Yesterday', zones: 6 }] },
  { id: 'sp3', name: 'Marathon Manish', initial: 'M', color: 'from-teal-500 to-cyan-600', level: 38, totalDistance: 4900, territories: 115, mutualCount: 1, mutualNames: ['Priya'], isVerified: true, badge: 'streak', recentRun: '21 km long run', joinedDate: 'Jan 2024', avgPace: '4:55', weeklyKm: 55, recentActivities: [{ title: 'Half Marathon', distance: 21.1, pace: '4:50', time: 'Today', zones: 12 }, { title: 'Easy Run', distance: 6.0, pace: '5:40', time: '2d ago', zones: 1 }] },
  { id: 'sp4', name: 'Zoya Fitness', initial: 'Z', color: 'from-violet-500 to-purple-600', level: 31, totalDistance: 3400, territories: 76, mutualCount: 0, mutualNames: [], isVerified: true, recentRun: '10 km tempo', joinedDate: 'Apr 2024', avgPace: '5:20', weeklyKm: 38, recentActivities: [{ title: 'Tempo Run', distance: 10.0, pace: '5:15', time: '4h ago', zones: 3 }, { title: 'Zone Hunt', distance: 7.2, pace: '5:30', time: 'Yesterday', zones: 4 }] },
  { id: 'sp5', name: 'DelhiRunner', initial: 'D', color: 'from-sky-500 to-blue-600', level: 29, totalDistance: 2800, territories: 64, mutualCount: 3, mutualNames: ['Mike', 'Alex', 'Kim'], badge: 'top10', joinedDate: 'May 2024', avgPace: '5:00', weeklyKm: 32, recentActivities: [{ title: 'City Run', distance: 8.0, pace: '4:55', time: '6h ago', zones: 3 }, { title: 'Night Capture', distance: 5.5, pace: '5:10', time: 'Yesterday', zones: 2 }] },
];

const suggestedFromClubs: SuggestedRunner[] = [
  { id: 'sc1', name: 'Emma Stone', initial: 'E', color: 'from-rose-400 to-pink-500', level: 22, totalDistance: 980, territories: 14, mutualCount: 4, mutualNames: ['Alex', 'Sarah', 'Mike', 'Lisa'], recentRun: 'Thunder Runners', joinedDate: 'Jun 2024', avgPace: '5:45', weeklyKm: 20, recentActivities: [{ title: 'Club Run', distance: 6.0, pace: '5:40', time: '1h ago', zones: 2 }] },
  { id: 'sc2', name: 'John Doe', initial: 'J', color: 'from-blue-400 to-indigo-600', level: 20, totalDistance: 760, territories: 11, mutualCount: 4, mutualNames: ['Alex', 'Sarah', 'Mike', 'Lisa'], recentRun: 'Thunder Runners', joinedDate: 'Jul 2024', avgPace: '6:00', weeklyKm: 16, recentActivities: [{ title: 'Morning Jog', distance: 4.0, pace: '6:05', time: 'Yesterday', zones: 1 }] },
  { id: 'sc3', name: 'Lisa Wang', initial: 'L', color: 'from-emerald-400 to-green-600', level: 19, totalDistance: 640, territories: 9, mutualCount: 4, mutualNames: ['Alex', 'Sarah', 'Mike', 'John'], recentRun: 'Thunder Runners', joinedDate: 'Aug 2024', avgPace: '6:10', weeklyKm: 14, recentActivities: [{ title: 'Park Loop', distance: 3.5, pace: '6:20', time: '2d ago', zones: 1 }] },
];

const contactEntries: ContactEntry[] = [
  { id: 'ce1', name: 'Rahul Sharma', initial: 'R', color: 'from-orange-400 to-red-500', phone: '+91 98XXX XXXXX', isOnRunivo: true, level: 15, totalDistance: 420, territories: 8 },
  { id: 'ce2', name: 'Sneha Patel', initial: 'S', color: 'from-pink-400 to-rose-500', phone: '+91 87XXX XXXXX', isOnRunivo: true, level: 21, totalDistance: 1080, territories: 19 },
  { id: 'ce3', name: 'Amit Kumar', initial: 'A', color: 'from-blue-400 to-indigo-500', phone: '+91 99XXX XXXXX', isOnRunivo: true, level: 8, totalDistance: 180, territories: 3 },
  { id: 'ce4', name: 'Deepa Menon', initial: 'D', color: 'from-violet-400 to-purple-500', phone: '+91 70XXX XXXXX', isOnRunivo: false },
  { id: 'ce5', name: 'Karan Singh', initial: 'K', color: 'from-teal-400 to-emerald-500', phone: '+91 88XXX XXXXX', isOnRunivo: false },
  { id: 'ce6', name: 'Riya Joshi', initial: 'R', color: 'from-amber-400 to-orange-500', phone: '+91 91XXX XXXXX', isOnRunivo: false },
];

const searchResults: SuggestedRunner[] = [
  { id: 'sr1', name: 'Sarah Johnson', initial: 'S', color: 'from-rose-400 to-pink-500', level: 25, totalDistance: 1560, territories: 28, mutualCount: 3, mutualNames: ['Mike', 'Alex', 'Priya'], badge: 'streak', joinedDate: 'May 2024', avgPace: '5:07', weeklyKm: 30, recentActivities: [{ title: 'Morning Run', distance: 8.2, pace: '5:07', time: '2h ago', zones: 3 }] },
  { id: 'sr2', name: 'Sam Wilson', initial: 'S', color: 'from-indigo-400 to-blue-600', level: 18, totalDistance: 720, territories: 12, mutualCount: 0, mutualNames: [], joinedDate: 'Oct 2024', avgPace: '5:50', weeklyKm: 14, recentActivities: [{ title: 'Easy Jog', distance: 3.5, pace: '6:00', time: 'Yesterday', zones: 1 }] },
  { id: 'sr3', name: 'Sarika Menon', initial: 'S', color: 'from-amber-400 to-orange-500', level: 22, totalDistance: 1100, territories: 19, mutualCount: 1, mutualNames: ['Priya'], location: 'Mumbai', joinedDate: 'Jul 2024', avgPace: '5:35', weeklyKm: 22, recentActivities: [{ title: 'Beach Run', distance: 6.0, pace: '5:30', time: '5h ago', zones: 2 }] },
];

const badgeConfig: Record<string, { icon: typeof Flame; color: string; bg: string; label: string }> = {
  top10: { icon: Crown, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Top 10' },
  streak: { icon: Flame, color: 'text-orange-600', bg: 'bg-orange-50', label: 'On Fire' },
  conqueror: { icon: Shield, color: 'text-teal-600', bg: 'bg-teal-50', label: 'Conqueror' },
};

// --- Subcomponents ---

function RoutePreview({ route, className = '' }: { route: [number, number][]; className?: string }) {
  const points = route.map(([x, y]) => `${x},${y}`).join(' ');
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-b from-gray-50 to-gray-100" />
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
        <polyline points={points} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={points} fill="none" stroke="#0D9488" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={route[0][0]} cy={route[0][1]} r="2.5" fill="#0D9488" />
        <circle cx={route[route.length - 1][0]} cy={route[route.length - 1][1]} r="2.5" fill="#DC2626" />
      </svg>
    </div>
  );
}

function KudosAvatars({ users, total }: { users: KudosUser[]; total: number }) {
  const shown = users.slice(0, 3);
  const remaining = total - shown.length;
  return (
    <div className="flex items-center">
      <div className="flex -space-x-1.5">
        {shown.map((u, i) => (
          <div key={i} className={`w-5 h-5 rounded-full bg-gradient-to-br ${u.color} flex items-center justify-center text-[7px] font-bold text-white ring-2 ring-white`}>
            {u.initial}
          </div>
        ))}
      </div>
      <span className="ml-1.5 text-[11px] text-gray-500">
        {remaining > 0 ? `and ${remaining} others` : shown.map(u => u.name).join(', ')}
      </span>
    </div>
  );
}

// --- Main Component ---

export default function Feed() {
  const [activeTab, setActiveTab] = useState<FeedTab>('explore');
  const [reactions, setReactions] = useState<Record<string, ReactionType | null>>({});
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPressRef = useRef(false);

  // Following tab state
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showContactsSheet, setShowContactsSheet] = useState(false);
  const [contactsSynced, setContactsSynced] = useState(false);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [showAllNearby, setShowAllNearby] = useState(false);
  const [showAllPopular, setShowAllPopular] = useState(false);
  const [profileRunner, setProfileRunner] = useState<SuggestedRunner | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const toggleFollow = (id: string) => {
    setFollowing(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const dismissSuggestion = (id: string) => {
    haptic('light');
    setDismissed(prev => new Set(prev).add(id));
  };

  const sendInvite = (id: string) => {
    haptic('medium');
    setInvited(prev => new Set(prev).add(id));
  };

  const toggleReaction = (postId: string, type: ReactionType) => {
    haptic('light');
    setReactions(prev => ({ ...prev, [postId]: prev[postId] === type ? null : type }));
    setShowReactionPicker(null);
  };

  const handleKudosTap = useCallback((postId: string) => {
    if (didLongPressRef.current) { didLongPressRef.current = false; return; }
    haptic('light');
    if (reactions[postId]) setReactions(prev => ({ ...prev, [postId]: null }));
    else setReactions(prev => ({ ...prev, [postId]: 'kudos' }));
  }, [reactions]);

  const handleTouchStart = useCallback((postId: string) => {
    didLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      didLongPressRef.current = true;
      haptic('medium');
      setShowReactionPicker(prev => prev === postId ? null : postId);
    }, 500);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
  }, []);

  const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
  const itemAnim = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, damping: 22, stiffness: 180 } } };

  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const filteredSearchResults = searchQuery.trim().length >= 2
    ? searchResults.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const visibleNearby = suggestedNearby.filter(r => !dismissed.has(r.id));
  const visiblePopular = suggestedPopular.filter(r => !dismissed.has(r.id));
  const visibleFromClubs = suggestedFromClubs.filter(r => !dismissed.has(r.id));

  const contactsOnRunivo = contactEntries.filter(c => c.isOnRunivo);
  const contactsNotOnRunivo = contactEntries.filter(c => !c.isOnRunivo);

  // ===== RUNNER PROFILE SHEET =====
  if (profileRunner) {
    const badge = profileRunner.badge ? badgeConfig[profileRunner.badge] : null;
    const BadgeIcon = badge?.icon;
    const isFollowingProfile = following.has(profileRunner.id);

    return (
      <div className="h-full bg-white overflow-y-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 z-10"
             style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}>
          <div className="flex items-center gap-3 px-4 py-2.5">
            <button onClick={() => { setProfileRunner(null); haptic('light'); }} className="p-1.5 -ml-1 rounded-full active:bg-gray-100 transition">
              <ArrowLeft className="w-5 h-5 text-gray-700" strokeWidth={2} />
            </button>
            <span className="text-[15px] font-bold text-gray-900">{profileRunner.name}</span>
          </div>
        </div>

        {/* Profile header */}
        <div className="px-5 pt-6 pb-5">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="relative">
              <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${profileRunner.color} flex items-center justify-center text-2xl font-bold text-white shadow-lg`}>
                {profileRunner.initial}
              </div>
              {badge && BadgeIcon && (
                <div className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-full ${badge.bg} flex items-center justify-center ring-3 ring-white`}>
                  <BadgeIcon className={`w-3.5 h-3.5 ${badge.color}`} strokeWidth={2.5} />
                </div>
              )}
            </div>

            {/* Stats row */}
            <div className="flex-1 flex justify-around pt-2">
              {[
                { value: profileRunner.totalDistance.toLocaleString(), label: 'km' },
                { value: profileRunner.territories, label: 'Zones' },
                { value: profileRunner.mutualCount, label: 'Mutual' },
              ].map((s, i) => (
                <div key={i} className="text-center">
                  <span className="text-[18px] font-bold text-gray-900 block">{s.value}</span>
                  <span className="text-[11px] text-gray-400">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Name + meta */}
          <div className="mt-3.5">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[16px] font-bold text-gray-900">{profileRunner.name}</span>
              {profileRunner.isVerified && (
                <div className="w-4.5 h-4.5 rounded-full bg-teal-500 flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 text-[12px] text-gray-400">
              <span>Lv.{profileRunner.level}</span>
              {profileRunner.location && (
                <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" strokeWidth={2} />{profileRunner.location}</span>
              )}
              {profileRunner.joinedDate && (
                <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3" strokeWidth={2} />Since {profileRunner.joinedDate}</span>
              )}
            </div>
          </div>

          {/* Mutual followers */}
          {profileRunner.mutualCount > 0 && (
            <p className="text-[12px] text-gray-400 mt-2">
              Followed by <span className="font-medium text-gray-600">{profileRunner.mutualNames.slice(0, 3).join(', ')}</span>
              {profileRunner.mutualCount > 3 && <span> and {profileRunner.mutualCount - 3} others</span>}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => { toggleFollow(profileRunner.id); haptic('light'); }}
              className={`flex-1 py-2.5 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-all ${
                isFollowingProfile
                  ? 'bg-gray-100 text-gray-600'
                  : 'bg-teal-500 text-white active:bg-teal-600 shadow-sm shadow-teal-200'
              }`}
            >
              {isFollowingProfile ? (
                <><Check className="w-4 h-4" strokeWidth={2.5} />Following</>
              ) : (
                <><UserPlus className="w-4 h-4" strokeWidth={2} />Follow</>
              )}
            </button>
            <button className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white text-[13px] font-semibold flex items-center justify-center gap-1.5 active:bg-gray-800 transition shadow-sm">
              <Swords className="w-4 h-4" strokeWidth={2} />
              Challenge
            </button>
            <button className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center active:bg-gray-200 transition flex-shrink-0">
              <Send className="w-4 h-4 text-gray-600" strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Weekly summary strip */}
        <div className="bg-gray-50 border-y border-gray-100 px-5 py-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">This Week</span>
            {badge && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.bg} ${badge.color}`}>{badge.label}</span>
            )}
          </div>
          <div className="flex items-center gap-5 mt-2">
            {[
              { value: `${profileRunner.weeklyKm || 0}`, unit: 'km', label: 'Distance' },
              { value: profileRunner.avgPace || '--', unit: '/km', label: 'Avg Pace' },
              { value: `${profileRunner.level}`, unit: '', label: 'Level' },
            ].map((s, i) => (
              <div key={i}>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-[20px] font-bold text-gray-900">{s.value}</span>
                  <span className="text-[11px] text-gray-400">{s.unit}</span>
                </div>
                <span className="text-[10px] text-gray-400">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activities */}
        <div className="px-5 pt-5 pb-20">
          <span className="text-[13px] font-bold text-gray-900 mb-3 block">Recent Activity</span>
          <div className="space-y-2.5">
            {(profileRunner.recentActivities || []).map((act, i) => (
              <div key={i} className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] font-semibold text-gray-800">{act.title}</span>
                  <span className="text-[11px] text-gray-400">{act.time}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-[16px] font-bold text-gray-900">{act.distance}</span>
                    <span className="text-[11px] text-gray-400 ml-0.5">km</span>
                  </div>
                  <div className="h-4 w-px bg-gray-200" />
                  <div>
                    <span className="text-[13px] font-semibold text-gray-700">{act.pace}</span>
                    <span className="text-[10px] text-gray-400 ml-0.5">/km</span>
                  </div>
                  {act.zones > 0 && (
                    <>
                      <div className="h-4 w-px bg-gray-200" />
                      <div className="flex items-center gap-1">
                        <Flag className="w-3 h-3 text-teal-500" strokeWidth={2} />
                        <span className="text-[12px] font-semibold text-teal-600">{act.zones}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {(!profileRunner.recentActivities || profileRunner.recentActivities.length === 0) && (
            <div className="py-10 text-center">
              <TrendingUp className="w-8 h-8 text-gray-200 mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-[13px] text-gray-400">No recent activity</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===== MAIN FEED =====
  return (
    <div className="h-full bg-[#FAFAFA] overflow-y-auto pb-24">
      <div style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <div className="px-5 mb-1">
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Feed</h1>
        </div>

        <div className="px-5 mb-4">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {(['explore', 'following'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); haptic('light'); }}
                className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all capitalize ${
                  activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'
                }`}
              >
                {tab === 'explore' ? 'Discover' : 'Following'}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'explore' ? (
          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-3 px-4">
            {mockPosts.map((post) => {
              const currentReaction = reactions[post.id];
              const reactionData = currentReaction ? REACTIONS.find(r => r.type === currentReaction) : null;
              const hasReacted = !!currentReaction;
              const activityIcon = ACTIVITY_ICONS[post.activity.type];

              return (
                <motion.div key={post.id} variants={itemAnim} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                    <div className="relative">
                      <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${post.user.color} flex items-center justify-center text-sm font-bold text-white`}>
                        {post.user.initial}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full ${activityIcon.bg} flex items-center justify-center text-[9px] ring-2 ring-white`}>
                        {activityIcon.icon}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-gray-900 truncate">{post.user.name}</span>
                        <span className="text-[11px] text-gray-400 flex-shrink-0">{post.timestamp}</span>
                      </div>
                      {post.location && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-gray-300" />
                          <span className="text-[11px] text-gray-400 truncate">{post.location}</span>
                        </div>
                      )}
                    </div>
                    <button className="p-1 -mr-1"><MoreHorizontal className="w-5 h-5 text-gray-300" /></button>
                  </div>

                  <div className="px-4 pb-3">
                    <h3 className="text-[15px] font-bold text-gray-900 mb-1">{post.activity.title}</h3>
                    {post.activity.description && <p className="text-[13px] text-gray-500 leading-relaxed">{post.activity.description}</p>}
                  </div>

                  <RoutePreview route={post.activity.route} className="h-44 mx-4 rounded-xl mb-3" />

                  <div className="px-4 pb-3">
                    <div className="flex items-end gap-4">
                      <div>
                        <span className="text-stat text-2xl font-bold text-gray-900">{post.activity.distance}</span>
                        <span className="text-stat text-xs text-gray-400 ml-0.5">km</span>
                      </div>
                      <div className="h-6 w-px bg-gray-200" />
                      <div>
                        <span className="text-stat text-sm font-semibold text-gray-700">{formatDuration(post.activity.duration)}</span>
                        <span className="text-[10px] text-gray-400 block">Time</span>
                      </div>
                      <div className="h-6 w-px bg-gray-200" />
                      <div>
                        <span className="text-stat text-sm font-semibold text-gray-700">{post.activity.pace}</span>
                        <span className="text-[10px] text-gray-400 block">Pace</span>
                      </div>
                      {post.activity.elevation && post.activity.elevation > 0 && (
                        <>
                          <div className="h-6 w-px bg-gray-200" />
                          <div>
                            <span className="text-stat text-sm font-semibold text-gray-700">{post.activity.elevation}</span>
                            <span className="text-[10px] text-gray-400 block">Elev m</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {(post.activity.territoriesClaimed > 0 || post.activity.enemyZonesCaptured || post.activity.pr) && (
                    <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                      {post.activity.territoriesClaimed > 0 && (
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-50 border border-teal-100">
                          <Flag className="w-3 h-3 text-teal-500" />
                          <span className="text-[11px] font-semibold text-teal-600">{post.activity.territoriesClaimed} zone{post.activity.territoriesClaimed !== 1 ? 's' : ''} claimed</span>
                        </div>
                      )}
                      {post.activity.enemyZonesCaptured && post.activity.enemyZonesCaptured > 0 && (
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-pink-50 border border-pink-100">
                          <Zap className="w-3 h-3 text-pink-500" />
                          <span className="text-[11px] font-semibold text-pink-600">{post.activity.enemyZonesCaptured} captured</span>
                        </div>
                      )}
                      {post.activity.pr && (
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-100">
                          <Trophy className="w-3 h-3 text-amber-500" />
                          <span className="text-[11px] font-semibold text-amber-600">{post.activity.pr.label}: {post.activity.pr.value}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <AnimatePresence>
                    {showReactionPicker === post.id && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.9 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                        className="flex items-center justify-center gap-1 mx-4 mb-2 py-2 px-3 bg-white rounded-2xl border border-gray-200 shadow-lg w-fit"
                      >
                        {REACTIONS.map(r => (
                          <motion.button key={r.type} whileTap={{ scale: 0.85 }} onClick={() => toggleReaction(post.id, r.type)}
                            className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl transition-colors ${currentReaction === r.type ? 'bg-teal-50 border border-teal-200' : 'active:bg-gray-50'}`}
                          >{r.emoji}</motion.button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {post.kudos > 0 && (
                    <div className="px-4 pb-2">
                      <KudosAvatars users={post.kudosUsers} total={post.kudos + (hasReacted ? 1 : 0)} />
                    </div>
                  )}

                  <div className="flex items-center px-4 py-3 border-t border-gray-100">
                    <button onClick={() => handleKudosTap(post.id)}
                      onContextMenu={(e) => { e.preventDefault(); haptic('medium'); setShowReactionPicker(prev => prev === post.id ? null : post.id); }}
                      onTouchStart={() => handleTouchStart(post.id)} onTouchEnd={handleTouchEnd}
                      className={`flex items-center gap-1.5 py-1.5 px-3 rounded-full transition-colors ${hasReacted ? 'bg-teal-50' : 'active:bg-gray-50'}`}
                    >
                      {hasReacted ? (
                        <motion.span key={currentReaction} initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: 'spring', damping: 10, stiffness: 400 }} className="text-lg">{reactionData?.emoji}</motion.span>
                      ) : (<Heart className="w-[18px] h-[18px] text-gray-400" />)}
                      <span className={`text-xs font-semibold ${hasReacted ? 'text-teal-600' : 'text-gray-500'}`}>{post.kudos + (hasReacted ? 1 : 0)}</span>
                    </button>
                    <button className="flex items-center gap-1.5 py-1.5 px-3 rounded-full active:bg-gray-50 ml-1">
                      <MessageCircle className="w-[18px] h-[18px] text-gray-400" />
                      <span className="text-xs font-semibold text-gray-500">{post.comments}</span>
                    </button>
                    <button className="ml-auto p-2 rounded-full active:bg-gray-50">
                      <Share2 className="w-[18px] h-[18px] text-gray-400" />
                    </button>
                  </div>
                </motion.div>
              );
            })}

            <div className="flex flex-col items-center py-8 gap-2">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-gray-300" />
              </div>
              <span className="text-xs text-gray-400 font-medium">You're all caught up</span>
            </div>
          </motion.div>
        ) : (
          /* ===== FOLLOWING TAB ===== */
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-4">

            {/* Search */}
            <div className="px-4 mb-4">
              <div className={`flex items-center gap-2.5 bg-white rounded-xl border transition-all px-3.5 ${
                isSearchFocused ? 'border-teal-300 shadow-sm shadow-teal-50' : 'border-gray-200'
              }`}>
                <Search className="w-4 h-4 text-gray-400 flex-shrink-0" strokeWidth={2} />
                <input ref={searchInputRef} type="text" value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => { if (!searchQuery) setIsSearchFocused(false); }}
                  placeholder="Search runners..."
                  className="flex-1 bg-transparent border-none outline-none text-[14px] text-gray-900 placeholder:text-gray-400 py-3"
                />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(''); searchInputRef.current?.blur(); setIsSearchFocused(false); }}
                    className="p-1 rounded-full active:bg-gray-100">
                    <X className="w-4 h-4 text-gray-400" strokeWidth={2} />
                  </button>
                )}
              </div>
            </div>

            {/* Search Results */}
            <AnimatePresence>
              {isSearchFocused && searchQuery.trim().length >= 2 && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="px-4 mb-4">
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {filteredSearchResults.length > 0 ? (
                      <div className="divide-y divide-gray-50">
                        {filteredSearchResults.map(runner => (
                          <button key={runner.id} className="w-full flex items-center gap-3 px-4 py-3 active:bg-gray-50 transition text-left"
                            onClick={() => { setProfileRunner(runner); setSearchQuery(''); setIsSearchFocused(false); haptic('light'); }}>
                            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${runner.color} flex items-center justify-center text-sm font-bold text-white`}>{runner.initial}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[13px] font-semibold text-gray-900 truncate">{runner.name}</span>
                                <span className="text-[11px] text-gray-400">Lv.{runner.level}</span>
                              </div>
                              <span className="text-[11px] text-gray-400">{runner.territories} zones &middot; {runner.totalDistance} km</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-300" strokeWidth={2} />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="py-8 text-center">
                        <Search className="w-8 h-8 text-gray-200 mx-auto mb-2" strokeWidth={1.5} />
                        <p className="text-[13px] text-gray-400">No runners found for "{searchQuery}"</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!(isSearchFocused && searchQuery.trim().length >= 2) && (
              <>
                {/* Contacts Card */}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-4 mb-5">
                  <button
                    onClick={() => { setShowContactsSheet(true); haptic('light'); }}
                    className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3.5 active:bg-gray-50 transition text-left"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center flex-shrink-0 shadow-md">
                      <Smartphone className="w-5.5 h-5.5 text-white" strokeWidth={1.8} />
                    </div>
                    <div className="flex-1">
                      <span className="text-[14px] font-semibold text-gray-900 block">Find Friends from Contacts</span>
                      <span className="text-[12px] text-gray-400">
                        {contactsSynced ? `${contactsOnRunivo.length} on Runivo` : 'Connect to discover runners you know'}
                      </span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" strokeWidth={2} />
                  </button>
                </motion.div>

                {/* Suggested for You — Horizontal cards */}
                {visiblePopular.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-5">
                    <div className="flex items-center justify-between px-5 mb-2.5">
                      <span className="text-[13px] font-bold text-gray-900">Suggested for You</span>
                      <button onClick={() => { setShowAllPopular(!showAllPopular); haptic('light'); }} className="text-[12px] font-semibold text-teal-600 active:opacity-70">
                        {showAllPopular ? 'Less' : 'See All'}
                      </button>
                    </div>

                    {!showAllPopular ? (
                      <div className="overflow-x-auto scrollbar-hide">
                        <div className="flex gap-2.5 px-4 pb-1">
                          {visiblePopular.map(runner => {
                            const bg = runner.badge ? badgeConfig[runner.badge] : null;
                            const BI = bg?.icon;
                            return (
                              <button key={runner.id} onClick={() => { setProfileRunner(runner); haptic('light'); }}
                                className="w-[156px] flex-shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col items-center relative active:scale-[0.98] transition text-center">
                                <button onClick={(e) => { e.stopPropagation(); dismissSuggestion(runner.id); }}
                                  className="absolute top-2 right-2 p-1 rounded-full active:bg-gray-100 transition">
                                  <X className="w-3.5 h-3.5 text-gray-300" strokeWidth={2} />
                                </button>
                                <div className="relative mb-2.5">
                                  <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${runner.color} flex items-center justify-center text-lg font-bold text-white shadow-md`}>
                                    {runner.initial}
                                  </div>
                                  {bg && BI && (
                                    <div className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full ${bg.bg} flex items-center justify-center ring-2 ring-white`}>
                                      <BI className={`w-2.5 h-2.5 ${bg.color}`} strokeWidth={2.5} />
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 mb-0.5">
                                  <span className="text-[13px] font-semibold text-gray-900 truncate max-w-[110px]">{runner.name}</span>
                                  {runner.isVerified && (
                                    <div className="w-3.5 h-3.5 rounded-full bg-teal-500 flex items-center justify-center flex-shrink-0">
                                      <Check className="w-2 h-2 text-white" strokeWidth={3} />
                                    </div>
                                  )}
                                </div>
                                <span className="text-[10px] text-gray-400 mb-3">{runner.territories} zones &middot; Lv.{runner.level}</span>
                                {runner.mutualCount > 0 && (
                                  <p className="text-[10px] text-gray-400 mb-2 leading-tight">
                                    Followed by {runner.mutualNames[0]}{runner.mutualCount > 1 ? ` +${runner.mutualCount - 1}` : ''}
                                  </p>
                                )}
                                <div onClick={(e) => { e.stopPropagation(); toggleFollow(runner.id); haptic('light'); }}
                                  className={`w-full py-2 rounded-lg text-[12px] font-semibold transition-all ${
                                    following.has(runner.id) ? 'bg-gray-100 text-gray-500' : 'bg-teal-500 text-white active:bg-teal-600'
                                  }`}>{following.has(runner.id) ? 'Following' : 'Follow'}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white mx-4 rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
                        {visiblePopular.map(runner => (
                          <button key={runner.id} onClick={() => { setProfileRunner(runner); haptic('light'); }}
                            className="w-full flex items-center gap-3 px-4 py-3 active:bg-gray-50 transition text-left">
                            <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${runner.color} flex items-center justify-center text-sm font-bold text-white`}>{runner.initial}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[13px] font-semibold text-gray-900 truncate">{runner.name}</span>
                                {runner.isVerified && <div className="w-3.5 h-3.5 rounded-full bg-teal-500 flex items-center justify-center flex-shrink-0"><Check className="w-2 h-2 text-white" strokeWidth={3} /></div>}
                                <span className="text-[11px] text-gray-400">Lv.{runner.level}</span>
                              </div>
                              <span className="text-[11px] text-gray-400">{runner.recentRun || `${runner.territories} zones`}</span>
                            </div>
                            <div onClick={(e) => { e.stopPropagation(); toggleFollow(runner.id); haptic('light'); }}
                              className={`px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all flex-shrink-0 ${
                                following.has(runner.id) ? 'bg-gray-100 text-gray-500' : 'bg-teal-500 text-white active:bg-teal-600'
                              }`}>{following.has(runner.id) ? 'Following' : 'Follow'}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Runners Near You */}
                {visibleNearby.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-5">
                    <div className="flex items-center justify-between px-5 mb-2.5">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-teal-500" strokeWidth={2} />
                        <span className="text-[13px] font-bold text-gray-900">Runners Near You</span>
                      </div>
                      <button onClick={() => { setShowAllNearby(!showAllNearby); haptic('light'); }}
                        className="text-[12px] font-semibold text-teal-600 active:opacity-70">
                        {showAllNearby ? 'Less' : 'See All'}
                      </button>
                    </div>
                    <div className="bg-white mx-4 rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
                      {(showAllNearby ? visibleNearby : visibleNearby.slice(0, 3)).map(runner => (
                        <button key={runner.id} onClick={() => { setProfileRunner(runner); haptic('light'); }}
                          className="w-full flex items-center gap-3 px-4 py-3 active:bg-gray-50 transition text-left">
                          <div className="relative flex-shrink-0">
                            <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${runner.color} flex items-center justify-center text-sm font-bold text-white`}>{runner.initial}</div>
                            {runner.badge && badgeConfig[runner.badge] && (() => { const b = badgeConfig[runner.badge!]; const I = b.icon; return (
                              <div className={`absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 rounded-full ${b.bg} flex items-center justify-center ring-2 ring-white`}>
                                <I className={`w-2.5 h-2.5 ${b.color}`} strokeWidth={2.5} />
                              </div>
                            ); })()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[13px] font-semibold text-gray-900 truncate">{runner.name}</span>
                              <span className="text-[11px] text-gray-400">Lv.{runner.level}</span>
                            </div>
                            <span className="text-[11px] text-gray-400">{runner.recentRun || runner.location}</span>
                          </div>
                          <div onClick={(e) => { e.stopPropagation(); toggleFollow(runner.id); haptic('light'); }}
                            className={`px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all flex-shrink-0 ${
                              following.has(runner.id) ? 'bg-gray-100 text-gray-500' : 'bg-teal-500 text-white active:bg-teal-600'
                            }`}>{following.has(runner.id) ? 'Following' : 'Follow'}</div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* From Your Clubs */}
                {visibleFromClubs.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-5">
                    <div className="flex items-center gap-1.5 px-5 mb-2.5">
                      <Users className="w-3.5 h-3.5 text-teal-500" strokeWidth={2} />
                      <span className="text-[13px] font-bold text-gray-900">From Your Clubs</span>
                    </div>
                    <div className="bg-white mx-4 rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
                      {visibleFromClubs.map(runner => (
                        <button key={runner.id} onClick={() => { setProfileRunner(runner); haptic('light'); }}
                          className="w-full flex items-center gap-3 px-4 py-3 active:bg-gray-50 transition text-left">
                          <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${runner.color} flex items-center justify-center text-sm font-bold text-white`}>{runner.initial}</div>
                          <div className="flex-1 min-w-0">
                            <span className="text-[13px] font-semibold text-gray-900 block truncate">{runner.name}</span>
                            <span className="text-[11px] text-gray-400">{runner.recentRun}</span>
                          </div>
                          <div onClick={(e) => { e.stopPropagation(); toggleFollow(runner.id); haptic('light'); }}
                            className={`px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all flex-shrink-0 ${
                              following.has(runner.id) ? 'bg-gray-100 text-gray-500' : 'bg-teal-500 text-white active:bg-teal-600'
                            }`}>{following.has(runner.id) ? 'Following' : 'Follow'}</div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Invite Friends */}
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mx-4 mb-4">
                  <button className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3.5 active:bg-gray-50 transition">
                    <div className="w-11 h-11 rounded-xl bg-teal-50 flex items-center justify-center flex-shrink-0">
                      <UserPlus className="w-5 h-5 text-teal-500" strokeWidth={1.8} />
                    </div>
                    <div className="flex-1 text-left">
                      <span className="text-[14px] font-semibold text-gray-900 block">Invite Friends to Runivo</span>
                      <span className="text-[12px] text-gray-400">Share a link to get them running</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" strokeWidth={2} />
                  </button>
                </motion.div>

                {following.size > 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-4">
                    <span className="text-[12px] text-gray-400">
                      You follow <span className="font-semibold text-teal-600">{following.size}</span> runner{following.size !== 1 ? 's' : ''}
                    </span>
                  </motion.div>
                )}
              </>
            )}
          </motion.div>
        )}
      </div>

      {/* ===== CONTACTS BOTTOM SHEET ===== */}
      <AnimatePresence>
        {showContactsSheet && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-[60]"
              onClick={() => setShowContactsSheet(false)} />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-[70] bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto"
              style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
            >
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-gray-200" />
              </div>

              <div className="px-5 pb-2">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-[17px] font-bold text-gray-900">Your Contacts</h3>
                  <button onClick={() => setShowContactsSheet(false)} className="p-1 rounded-full active:bg-gray-100">
                    <X className="w-5 h-5 text-gray-400" strokeWidth={2} />
                  </button>
                </div>
              </div>

              {!contactsSynced ? (
                /* Permission prompt */
                <div className="px-5 pb-6 pt-4 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Smartphone className="w-8 h-8 text-white" strokeWidth={1.5} />
                  </div>
                  <h4 className="text-[16px] font-bold text-gray-900 mb-1">Connect Your Contacts</h4>
                  <p className="text-[13px] text-gray-400 leading-relaxed mb-5 max-w-[280px] mx-auto">
                    Find friends who are already on Runivo and invite others to join you
                  </p>
                  <button
                    onClick={() => { setContactsSynced(true); haptic('medium'); }}
                    className="w-full py-3.5 rounded-xl bg-gray-900 text-white font-semibold text-[14px] active:bg-gray-800 transition shadow-sm"
                  >
                    Allow Access
                  </button>
                  <p className="text-[11px] text-gray-300 mt-3">Your contacts are never stored on our servers</p>
                </div>
              ) : (
                /* Contacts list */
                <div className="pb-4">
                  {/* On Runivo */}
                  {contactsOnRunivo.length > 0 && (
                    <div className="mb-4">
                      <div className="px-5 mb-2 flex items-center gap-2">
                        <span className="text-[12px] font-bold text-gray-900 uppercase tracking-wider">On Runivo</span>
                        <span className="text-[11px] font-semibold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">{contactsOnRunivo.length}</span>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {contactsOnRunivo.map(contact => (
                          <div key={contact.id} className="flex items-center gap-3 px-5 py-3">
                            <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${contact.color} flex items-center justify-center text-sm font-bold text-white`}>{contact.initial}</div>
                            <div className="flex-1 min-w-0">
                              <span className="text-[14px] font-semibold text-gray-900 block truncate">{contact.name}</span>
                              <span className="text-[11px] text-gray-400">Lv.{contact.level} &middot; {contact.territories} zones</span>
                            </div>
                            <button onClick={() => { toggleFollow(contact.id); haptic('light'); }}
                              className={`px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all flex-shrink-0 ${
                                following.has(contact.id) ? 'bg-gray-100 text-gray-500' : 'bg-teal-500 text-white active:bg-teal-600'
                              }`}>{following.has(contact.id) ? 'Following' : 'Follow'}</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Not on Runivo */}
                  {contactsNotOnRunivo.length > 0 && (
                    <div>
                      <div className="px-5 mb-2 flex items-center gap-2">
                        <span className="text-[12px] font-bold text-gray-500 uppercase tracking-wider">Invite to Runivo</span>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {contactsNotOnRunivo.map(contact => (
                          <div key={contact.id} className="flex items-center gap-3 px-5 py-3">
                            <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${contact.color} flex items-center justify-center text-sm font-bold text-white opacity-60`}>{contact.initial}</div>
                            <div className="flex-1 min-w-0">
                              <span className="text-[14px] font-medium text-gray-700 block truncate">{contact.name}</span>
                              <span className="text-[11px] text-gray-400">{contact.phone}</span>
                            </div>
                            <button onClick={() => sendInvite(contact.id)}
                              className={`px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all flex-shrink-0 ${
                                invited.has(contact.id)
                                  ? 'bg-gray-100 text-gray-400'
                                  : 'bg-gray-900 text-white active:bg-gray-800'
                              }`}>
                              {invited.has(contact.id) ? 'Invited' : 'Invite'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
