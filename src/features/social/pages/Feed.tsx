import { useState, useRef, useCallback, useEffect } from 'react';
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
import { supabase } from '@shared/services/supabase';
import { toggleLike } from '@shared/services/sync';

// Module-level flag: once we confirm the followers table is missing (local dev
// with unmigrated DB), stop retrying on every Feed mount to avoid console spam.
let followersTableAvailable = true;

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
  userId: string;
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

const AVATAR_COLORS = [
  'from-rose-400 to-pink-500', 'from-blue-400 to-indigo-500',
  'from-orange-400 to-red-500', 'from-teal-400 to-cyan-500',
  'from-purple-400 to-violet-500', 'from-amber-400 to-orange-400',
  'from-emerald-400 to-green-500', 'from-sky-400 to-blue-500',
];

function getColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function buildPost(row: {
  id: string; user_id: string; content: string | null; distance_km: number | null;
  territories_claimed: number | null; likes: number; created_at: string;
  profiles: { username: string; level: number } | null;
}): Post {
  const name = row.profiles?.username ?? 'Runner';
  const distKm = row.distance_km ?? 0;
  const zones = row.territories_claimed ?? 0;
  return {
    id: row.id,
    userId: row.user_id,
    user: { name, initial: name.charAt(0).toUpperCase(), color: getColor(name) },
    activity: {
      type: 'run',
      title: row.content ?? `${distKm.toFixed(1)} km run`,
      description: row.content ?? undefined,
      distance: distKm,
      duration: 0,
      pace: '–',
      territoriesClaimed: zones,
      route: [[10, 20], [30, 40], [50, 60], [70, 50], [85, 30]] as [number, number][],
    },
    kudos: row.likes,
    kudosUsers: [],
    comments: 0,
    timestamp: timeAgo(row.created_at),
  };
}

export default function Feed() {
  const [activeTab, setActiveTab] = useState<FeedTab>('explore');
  const [reactions, setReactions] = useState<Record<string, ReactionType | null>>({});
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPressRef = useRef(false);

  // Live feed from Supabase
  const [posts, setPosts] = useState<Post[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);

  useEffect(() => {
    loadFeed(activeTab);
  }, [activeTab]); // loadFeed is defined inside the component and intentionally not in deps

  const loadFeed = async (tab: FeedTab) => {
    setFeedLoading(true);
    setPosts([]);

    if (tab === 'following') {
      // Personalised feed: own posts + posts from people I follow
      const { data, error } = await supabase.rpc('get_feed', { lim: 40, off_set: 0 });
      if (!error && data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setPosts((data as any[]).map(row => ({
          id: row.id,
          userId: row.user_id,
          user: {
            name: row.username ?? 'Runner',
            initial: (row.username ?? 'R').charAt(0).toUpperCase(),
            color: getColor(row.username ?? 'Runner'),
          },
          activity: {
            type: 'run' as ActivityType,
            title: row.content ?? `${(row.distance_km ?? 0).toFixed(1)} km run`,
            description: row.content ?? undefined,
            distance: row.distance_km ?? 0,
            duration: 0,
            pace: '–',
            territoriesClaimed: row.territories_claimed ?? 0,
            route: [[10, 20], [30, 40], [50, 60], [70, 50], [85, 30]] as [number, number][],
          },
          kudos: row.likes,
          kudosUsers: [],
          comments: row.comment_count ?? 0,
          timestamp: timeAgo(row.created_at),
        })));
      }
    } else {
      // Explore: all recent posts
      const { data } = await supabase
        .from('feed_posts')
        .select('id, user_id, content, distance_km, territories_claimed, likes, created_at, profiles(username, level)')
        .order('created_at', { ascending: false })
        .limit(30);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (data) setPosts(data.map(row => buildPost(row as any)));
    }

    setFeedLoading(false);
  };

  // Current user's username for invite links
  const [myUsername, setMyUsername] = useState('');
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      supabase.from('profiles').select('username').eq('id', session.user.id).single()
        .then(({ data }) => { if (data?.username) setMyUsername(data.username); });
    });
  }, []);

  // Runners (Discover tab) from Supabase
  const [runners, setRunners] = useState<SuggestedRunner[]>([]);

  useEffect(() => { loadRunners(); }, []);

  const loadRunners = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const query = supabase
      .from('profiles')
      .select('id, username, level, total_distance_km, total_territories_claimed, streak_days, created_at')
      .order('level', { ascending: false })
      .limit(30);
    if (session?.user) query.neq('id', session.user.id);
    const { data } = await query;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setRunners((data ?? []).map((row: any) => {
      const name = row.username ?? 'Runner';
      const badge: SuggestedRunner['badge'] =
        row.total_territories_claimed >= 50 ? 'conqueror'
        : row.streak_days >= 7 ? 'streak'
        : row.level >= 30 ? 'top10'
        : undefined;
      return {
        id: row.id,
        name,
        initial: name.charAt(0).toUpperCase(),
        color: getColor(name),
        level: row.level ?? 1,
        totalDistance: Math.round(row.total_distance_km ?? 0),
        territories: row.total_territories_claimed ?? 0,
        mutualCount: 0,
        mutualNames: [],
        badge,
        joinedDate: new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        recentActivities: [],
      } satisfies SuggestedRunner;
    }));
  };

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

  // Load who the current user already follows from Supabase
  useEffect(() => {
    if (!followersTableAvailable) return;
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data, error } = await supabase
        .from('followers')
        .select('following_id')
        .eq('follower_id', session.user.id);
      if (error) {
        // Table doesn't exist yet (migrations not applied) — stop retrying
        followersTableAvailable = false;
        return;
      }
      if (data) setFollowing(new Set(data.map((r: { following_id: string }) => r.following_id)));
    };
    load();
  }, []);

  const toggleFollow = async (id: string) => {
    // Optimistic update
    setFollowing(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    if (!followersTableAvailable) return;
    // Persist via RPC (fire-and-forget; revert on error)
    const { error } = await supabase.rpc('toggle_follow', { target_id: id });
    if (error) {
      followersTableAvailable = false;
      // Revert
      setFollowing(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    }
  };

  const dismissSuggestion = (id: string) => {
    haptic('light');
    setDismissed(prev => new Set(prev).add(id));
  };

  const buildInviteUrl = () =>
    `https://runivo.app/join${myUsername ? `?ref=${encodeURIComponent(myUsername)}` : ''}`;

  const sendInvite = async (contactId: string, contactName?: string, contactPhone?: string) => {
    haptic('medium');
    const url = buildInviteUrl();
    const text = `Hey${contactName ? ` ${contactName.split(' ')[0]}` : ''}! I'm running & conquering territories on Runivo. Join me 🏃 ${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Join me on Runivo', text });
      } else if (contactPhone) {
        window.open(`sms:${contactPhone}?body=${encodeURIComponent(text)}`, '_blank');
      } else {
        await navigator.clipboard.writeText(text);
      }
      setInvited(prev => new Set(prev).add(contactId));
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') setInvited(prev => new Set(prev).add(contactId));
    }
  };

  const inviteFriends = async () => {
    haptic('medium');
    const url = buildInviteUrl();
    const text = `Running & conquering territories on Runivo — join me! 🏃⚔️ ${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Join me on Runivo', text, url });
      } else {
        await navigator.clipboard.writeText(text);
      }
    } catch {/* user cancelled */}
  };

  const sharePost = async (post: Post) => {
    haptic('light');
    const text = `${post.user.name} ran ${post.activity.distance.toFixed(2)} km${post.activity.territoriesClaimed > 0 ? ` · ${post.activity.territoriesClaimed} zones claimed` : ''} on Runivo`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Runivo Run', text, url: 'https://runivo.app' });
      } else {
        await navigator.clipboard.writeText(`${text} — https://runivo.app`);
      }
    } catch {
      // User cancelled or API unavailable
    }
  };

  const openContactPicker = async () => {
    haptic('medium');
    // Web Contact Picker API (supported on Android Chrome and iOS Safari 15.4+)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contacts = (navigator as any).contacts;
    if (contacts?.select) {
      try {
        const result = await contacts.select(['name', 'tel'], { multiple: true });
        if (result?.length) {
          // Show the sheet — contacts will be resolved server-side in a real impl
          setContactsSynced(true);
        }
      } catch {
        // User dismissed picker — just open the sheet with empty state
        setContactsSynced(true);
      }
    } else {
      // Fallback: no Contact Picker API — still open the sheet
      setContactsSynced(true);
    }
  };

  const toggleReaction = (postId: string, type: ReactionType) => {
    haptic('light');
    setReactions(prev => ({ ...prev, [postId]: prev[postId] === type ? null : type }));
    setShowReactionPicker(null);
  };

  const handleKudosTap = useCallback((postId: string) => {
    if (didLongPressRef.current) { didLongPressRef.current = false; return; }
    haptic('light');
    // Persist to Supabase (fire and forget)
    toggleLike(postId).then(liked => {
      setPosts(prev => prev.map(p => p.id === postId
        ? { ...p, kudos: liked ? p.kudos + 1 : Math.max(0, p.kudos - 1) }
        : p));
    }).catch(() => {/* non-fatal */});
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

  const undismissed = runners.filter(r => !dismissed.has(r.id));
  const filteredSearchResults = searchQuery.trim().length >= 2
    ? undismissed.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const visibleNearby = undismissed.slice(0, 8);
  const visiblePopular = undismissed.slice(0, 6);
  const visibleFromClubs: SuggestedRunner[] = [];
  const contactsOnRunivo: ContactEntry[] = [];
  const contactsNotOnRunivo: ContactEntry[] = [];

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
          feedLoading ? (
            <div className="flex justify-center py-16">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-6 h-6 border-2 border-gray-200 border-t-teal-500 rounded-full" />
            </div>
          ) : posts.length === 0 ? (
            <div className="flex flex-col items-center py-20 px-5 text-center">
              <div className="text-4xl mb-3">🏃</div>
              <p className="text-sm font-semibold text-gray-500">No runs posted yet</p>
              <p className="text-xs text-gray-400 mt-1">Complete a run to see it here</p>
            </div>
          ) : (
          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-3 px-4">
            {posts.map((post) => {
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
                    <button
                      onClick={() => sharePost(post)}
                      className="ml-auto p-2 rounded-full active:bg-gray-50"
                    >
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
          )
        ) : (
          /* ===== FOLLOWING TAB ===== */
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-4">

            {/* Following avatars row — horizontal scroll */}
            {following.size > 0 && (() => {
              const followedRunners = runners.filter(r => following.has(r.id));
              if (followedRunners.length === 0) return null;
              return (
                <div className="mb-4">
                  <div className="flex items-center justify-between px-4 mb-2">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Following</span>
                    <span className="text-[11px] text-teal-500 font-semibold">{following.size} runners</span>
                  </div>
                  <div className="flex gap-3 px-4 overflow-x-auto scrollbar-none pb-1">
                    {followedRunners.map(r => (
                      <button
                        key={r.id}
                        onClick={() => setProfileRunner(r)}
                        className="flex flex-col items-center gap-1.5 flex-shrink-0"
                      >
                        <div className="relative">
                          <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${r.color} flex items-center justify-center text-base font-bold text-white ring-2 ring-teal-400 ring-offset-2`}>
                            {r.initial}
                          </div>
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-teal-400 border-2 border-white" />
                        </div>
                        <span className="text-[10px] text-gray-500 font-medium max-w-[56px] truncate">{r.name}</span>
                      </button>
                    ))}
                    {/* Discover more */}
                    <button
                      onClick={() => { /* scroll to discover */ }}
                      className="flex flex-col items-center gap-1.5 flex-shrink-0"
                    >
                      <div className="w-14 h-14 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
                        <UserPlus className="w-5 h-5 text-gray-400" strokeWidth={1.5} />
                      </div>
                      <span className="text-[10px] text-gray-400 font-medium">Find more</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Personalized feed — posts from followed runners */}
            {(() => {
              const followedPosts = posts.filter(p => following.has(p.userId));
              if (feedLoading) return (
                <div className="flex justify-center py-10">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-5 h-5 border-2 border-gray-200 border-t-teal-500 rounded-full" />
                </div>
              );
              if (following.size === 0) return (
                <div className="mx-4 mb-5 p-6 rounded-2xl bg-white border border-gray-100 shadow-sm text-center">
                  <div className="w-14 h-14 rounded-2xl bg-teal-50 flex items-center justify-center mx-auto mb-3">
                    <UserPlus className="w-6 h-6 text-teal-500" strokeWidth={1.5} />
                  </div>
                  <p className="text-[15px] font-bold text-gray-800 mb-1">Nobody here yet</p>
                  <p className="text-[12px] text-gray-400 mb-4">Follow runners below to see their runs in your feed</p>
                  <button
                    onClick={() => document.getElementById('discover-search')?.focus()}
                    className="px-5 py-2 rounded-xl bg-teal-500 text-white text-[13px] font-semibold"
                  >
                    Find runners
                  </button>
                </div>
              );
              if (followedPosts.length === 0) return (
                <div className="mx-4 mb-5 px-5 py-4 rounded-2xl bg-gray-50 border border-gray-100 text-center">
                  <p className="text-[13px] text-gray-500">
                    No runs yet from the {following.size} runner{following.size !== 1 ? 's' : ''} you follow
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Check back after their next run</p>
                </div>
              );
              return (
                <div className="space-y-3 px-4 mb-6">
                  <p className="text-[11px] uppercase tracking-widest text-gray-400 font-semibold px-1">Recent activity</p>
                  {followedPosts.slice(0, 15).map(post => {
                    const hasReacted = !!reactions[post.id];
                    const currentReaction = reactions[post.id];
                    const reactionData = currentReaction ? REACTIONS.find(r => r.type === currentReaction) : null;
                    const activityIcon = ACTIVITY_ICONS[post.activity.type];
                    return (
                      <div key={post.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                          <div className="relative">
                            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${post.user.color} flex items-center justify-center text-sm font-bold text-white`}>{post.user.initial}</div>
                            <div className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full ${activityIcon.bg} flex items-center justify-center text-[9px] ring-2 ring-white`}>{activityIcon.icon}</div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-[13px] font-bold text-gray-900 truncate block">{post.user.name}</span>
                            <span className="text-[11px] text-gray-400">{post.timestamp}</span>
                          </div>
                          <button className="p-1"><MoreHorizontal className="w-4 h-4 text-gray-300" /></button>
                        </div>

                        {/* Stats row */}
                        <div className="px-4 pb-3 flex items-center gap-5">
                          <div>
                            <span className="text-stat text-[22px] font-bold text-gray-900">{post.activity.distance}</span>
                            <span className="text-[11px] text-gray-400 ml-0.5">km</span>
                          </div>
                          {post.activity.pace !== '–' && (
                            <>
                              <div className="h-5 w-px bg-gray-100" />
                              <div>
                                <span className="text-stat text-[13px] font-semibold text-gray-700">{post.activity.pace}</span>
                                <span className="text-[10px] text-gray-400 block leading-none">pace</span>
                              </div>
                            </>
                          )}
                          {post.activity.territoriesClaimed > 0 && (
                            <>
                              <div className="h-5 w-px bg-gray-100" />
                              <div className="inline-flex items-center gap-1">
                                <Flag className="w-3 h-3 text-teal-500" />
                                <span className="text-[12px] font-semibold text-teal-600">{post.activity.territoriesClaimed} zones</span>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Kudos bar */}
                        <div className="flex items-center px-4 py-2.5 border-t border-gray-50 gap-3">
                          <button
                            onClick={() => handleKudosTap(post.id)}
                            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-full transition-colors ${hasReacted ? 'bg-teal-50' : 'active:bg-gray-50'}`}
                          >
                            {hasReacted
                              ? <span className="text-base">{reactionData?.emoji ?? '🔥'}</span>
                              : <Heart className="w-4 h-4 text-gray-300" />}
                            <span className={`text-[12px] font-semibold ${hasReacted ? 'text-teal-600' : 'text-gray-400'}`}>
                              {post.kudos + (hasReacted ? 1 : 0)}
                            </span>
                          </button>
                          <button className="flex items-center gap-1.5 py-1.5 px-3 rounded-full active:bg-gray-50">
                            <MessageCircle className="w-4 h-4 text-gray-300" />
                            <span className="text-[12px] text-gray-400">{post.comments}</span>
                          </button>
                          <button
                            onClick={() => sharePost(post)}
                            className="ml-auto p-1.5 rounded-full active:bg-gray-50"
                          >
                            <Share2 className="w-4 h-4 text-gray-300" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Divider before discover */}
            <div className="flex items-center gap-3 mx-4 mb-4">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-[11px] text-gray-400 font-medium uppercase tracking-widest">Discover</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            {/* Search */}
            <div className="px-4 mb-4">
              <div className={`flex items-center gap-2.5 bg-white rounded-xl border transition-all px-3.5 ${
                isSearchFocused ? 'border-teal-300 shadow-sm shadow-teal-50' : 'border-gray-200'
              }`}>
                <Search className="w-4 h-4 text-gray-400 flex-shrink-0" strokeWidth={2} />
                <input id="discover-search" ref={searchInputRef} type="text" value={searchQuery}
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
                              <div key={runner.id} onClick={() => { setProfileRunner(runner); haptic('light'); }}
                                className="w-[156px] flex-shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col items-center relative active:scale-[0.98] transition text-center cursor-pointer">
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
                              </div>
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
                  <button
                    onClick={inviteFriends}
                    className="w-full bg-gradient-to-r from-teal-500 to-teal-600 rounded-2xl shadow-[0_4px_16px_rgba(0,180,198,0.25)] p-4 flex items-center gap-3.5 active:opacity-90 transition"
                  >
                    <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
                      <UserPlus className="w-5 h-5 text-white" strokeWidth={1.8} />
                    </div>
                    <div className="flex-1 text-left">
                      <span className="text-[14px] font-semibold text-white block">Invite Friends to Runivo</span>
                      <span className="text-[12px] text-teal-100">Share your link &amp; run together</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/60 flex-shrink-0" strokeWidth={2} />
                  </button>
                </motion.div>

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
                    onClick={openContactPicker}
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
                            <button onClick={() => sendInvite(contact.id, contact.name, contact.phone)}
                              className={`px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all flex-shrink-0 ${
                                invited.has(contact.id)
                                  ? 'bg-gray-100 text-gray-400'
                                  : 'bg-gray-900 text-white active:bg-gray-800'
                              }`}>
                              {invited.has(contact.id) ? '✓ Sent' : 'Invite'}
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
