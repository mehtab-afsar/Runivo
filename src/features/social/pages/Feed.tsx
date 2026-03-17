import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { haptic } from '@shared/lib/haptics';
import {
  Bell,
  MessageSquare,
  MapPin,
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
  Star,
  ThumbsUp,
  Navigation,
  Plus,
} from 'lucide-react';
import { supabase } from '@shared/services/supabase';
import { toggleLike } from '@shared/services/sync';

// Module-level flag: once we confirm the followers table is missing (local dev
// with unmigrated DB), stop retrying on every Feed mount to avoid console spam.
let followersTableAvailable = true;

type FeedTab = 'explore' | 'following';
type ReactionType = 'kudos' | 'fire' | 'crown' | 'muscle';
type ActivityType = 'run' | 'trail' | 'interval' | 'long_run';

// ── Design tokens ──────────────────────────────────────────────────────────────
const T = {
  pageBg:  '#F7F6F4',
  cardBg:  '#FFFFFF',
  surface: '#F0EDE8',
  stone:   '#EEEBE6',
  mid:     '#E8E4DF',
  border:  '#DDD9D4',
  black:   '#0A0A0A',
  t2:      '#6B6B6B',
  t3:      '#ADADAD',
  red:     '#D93518',
  redLo:   '#FEF0EE',
  green:   '#1A6B40',
  greenLo: '#EDF7F2',
  amber:   '#9E6800',
  amberLo: '#FDF6E8',
} as const;

// Solid avatar color palette (deterministic by name)
const SOLID_COLORS = [
  '#2C3E7A', '#7A2C4E', '#2C7A4E', '#7A5C2C',
  '#4E2C7A', '#2C6B7A', '#7A2C2C', '#2C7A6B',
  '#6B2C7A', '#2C4E7A',
];
function solidColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return SOLID_COLORS[Math.abs(h) % SOLID_COLORS.length];
}

// Badge config for post cards
const BADGE_CFG = {
  pr:     { bg: '#FDF6E8', fg: '#9E6800', Icon: Star,       text: (v: string)  => `PR · ${v}` },
  zone:   { bg: '#FEF0EE', fg: '#D93518', Icon: Navigation, text: (n: number)  => `${n} Zone${n !== 1 ? 's' : ''}` },
  xp:     { bg: '#EDF7F2', fg: '#1A6B40', Icon: Zap,        text: (n: number)  => `${n} XP` },
  streak: { bg: '#FDF6E8', fg: '#9E6800', Icon: Flame,      text: ()           => 'Streak' },
  level:  { bg: '#EEF1FB', fg: '#1445AA', Icon: TrendingUp, text: (n: number)  => `Lv.${n}` },
} as const;

// Activity chip config
const ACT_CHIP: Record<ActivityType, { label: string; Icon: typeof TrendingUp }> = {
  run:      { label: 'Run',      Icon: TrendingUp },
  trail:    { label: 'Trail',    Icon: MapPin },
  interval: { label: 'Interval', Icon: Zap },
  long_run: { label: 'Long Run', Icon: Navigation },
};

// Legacy badge config (runner profile sheet)
const badgeConfig: Record<string, { icon: typeof Flame; color: string; bg: string; label: string }> = {
  top10:     { icon: Crown,  color: 'text-amber-600',  bg: 'bg-amber-50',   label: 'Top 10'    },
  streak:    { icon: Flame,  color: 'text-orange-600', bg: 'bg-orange-50',  label: 'On Fire'   },
  conqueror: { icon: Shield, color: 'text-[#E8435A]',  bg: 'bg-[#F9E4E7]', label: 'Conqueror' },
};

// ── Interfaces ─────────────────────────────────────────────────────────────────
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

// ── Helpers ────────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  'from-rose-400 to-pink-500', 'from-blue-400 to-indigo-500',
  'from-orange-400 to-red-500', 'from-[#E8435A] to-[#D03A4F]',
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
  if (hrs < 24) return `${hrs} hr ago`;
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

// ── RouteMapHero ───────────────────────────────────────────────────────────────
function RouteMapHero({
  route, postId, distance, location,
}: {
  route: [number, number][];
  postId: string;
  distance: number;
  location?: string;
}) {
  // Scale route from 0-100 space into 310×110 viewBox
  const scaled = route.map(([x, y]) => [x * 3.1, y * 1.1] as [number, number]);
  const trailPts = scaled.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const start = scaled[0] ?? [10, 10];
  const end = scaled[scaled.length - 1] ?? [280, 90];

  // Deterministic buildings from postId hash
  let s = 0;
  for (let i = 0; i < postId.length; i++) s = (s * 31 + postId.charCodeAt(i)) | 0;
  const rng = (max: number) => { s = (s * 1664525 + 1013904223) | 0; return Math.abs(s) % max; };
  const blds = Array.from({ length: 12 }, () => ({
    x: 8 + rng(280), y: 4 + rng(85), w: 12 + rng(26), h: 8 + rng(23),
  }));

  return (
    <div style={{ position: 'relative', width: '100%', height: 110, borderTop: `0.5px solid ${T.mid}`, borderBottom: `0.5px solid ${T.mid}` }}>
      <svg
        viewBox="0 0 310 110"
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
      >
        <rect width="310" height="110" fill="#EDE9E4" />
        {blds.map((b, i) => (
          <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} fill="#D8D4CE" opacity="0.5" rx="3" />
        ))}
        <path d="M 0 55 Q 78 32 155 55 Q 232 78 310 55" stroke="#D0CCC5" strokeWidth="4" fill="none" opacity="0.38" />
        <path d="M 155 0 Q 148 55 155 110" stroke="#D0CCC5" strokeWidth="3" fill="none" opacity="0.35" />
        <polyline
          points={trailPts}
          fill="none"
          stroke="#D93518"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.75"
        />
        <circle cx={start[0]} cy={start[1]} r="4" fill="white" stroke="#D93518" strokeWidth="1.5" />
        <circle cx={end[0]} cy={end[1]} r="5" fill="#D93518" />
      </svg>
      {/* Distance overlay */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '8px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span style={{
            fontSize: 28,
            fontFamily: "'Barlow', sans-serif",
            fontWeight: 300,
            letterSpacing: '-0.03em',
            color: T.black,
            lineHeight: 1,
          }}>
            {distance > 0 ? distance.toFixed(2) : '0.00'}
          </span>
          <span style={{ fontSize: 11, fontWeight: 400, color: T.t3, marginLeft: 3 }}>km</span>
        </div>
        {location && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 1 }}>
            <MapPin size={9} color={T.t3} strokeWidth={2} />
            <span style={{ fontSize: 10, fontWeight: 300, color: T.t3 }}>{location}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Feed() {
  const [activeTab, setActiveTab] = useState<FeedTab>('explore');
  const [reactions, setReactions] = useState<Record<string, ReactionType | null>>({});
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPressRef = useRef(false);

  // Live feed from Supabase
  const [posts, setPosts] = useState<Post[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);

  useEffect(() => {
    loadFeed(activeTab);
  }, [activeTab]);

  const loadFeed = async (tab: FeedTab) => {
    setFeedLoading(true);
    setPosts([]);

    if (tab === 'following') {
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

  const [myUsername, setMyUsername] = useState('');
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      supabase.from('profiles').select('username').eq('id', session.user.id).single()
        .then(({ data }) => { if (data?.username) setMyUsername(data.username); });
    });
  }, []);

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
        id: row.id, name,
        initial: name.charAt(0).toUpperCase(),
        color: getColor(name),
        level: row.level ?? 1,
        totalDistance: Math.round(row.total_distance_km ?? 0),
        territories: row.total_territories_claimed ?? 0,
        mutualCount: 0, mutualNames: [], badge,
        joinedDate: new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        recentActivities: [],
      } satisfies SuggestedRunner;
    }));
  };

  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [dismissed] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showContactsSheet, setShowContactsSheet] = useState(false);
  const [contactsSynced, setContactsSynced] = useState(false);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [showAllNearby, setShowAllNearby] = useState(false);
  const [showAllPopular, setShowAllPopular] = useState(false);
  const [profileRunner, setProfileRunner] = useState<SuggestedRunner | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!followersTableAvailable) return;
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data, error } = await supabase
        .from('followers')
        .select('following_id')
        .eq('follower_id', session.user.id);
      if (error) { followersTableAvailable = false; return; }
      if (data) setFollowing(new Set(data.map((r: { following_id: string }) => r.following_id)));
    };
    load();
  }, []);

  const toggleFollow = async (id: string) => {
    setFollowing(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    if (!followersTableAvailable) return;
    const { error } = await supabase.rpc('toggle_follow', { target_id: id });
    if (error) {
      followersTableAvailable = false;
      setFollowing(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    }
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


  const openContactPicker = async () => {
    haptic('medium');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contacts = (navigator as any).contacts;
    if (contacts?.select) {
      try {
        const result = await contacts.select(['name', 'tel'], { multiple: true });
        if (result?.length) setContactsSynced(true);
      } catch { setContactsSynced(true); }
    } else {
      setContactsSynced(true);
    }
  };

  const toggleReaction = (postId: string, type: ReactionType) => {
    haptic('light');
    setReactions(prev => ({ ...prev, [postId]: prev[postId] === type ? null : type }));
  };

  const handleKudosTap = useCallback((postId: string) => {
    if (didLongPressRef.current) { didLongPressRef.current = false; return; }
    haptic('light');
    toggleLike(postId).then(liked => {
      setPosts(prev => prev.map(p => p.id === postId
        ? { ...p, kudos: liked ? p.kudos + 1 : Math.max(0, p.kudos - 1) }
        : p));
    }).catch(() => {});
    if (reactions[postId]) setReactions(prev => ({ ...prev, [postId]: null }));
    else setReactions(prev => ({ ...prev, [postId]: 'kudos' }));
  }, [reactions]);

  const handleTouchStart = useCallback((_postId: string) => {
    didLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      didLongPressRef.current = true;
      haptic('medium');
    }, 500);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
  }, []);

  const formatDuration = (mins: number) => {
    if (!mins) return '–';
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

  // ── Runner profile sheet ───────────────────────────────────────────────────
  if (profileRunner) {
    const badge = profileRunner.badge ? badgeConfig[profileRunner.badge] : null;
    const BadgeIcon = badge?.icon;
    const isFollowingProfile = following.has(profileRunner.id);

    return (
      <div className="h-full bg-white overflow-y-auto">
        <div className="bg-white border-b border-gray-100 z-10"
             style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}>
          <div className="flex items-center gap-3 px-4 py-2.5">
            <button onClick={() => { setProfileRunner(null); haptic('light'); }} className="p-1.5 -ml-1 rounded-full active:bg-gray-100 transition">
              <ArrowLeft className="w-5 h-5 text-gray-700" strokeWidth={2} />
            </button>
            <span className="text-[15px] font-bold text-gray-900">{profileRunner.name}</span>
          </div>
        </div>

        <div className="px-5 pt-6 pb-5">
          <div className="flex items-start gap-4">
            <div className="relative">
              <div
                style={{ background: solidColor(profileRunner.name) }}
                className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-lg"
              >
                {profileRunner.initial}
              </div>
              {badge && BadgeIcon && (
                <div className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-full ${badge.bg} flex items-center justify-center ring-2 ring-white`}>
                  <BadgeIcon className={`w-3.5 h-3.5 ${badge.color}`} strokeWidth={2.5} />
                </div>
              )}
            </div>

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

          <div className="mt-3.5">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[16px] font-bold text-gray-900">{profileRunner.name}</span>
              {profileRunner.isVerified && (
                <div className="w-4.5 h-4.5 rounded-full bg-[#E8435A] flex items-center justify-center">
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

          {profileRunner.mutualCount > 0 && (
            <p className="text-[12px] text-gray-400 mt-2">
              Followed by <span className="font-medium text-gray-600">{profileRunner.mutualNames.slice(0, 3).join(', ')}</span>
              {profileRunner.mutualCount > 3 && <span> and {profileRunner.mutualCount - 3} others</span>}
            </p>
          )}

          <div className="flex gap-2 mt-4">
            <button
              onClick={() => { toggleFollow(profileRunner.id); haptic('light'); }}
              className={`flex-1 py-2.5 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-all ${
                isFollowingProfile
                  ? 'bg-gray-100 text-gray-600'
                  : 'bg-[#E8435A] text-white active:bg-[#D03A4F] shadow-sm shadow-[rgba(232,67,90,0.15)]'
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
                        <Flag className="w-3 h-3 text-[#E8435A]" strokeWidth={2} />
                        <span className="text-[12px] font-semibold text-[#E8435A]">{act.zones}</span>
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

  // ── MAIN FEED ──────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto pb-24" style={{ background: T.pageBg }}>

      {/* ── Sticky header ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: T.pageBg,
        borderBottom: `0.5px solid ${T.border}`,
        paddingTop: 'max(16px, env(safe-area-inset-top))',
      }}>
        {/* Top row */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
          padding: '0 20px', marginBottom: 14,
        }}>
          <span style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontStyle: 'italic',
            fontSize: 26,
            fontWeight: 400,
            color: T.black,
            letterSpacing: '-0.01em',
            lineHeight: 1,
          }}>
            Feed
          </span>
          <button style={{
            width: 34, height: 34, borderRadius: '50%',
            background: T.surface, border: `0.5px solid ${T.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', flexShrink: 0, cursor: 'pointer',
            outline: 'none',
          }}>
            <Bell size={15} color={T.black} strokeWidth={1.8} />
            <span style={{
              position: 'absolute', top: 6, right: 6,
              width: 6, height: 6, borderRadius: '50%',
              background: T.red, border: '1.5px solid white',
            }} />
          </button>
        </div>

        {/* Tab row */}
        <div style={{ display: 'flex', borderTop: `0.5px solid ${T.border}`, padding: '0 20px' }}>
          {(['explore', 'following'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); haptic('light'); }}
              style={{
                flex: 1,
                padding: '11px 0 15px',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontWeight: activeTab === tab ? 500 : 400,
                color: activeTab === tab ? T.black : T.t3,
                background: 'none',
                outline: 'none',
                cursor: 'pointer',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                borderBottom: `1.5px solid ${activeTab === tab ? T.black : 'transparent'}`,
              }}
            >
              {tab === 'explore' ? 'Discover' : 'Following'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Explore tab ── */}
      {activeTab === 'explore' ? (
        <>
          {/* Suggested Runners strip */}
          {undismissed.length > 0 && (
            <div style={{
              padding: '16px 0 14px',
              background: T.pageBg,
              borderBottom: `0.5px solid ${T.border}`,
            }}>
              <div style={{
                fontSize: 9, fontWeight: 400,
                textTransform: 'uppercase', letterSpacing: '0.12em',
                color: T.t3, padding: '0 20px', marginBottom: 12,
              }}>
                Suggested Runners
              </div>
              <div style={{ paddingTop: 14 }}>
              <div
                style={{ display: 'flex', gap: 10, padding: '6px 20px 4px', overflowX: 'auto' }}
                className="scrollbar-none"
              >
                {undismissed.slice(0, 8).map(runner => {
                  const isF = following.has(runner.id);
                  const sc = solidColor(runner.name);
                  return (
                    <div
                      key={runner.id}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, minWidth: 76, flexShrink: 0 }}
                    >
                      <div style={{ position: 'relative' }}>
                        {/* Avatar */}
                        <div style={{
                          width: 48, height: 48, borderRadius: '50%',
                          background: sc,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'white', fontSize: 15, fontWeight: 700,
                          boxShadow: isF ? `0 0 0 2px ${T.black}` : `0 0 0 1.5px ${T.border}`,
                        }}>
                          {runner.initial}
                        </div>
                        {/* Plus / Check dot */}
                        <button
                          onClick={() => { toggleFollow(runner.id); haptic('light'); }}
                          className="active:scale-90 transition-transform"
                          style={{
                            position: 'absolute', bottom: -1, right: -1,
                            width: 18, height: 18, borderRadius: '50%',
                            background: T.black, border: '1.5px solid white',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', outline: 'none',
                          }}
                        >
                          {isF
                            ? <Check size={9} color="white" strokeWidth={2.5} />
                            : <Plus size={9} color="white" strokeWidth={2.5} />
                          }
                        </button>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 400, color: T.black, textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {runner.name.split(' ')[0]}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 300, color: T.t3, textAlign: 'center', marginTop: -4 }}>
                        {runner.totalDistance} km
                      </span>
                    </div>
                  );
                })}
              </div>
              </div>
            </div>
          )}

          {/* Feed body */}
          {feedLoading ? (
            <div className="flex justify-center py-16">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                style={{ width: 20, height: 20, border: `2px solid ${T.mid}`, borderTopColor: T.red, borderRadius: '50%' }}
              />
            </div>
          ) : posts.length === 0 ? (
            <div className="flex flex-col items-center py-20 px-5 text-center">
              <p style={{ fontSize: 13, fontWeight: 500, color: T.t2 }}>No runs posted yet</p>
              <p style={{ fontSize: 11, color: T.t3, marginTop: 4 }}>Complete a run to see it here</p>
            </div>
          ) : (
            <>
              {/* Time divider */}
              <div style={{ padding: '10px 20px 8px', background: T.stone }}>
                <span style={{ fontSize: 9, fontWeight: 400, textTransform: 'uppercase', letterSpacing: '0.12em', color: T.t3 }}>
                  Recent
                </span>
              </div>

              {/* Post cards */}
              <motion.div
                variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } }}
                initial="hidden"
                animate="show"
              >
                {posts.map(post => {
                  const act = post.activity;
                  const reaction = reactions[post.id];
                  const ChipIcon = ACT_CHIP[act.type].Icon;
                  const chipLabel = ACT_CHIP[act.type].label;
                  const sc = solidColor(post.user.name);
                  const isKudos = reaction === 'kudos';
                  const isFire = reaction === 'fire';
                  const isCrown = reaction === 'crown';

                  // Collect badges
                  const badges: Array<{ bg: string; fg: string; Icon: typeof TrendingUp; text: string }> = [];
                  if (act.pr) badges.push({ bg: BADGE_CFG.pr.bg, fg: BADGE_CFG.pr.fg, Icon: BADGE_CFG.pr.Icon, text: BADGE_CFG.pr.text(act.pr.value) });
                  if (act.territoriesClaimed > 0) badges.push({ bg: BADGE_CFG.zone.bg, fg: BADGE_CFG.zone.fg, Icon: BADGE_CFG.zone.Icon, text: BADGE_CFG.zone.text(act.territoriesClaimed) });
                  if (act.enemyZonesCaptured && act.enemyZonesCaptured > 0) badges.push({ bg: BADGE_CFG.xp.bg, fg: BADGE_CFG.xp.fg, Icon: BADGE_CFG.xp.Icon, text: BADGE_CFG.xp.text(act.enemyZonesCaptured * 10) });

                  return (
                    <motion.div
                      key={post.id}
                      variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { type: 'spring', damping: 22, stiffness: 180 } } }}
                    >
                      <div
                        style={{ background: T.cardBg, borderBottom: `0.5px solid ${T.border}` }}
                        className="active:bg-[#FAFAF8] transition-colors duration-100"
                      >
                        {/* A — Post Header */}
                        <div style={{ padding: '16px 20px 14px', display: 'flex', alignItems: 'center', gap: 11 }}>
                          <div style={{
                            width: 40, height: 40, borderRadius: '50%',
                            background: sc, flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'white', fontSize: 13, fontWeight: 400,
                          }}>
                            {post.user.initial}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: T.black, letterSpacing: '0.01em' }}>
                              {post.user.name}
                            </div>
                            <div style={{ fontSize: 11, fontWeight: 300, color: T.t3, marginTop: 2 }}>
                              {post.timestamp}{post.location ? ` · ${post.location}` : ''}
                            </div>
                          </div>
                          {/* Activity chip */}
                          <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '4px 9px', borderRadius: 3,
                            background: T.stone,
                            fontSize: 10, fontWeight: 500, color: T.t2,
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                            flexShrink: 0,
                          }}>
                            <ChipIcon size={10} color={T.t2} strokeWidth={2} />
                            {chipLabel}
                          </div>
                        </div>

                        {/* B — Route Map (full-bleed hero) */}
                        <RouteMapHero
                          route={act.route}
                          postId={post.id}
                          distance={act.distance}
                          location={post.location}
                        />

                        {/* C — Stats Row: Time · Pace · Kcal */}
                        <div style={{ display: 'flex', padding: '12px 20px', borderBottom: `0.5px solid ${T.mid}` }}>
                          {[
                            { value: formatDuration(act.duration), label: 'Time' },
                            { value: act.pace, label: 'Pace' },
                            { value: act.calories ? `${act.calories}` : '–', label: 'Kcal' },
                          ].map((stat, i) => (
                            <div
                              key={i}
                              style={{
                                flex: 1,
                                ...(i > 0 ? { borderLeft: `0.5px solid ${T.mid}`, paddingLeft: 16 } : {}),
                              }}
                            >
                              <div style={{
                                fontSize: 15,
                                fontFamily: "'Barlow', sans-serif",
                                fontWeight: 300,
                                letterSpacing: '-0.02em',
                                color: T.black,
                              }}>
                                {stat.value}
                              </div>
                              <div style={{
                                fontSize: 9, fontWeight: 400,
                                textTransform: 'uppercase', letterSpacing: '0.08em',
                                color: T.t3,
                              }}>
                                {stat.label}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* D — Badges Strip */}
                        {badges.length > 0 && (
                          <div style={{
                            display: 'flex', gap: 5,
                            padding: '10px 20px',
                            borderBottom: `0.5px solid ${T.mid}`,
                            flexWrap: 'wrap',
                          }}>
                            {badges.map((b, i) => {
                              const BIcon = b.Icon;
                              return (
                                <div key={i} style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  padding: '3px 8px', borderRadius: 2,
                                  background: b.bg,
                                  fontSize: 10, fontWeight: 500, color: b.fg,
                                  textTransform: 'uppercase', letterSpacing: '0.04em',
                                }}>
                                  <BIcon size={10} color={b.fg} strokeWidth={2} />
                                  {b.text}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* E — Reactions Bar */}
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '11px 20px 14px',
                        }}>
                          {/* Left: stacked avatars + comment count */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              {post.kudosUsers.slice(0, 3).map((u, i) => (
                                <div key={i} style={{
                                  width: 18, height: 18, borderRadius: '50%',
                                  background: solidColor(u.name),
                                  border: '1.5px solid white',
                                  marginLeft: i === 0 ? 0 : -5,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 7, color: 'white', fontWeight: 500,
                                }}>
                                  {u.initial}
                                </div>
                              ))}
                              {(post.kudos > 0 || isKudos) && (
                                <span style={{
                                  fontSize: 12, fontWeight: 400, color: T.t2,
                                  marginLeft: post.kudosUsers.length > 0 ? 7 : 0,
                                }}>
                                  {post.kudos + (isKudos ? 1 : 0)}
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <MessageSquare size={13} color={T.t3} strokeWidth={1.5} />
                              <span style={{ fontSize: 12, fontWeight: 400, color: T.t3 }}>{post.comments}</span>
                            </div>
                          </div>

                          {/* Right: 3 reaction chips */}
                          <div style={{ display: 'flex', gap: 6 }}>
                            {([
                              { type: 'kudos' as const,  Icon: ThumbsUp, active: isKudos,  onTap: () => handleKudosTap(post.id) },
                              { type: 'fire' as const,   Icon: Star,     active: isFire,   onTap: () => toggleReaction(post.id, 'fire') },
                              { type: 'crown' as const,  Icon: Zap,      active: isCrown,  onTap: () => toggleReaction(post.id, 'crown') },
                            ] as const).map(chip => {
                              const CIcon = chip.Icon;
                              return (
                                <button
                                  key={chip.type}
                                  onClick={chip.onTap}
                                  onTouchStart={() => handleTouchStart(post.id)}
                                  onTouchEnd={handleTouchEnd}
                                  className="active:scale-[0.95] transition-transform"
                                  style={{
                                    padding: '5px 11px', borderRadius: 2,
                                    borderTop: `0.5px solid ${chip.active ? T.black : T.border}`,
                                    borderLeft: `0.5px solid ${chip.active ? T.black : T.border}`,
                                    borderRight: `0.5px solid ${chip.active ? T.black : T.border}`,
                                    borderBottom: `0.5px solid ${chip.active ? T.black : T.border}`,
                                    background: chip.active ? T.black : T.surface,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', outline: 'none',
                                  }}
                                >
                                  <CIcon size={12} color={chip.active ? 'white' : T.t2} strokeWidth={2} />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>

              <div style={{ padding: '24px 0', display: 'flex', justifyContent: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 400, color: T.t3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  All caught up
                </span>
              </div>
            </>
          )}
        </>
      ) : (
        /* ── Following tab ── */
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-4">

          {/* Following avatars row */}
          {(() => {
            const followedRunners = runners.filter(r => following.has(r.id));
            const hasNewRun = (r: SuggestedRunner) => posts.some(p => p.userId === r.id);
            return (
              <div className="mb-4">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: T.black }}>Your Crew</span>
                    {following.size > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 400, color: T.t3 }}>{following.size} following</span>
                    )}
                  </div>
                  <button
                    onClick={() => document.getElementById('discover-search')?.focus()}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: T.t2, background: 'none', outline: 'none', cursor: 'pointer' }}
                    className="active:opacity-70"
                  >
                    <UserPlus size={12} color={T.t2} strokeWidth={2} />
                    Find runners
                  </button>
                </div>

                {followedRunners.length > 0 ? (
                  <div className="flex gap-4 px-4 overflow-x-auto scrollbar-none pt-3 pb-2">
                    {followedRunners.map(r => {
                      const BadgeIcon = r.badge ? badgeConfig[r.badge]?.icon : null;
                      const badgeColor = r.badge ? badgeConfig[r.badge]?.color : '';
                      const hasNew = hasNewRun(r);
                      return (
                        <button
                          key={r.id}
                          onClick={() => { setProfileRunner(r); haptic('light'); }}
                          className="flex flex-col items-center gap-1.5 flex-shrink-0"
                        >
                          <div className="relative">
                            <div
                              style={{ background: solidColor(r.name), boxShadow: hasNew ? `0 0 0 2px ${T.red}` : `0 0 0 1.5px ${T.border}` }}
                              className="w-[54px] h-[54px] rounded-full flex items-center justify-center text-[17px] font-bold text-white"
                            >
                              {r.initial}
                            </div>
                            {BadgeIcon && (
                              <div style={{ position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                                <BadgeIcon className={`w-3 h-3 ${badgeColor}`} strokeWidth={2.5} />
                              </div>
                            )}
                            {hasNew && !BadgeIcon && (
                              <div style={{ position: 'absolute', top: -2, right: -2, width: 12, height: 12, borderRadius: '50%', background: T.red, border: '2px solid white' }} />
                            )}
                          </div>
                          <div className="flex flex-col items-center gap-0.5">
                            <span style={{ fontSize: 11, fontWeight: 400, color: T.black, maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                            {r.weeklyKm && r.weeklyKm > 0 ? (
                              <span style={{ fontSize: 10, fontWeight: 300, color: T.t3 }}>{r.weeklyKm} km/wk</span>
                            ) : (
                              <span style={{ fontSize: 10, fontWeight: 300, color: T.t3 }}>Lv.{r.level}</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                    <button
                      onClick={() => { document.getElementById('discover-search')?.focus(); haptic('light'); }}
                      className="flex flex-col items-center gap-1.5 flex-shrink-0"
                    >
                      <div className="w-[54px] h-[54px] rounded-full bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center">
                        <UserPlus className="w-5 h-5 text-gray-300" strokeWidth={1.5} />
                      </div>
                      <span className="text-[11px] text-gray-400 font-medium">Add more</span>
                    </button>
                  </div>
                ) : (
                  <div style={{ margin: '0 20px', padding: 16, borderRadius: 4, background: T.redLo, border: `0.5px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 4, background: T.surface, border: `0.5px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <UserPlus size={18} color={T.red} strokeWidth={1.5} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: T.black, margin: 0 }}>Find your running crew</p>
                      <p style={{ fontSize: 11, fontWeight: 300, color: T.t2, marginTop: 2 }}>Follow runners to see their routes and progress</p>
                    </div>
                  </div>
                )}
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
            if (following.size === 0) return null;
            if (followedPosts.length === 0) return (
              <div className="mx-4 mb-5 px-5 py-5 rounded-2xl bg-gray-50 border border-gray-100 text-center">
                <div className="text-2xl mb-2">🏃</div>
                <p className="text-[13px] font-semibold text-gray-600">No runs yet from your crew</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Check back after their next run</p>
              </div>
            );

            const totalCrewKm = followedPosts.reduce((sum, p) => sum + parseFloat(String(p.activity.distance)), 0);
            const totalCrewZones = followedPosts.reduce((sum, p) => sum + (p.activity.territoriesClaimed ?? 0), 0);

            return (
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: T.stone, borderBottom: `0.5px solid ${T.border}` }}>
                  <span style={{ fontSize: 9, fontWeight: 400, textTransform: 'uppercase', letterSpacing: '0.12em', color: T.t3 }}>Crew Activity</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 9, fontWeight: 400, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: T.t3 }}>
                    <span>{totalCrewKm.toFixed(1)} km</span>
                    {totalCrewZones > 0 && <span>{totalCrewZones} zones</span>}
                  </div>
                </div>

                {followedPosts.slice(0, 15).map(post => {
                  const act = post.activity;
                  const reaction = reactions[post.id];
                  const ChipIcon = ACT_CHIP[act.type].Icon;
                  const chipLabel = ACT_CHIP[act.type].label;
                  const sc = solidColor(post.user.name);
                  const isKudos = reaction === 'kudos';
                  const isFire = reaction === 'fire';
                  const isCrown = reaction === 'crown';
                  const badges: Array<{ bg: string; fg: string; Icon: typeof TrendingUp; text: string }> = [];
                  if (act.pr) badges.push({ bg: BADGE_CFG.pr.bg, fg: BADGE_CFG.pr.fg, Icon: BADGE_CFG.pr.Icon, text: BADGE_CFG.pr.text(act.pr.value) });
                  if (act.territoriesClaimed > 0) badges.push({ bg: BADGE_CFG.zone.bg, fg: BADGE_CFG.zone.fg, Icon: BADGE_CFG.zone.Icon, text: BADGE_CFG.zone.text(act.territoriesClaimed) });
                  if (act.enemyZonesCaptured && act.enemyZonesCaptured > 0) badges.push({ bg: BADGE_CFG.xp.bg, fg: BADGE_CFG.xp.fg, Icon: BADGE_CFG.xp.Icon, text: BADGE_CFG.xp.text(act.enemyZonesCaptured * 10) });
                  return (
                    <div key={post.id} style={{ background: T.cardBg, borderBottom: `0.5px solid ${T.border}` }} className="active:bg-[#FAFAF8] transition-colors duration-100">
                      {/* Header */}
                      <div style={{ padding: '16px 20px 14px', display: 'flex', alignItems: 'center', gap: 11 }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: sc, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 13, fontWeight: 400 }}>
                          {post.user.initial}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: T.black, letterSpacing: '0.01em' }}>{post.user.name}</div>
                          <div style={{ fontSize: 11, fontWeight: 300, color: T.t3, marginTop: 2 }}>{post.timestamp}{post.location ? ` · ${post.location}` : ''}</div>
                        </div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 3, background: T.stone, fontSize: 10, fontWeight: 500, color: T.t2, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>
                          <ChipIcon size={10} color={T.t2} strokeWidth={2} />
                          {chipLabel}
                        </div>
                      </div>
                      {/* Route Map */}
                      <RouteMapHero route={act.route} postId={post.id} distance={act.distance} location={post.location} />
                      {/* Stats Row */}
                      <div style={{ display: 'flex', padding: '12px 20px', borderBottom: `0.5px solid ${T.mid}` }}>
                        {[
                          { value: formatDuration(act.duration), label: 'Time' },
                          { value: act.pace, label: 'Pace' },
                          { value: act.calories ? `${act.calories}` : '–', label: 'Kcal' },
                        ].map((stat, i) => (
                          <div key={i} style={{ flex: 1, ...(i > 0 ? { borderLeft: `0.5px solid ${T.mid}`, paddingLeft: 16 } : {}) }}>
                            <div style={{ fontSize: 15, fontFamily: "'Barlow', sans-serif", fontWeight: 300, letterSpacing: '-0.02em', color: T.black }}>{stat.value}</div>
                            <div style={{ fontSize: 9, fontWeight: 400, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.t3 }}>{stat.label}</div>
                          </div>
                        ))}
                      </div>
                      {/* Badges */}
                      {badges.length > 0 && (
                        <div style={{ display: 'flex', gap: 5, padding: '10px 20px', borderBottom: `0.5px solid ${T.mid}`, flexWrap: 'wrap' }}>
                          {badges.map((b, i) => {
                            const BIcon = b.Icon;
                            return (
                              <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 2, background: b.bg, fontSize: 10, fontWeight: 500, color: b.fg, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                <BIcon size={10} color={b.fg} strokeWidth={2} />
                                {b.text}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {/* Reactions Bar */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 20px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            {post.kudosUsers.slice(0, 3).map((u, i) => (
                              <div key={i} style={{ width: 18, height: 18, borderRadius: '50%', background: solidColor(u.name), border: '1.5px solid white', marginLeft: i === 0 ? 0 : -5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, color: 'white', fontWeight: 500 }}>
                                {u.initial}
                              </div>
                            ))}
                            {(post.kudos > 0 || isKudos) && (
                              <span style={{ fontSize: 12, fontWeight: 400, color: T.t2, marginLeft: post.kudosUsers.length > 0 ? 7 : 0 }}>
                                {post.kudos + (isKudos ? 1 : 0)}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <MessageSquare size={13} color={T.t3} strokeWidth={1.5} />
                            <span style={{ fontSize: 12, fontWeight: 400, color: T.t3 }}>{post.comments}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {([
                            { type: 'kudos' as const, Icon: ThumbsUp, active: isKudos, onTap: () => handleKudosTap(post.id) },
                            { type: 'fire' as const, Icon: Star, active: isFire, onTap: () => toggleReaction(post.id, 'fire') },
                            { type: 'crown' as const, Icon: Zap, active: isCrown, onTap: () => toggleReaction(post.id, 'crown') },
                          ] as const).map(chip => {
                            const CIcon = chip.Icon;
                            return (
                              <button key={chip.type} onClick={chip.onTap} onTouchStart={() => handleTouchStart(post.id)} onTouchEnd={handleTouchEnd}
                                className="active:scale-[0.95] transition-transform"
                                style={{ padding: '5px 11px', borderRadius: 2, border: `0.5px solid ${chip.active ? T.black : T.border}`, background: chip.active ? T.black : T.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', outline: 'none' }}>
                                <CIcon size={12} color={chip.active ? 'white' : T.t2} strokeWidth={2} />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Divider before discover */}
          <div style={{ padding: '10px 20px', background: T.stone, borderTop: `0.5px solid ${T.border}`, borderBottom: `0.5px solid ${T.border}`, marginBottom: 16 }}>
            <span style={{ fontSize: 9, fontWeight: 400, textTransform: 'uppercase', letterSpacing: '0.12em', color: T.t3 }}>Discover Runners</span>
          </div>

          {/* Search */}
          <div style={{ padding: '0 20px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: T.cardBg, border: `0.5px solid ${isSearchFocused ? T.black : T.border}`, borderRadius: 4, padding: '0 14px', transition: 'border-color 0.15s' }}>
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" strokeWidth={2} />
              <input
                id="discover-search"
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => { if (!searchQuery) setIsSearchFocused(false); }}
                placeholder="Search runners..."
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: T.black, padding: '12px 0' }}
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); searchInputRef.current?.blur(); setIsSearchFocused(false); }}
                  className="p-1 rounded-full active:bg-gray-100">
                  <X className="w-4 h-4 text-gray-400" strokeWidth={2} />
                </button>
              )}
            </div>
          </div>

          <AnimatePresence>
            {isSearchFocused && searchQuery.trim().length >= 2 && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} style={{ padding: '0 20px', marginBottom: 16 }}>
                <div style={{ background: T.cardBg, border: `0.5px solid ${T.border}`, borderRadius: 4, overflow: 'hidden' }}>
                  {filteredSearchResults.length > 0 ? (
                    <div className="divide-y divide-gray-50">
                      {filteredSearchResults.map(runner => (
                        <button key={runner.id} className="w-full flex items-center gap-3 px-4 py-3 active:bg-gray-50 transition text-left"
                          onClick={() => { setProfileRunner(runner); setSearchQuery(''); setIsSearchFocused(false); haptic('light'); }}>
                          <div style={{ background: solidColor(runner.name) }}
                            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white">
                            {runner.initial}
                          </div>
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
                      <p className="text-[13px] text-gray-400">No runners found for &ldquo;{searchQuery}&rdquo;</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!(isSearchFocused && searchQuery.trim().length >= 2) && (
            <>
              {/* Contacts Card */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ margin: '0 20px 20px' }}>
                <button
                  onClick={() => { setShowContactsSheet(true); haptic('light'); }}
                  style={{ width: '100%', background: T.cardBg, border: `0.5px solid ${T.border}`, borderRadius: 4, padding: 16, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', outline: 'none', textAlign: 'left' }}
                  className="active:bg-[#FAFAF8] transition-colors"
                >
                  <div style={{ width: 40, height: 40, borderRadius: 4, background: T.black, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Smartphone size={18} color="white" strokeWidth={1.5} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: T.black, display: 'block' }}>Find Friends from Contacts</span>
                    <span style={{ fontSize: 11, fontWeight: 300, color: T.t3 }}>
                      {contactsSynced ? `${contactsOnRunivo.length} on Runivo` : 'Discover runners you know'}
                    </span>
                  </div>
                  <ChevronRight size={14} color={T.t3} strokeWidth={1.5} />
                </button>
              </motion.div>

              {/* Suggested for You */}
              {visiblePopular.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: T.black, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Suggested</span>
                    <button onClick={() => { setShowAllPopular(!showAllPopular); haptic('light'); }} style={{ fontSize: 11, fontWeight: 400, color: T.t2, background: 'none', outline: 'none', cursor: 'pointer' }} className="active:opacity-70">
                      {showAllPopular ? 'Less' : 'See all'}
                    </button>
                  </div>

                  {!showAllPopular ? (
                    <div style={{ paddingTop: 12 }}>
                    <div className="flex gap-4 px-4 overflow-x-auto scrollbar-none pb-2">
                      {visiblePopular.map(runner => {
                        const BadgeIcon = runner.badge ? badgeConfig[runner.badge]?.icon : null;
                        const badgeColor = runner.badge ? badgeConfig[runner.badge]?.color : '';
                        return (
                          <button
                            key={runner.id}
                            onClick={() => { setProfileRunner(runner); haptic('light'); }}
                            className="flex flex-col items-center gap-1.5 flex-shrink-0"
                          >
                            <div className="relative">
                              <div
                                style={{ background: solidColor(runner.name), boxShadow: `0 0 0 1.5px ${T.border}` }}
                                className="w-[54px] h-[54px] rounded-full flex items-center justify-center text-[17px] font-bold text-white"
                              >
                                {runner.initial}
                              </div>
                              {BadgeIcon && (
                                <div style={{ position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                                  <BadgeIcon className={`w-3 h-3 ${badgeColor}`} strokeWidth={2.5} />
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-center gap-0.5">
                              <span style={{ fontSize: 11, fontWeight: 400, color: T.black, maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{runner.name}</span>
                              <span style={{ fontSize: 10, fontWeight: 300, color: T.t3 }}>Lv.{runner.level}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    </div>
                  ) : (
                    <div style={{ margin: '0 20px', background: T.cardBg, border: `0.5px solid ${T.border}`, borderRadius: 4, overflow: 'hidden' }}>
                      {visiblePopular.map((runner, idx) => (
                        <button key={runner.id} onClick={() => { setProfileRunner(runner); haptic('light'); }}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'none', border: 'none', borderTop: idx > 0 ? `0.5px solid ${T.mid}` : 'none', cursor: 'pointer', outline: 'none', textAlign: 'left' }}
                          className="active:bg-[#FAFAF8] transition-colors">
                          <div style={{ width: 40, height: 40, borderRadius: '50%', background: solidColor(runner.name), flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 400, color: 'white' }}>
                            {runner.initial}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: T.black, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{runner.name}</div>
                            <div style={{ fontSize: 10, fontWeight: 300, color: T.t3, marginTop: 1 }}>{runner.recentRun || `${runner.territories} zones · Lv.${runner.level}`}</div>
                          </div>
                          <div onClick={(e) => { e.stopPropagation(); toggleFollow(runner.id); haptic('light'); }}
                            style={{ padding: '6px 14px', borderRadius: 2, fontSize: 11, fontWeight: 500, cursor: 'pointer', flexShrink: 0, background: following.has(runner.id) ? T.stone : T.black, color: following.has(runner.id) ? T.t2 : 'white', border: 'none', outline: 'none', transition: 'all 0.15s' }}>
                            {following.has(runner.id) ? 'Following' : 'Follow'}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Runners Near You */}
              {visibleNearby.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MapPin size={11} color={T.t3} strokeWidth={1.5} />
                      <span style={{ fontSize: 11, fontWeight: 500, color: T.black, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Near You</span>
                    </div>
                    <button onClick={() => { setShowAllNearby(!showAllNearby); haptic('light'); }}
                      style={{ fontSize: 11, fontWeight: 400, color: T.t2, background: 'none', outline: 'none', cursor: 'pointer' }}
                      className="active:opacity-70">
                      {showAllNearby ? 'Less' : 'See all'}
                    </button>
                  </div>
                  <div style={{ margin: '0 20px', background: T.cardBg, border: `0.5px solid ${T.border}`, borderRadius: 4, overflow: 'hidden' }}>
                    {(showAllNearby ? visibleNearby : visibleNearby.slice(0, 3)).map((runner, idx) => (
                      <button key={runner.id} onClick={() => { setProfileRunner(runner); haptic('light'); }}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'none', border: 'none', borderTop: idx > 0 ? `0.5px solid ${T.mid}` : 'none', cursor: 'pointer', outline: 'none', textAlign: 'left' }}
                        className="active:bg-[#FAFAF8] transition-colors">
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <div style={{ width: 40, height: 40, borderRadius: '50%', background: solidColor(runner.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 400, color: 'white' }}>
                            {runner.initial}
                          </div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: T.black, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{runner.name}</div>
                          <div style={{ fontSize: 10, fontWeight: 300, color: T.t3, marginTop: 1 }}>{runner.recentRun || runner.location || `Lv.${runner.level}`}</div>
                        </div>
                        <div onClick={(e) => { e.stopPropagation(); toggleFollow(runner.id); haptic('light'); }}
                          style={{ padding: '6px 14px', borderRadius: 2, fontSize: 11, fontWeight: 500, cursor: 'pointer', flexShrink: 0, background: following.has(runner.id) ? T.stone : T.black, color: following.has(runner.id) ? T.t2 : 'white', border: 'none', outline: 'none', transition: 'all 0.15s' }}>
                          {following.has(runner.id) ? 'Following' : 'Follow'}
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* From Your Clubs */}
              {visibleFromClubs.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-5">
                  <div className="flex items-center gap-1.5 px-5 mb-2.5">
                    <Users className="w-3.5 h-3.5 text-[#E8435A]" strokeWidth={2} />
                    <span className="text-[13px] font-bold text-gray-900">From Your Clubs</span>
                  </div>
                  <div className="bg-white mx-4 rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
                    {visibleFromClubs.map(runner => (
                      <button key={runner.id} onClick={() => { setProfileRunner(runner); haptic('light'); }}
                        className="w-full flex items-center gap-3 px-4 py-3 active:bg-gray-50 transition text-left">
                        <div style={{ background: solidColor(runner.name) }}
                          className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white">
                          {runner.initial}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[13px] font-semibold text-gray-900 block truncate">{runner.name}</span>
                          <span className="text-[11px] text-gray-400">{runner.recentRun}</span>
                        </div>
                        <div onClick={(e) => { e.stopPropagation(); toggleFollow(runner.id); haptic('light'); }}
                          className={`px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all flex-shrink-0 ${
                            following.has(runner.id) ? 'bg-gray-100 text-gray-500' : 'bg-[#E8435A] text-white active:bg-[#D03A4F]'
                          }`}>{following.has(runner.id) ? 'Following' : 'Follow'}</div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Invite Friends */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ margin: '0 20px 16px' }}>
                <button
                  onClick={inviteFriends}
                  style={{ width: '100%', background: T.black, borderRadius: 4, padding: 16, display: 'flex', alignItems: 'center', gap: 14, border: 'none', cursor: 'pointer', outline: 'none' }}
                  className="active:opacity-90 transition-opacity"
                >
                  <div style={{ width: 40, height: 40, borderRadius: 4, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <UserPlus size={18} color="white" strokeWidth={1.5} />
                  </div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'white', display: 'block' }}>Invite Friends to Runivo</span>
                    <span style={{ fontSize: 11, fontWeight: 300, color: 'rgba(255,255,255,0.6)' }}>Share your link &amp; run together</span>
                  </div>
                  <ChevronRight size={16} color="rgba(255,255,255,0.4)" strokeWidth={1.5} />
                </button>
              </motion.div>
            </>
          )}
        </motion.div>
      )}

      {/* ── Contacts bottom sheet ── */}
      <AnimatePresence>
        {showContactsSheet && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-[60]"
              onClick={() => setShowContactsSheet(false)} />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 70, background: T.cardBg, borderTopLeftRadius: 8, borderTopRightRadius: 8, maxHeight: '85vh', overflowY: 'auto', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
                <div style={{ width: 32, height: 3, borderRadius: 2, background: T.mid }} />
              </div>

              <div style={{ padding: '0 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 15, fontWeight: 500, color: T.black }}>Your Contacts</span>
                <button onClick={() => setShowContactsSheet(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', outline: 'none', padding: 4 }} className="active:opacity-60">
                  <X size={18} color={T.t2} strokeWidth={1.5} />
                </button>
              </div>

              {!contactsSynced ? (
                <div style={{ padding: '16px 20px 24px', textAlign: 'center' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 4, background: T.black, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <Smartphone size={24} color="white" strokeWidth={1.5} />
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 500, color: T.black, marginBottom: 6 }}>Connect Your Contacts</p>
                  <p style={{ fontSize: 12, fontWeight: 300, color: T.t2, lineHeight: 1.6, marginBottom: 20, maxWidth: 280, margin: '0 auto 20px' }}>
                    Find friends who are already on Runivo and invite others to join you
                  </p>
                  <button
                    onClick={openContactPicker}
                    style={{ width: '100%', padding: '14px 0', borderRadius: 4, background: T.black, color: 'white', fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', outline: 'none' }}
                    className="active:opacity-90 transition-opacity"
                  >
                    Allow Access
                  </button>
                  <p style={{ fontSize: 10, fontWeight: 300, color: T.t3, marginTop: 10 }}>Your contacts are never stored on our servers</p>
                </div>
              ) : (
                <div className="pb-4">
                  {contactsOnRunivo.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 9, fontWeight: 400, textTransform: 'uppercase', letterSpacing: '0.12em', color: T.t3 }}>On Runivo</span>
                        <span style={{ fontSize: 10, fontWeight: 500, color: T.red, background: T.redLo, padding: '1px 6px', borderRadius: 2 }}>{contactsOnRunivo.length}</span>
                      </div>
                      <div>
                        {contactsOnRunivo.map((contact, idx) => (
                          <div key={contact.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderTop: idx > 0 ? `0.5px solid ${T.mid}` : 'none' }}>
                            <div style={{ width: 40, height: 40, borderRadius: '50%', background: solidColor(contact.name), flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 400, color: 'white' }}>
                              {contact.initial}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ fontSize: 13, fontWeight: 500, color: T.black, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contact.name}</span>
                              <span style={{ fontSize: 10, fontWeight: 300, color: T.t3 }}>Lv.{contact.level} · {contact.territories} zones</span>
                            </div>
                            <button onClick={() => { toggleFollow(contact.id); haptic('light'); }}
                              style={{ padding: '6px 14px', borderRadius: 2, fontSize: 11, fontWeight: 500, flexShrink: 0, background: following.has(contact.id) ? T.stone : T.black, color: following.has(contact.id) ? T.t2 : 'white', border: 'none', cursor: 'pointer', outline: 'none', transition: 'all 0.15s' }}>
                              {following.has(contact.id) ? 'Following' : 'Follow'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {contactsNotOnRunivo.length > 0 && (
                    <div>
                      <div style={{ padding: '8px 20px' }}>
                        <span style={{ fontSize: 9, fontWeight: 400, textTransform: 'uppercase', letterSpacing: '0.12em', color: T.t3 }}>Invite to Runivo</span>
                      </div>
                      <div>
                        {contactsNotOnRunivo.map((contact, idx) => (
                          <div key={contact.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderTop: idx > 0 ? `0.5px solid ${T.mid}` : 'none' }}>
                            <div style={{ width: 40, height: 40, borderRadius: '50%', background: solidColor(contact.name), flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 400, color: 'white', opacity: 0.5 }}>
                              {contact.initial}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ fontSize: 13, fontWeight: 400, color: T.black, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contact.name}</span>
                              <span style={{ fontSize: 10, fontWeight: 300, color: T.t3 }}>{contact.phone}</span>
                            </div>
                            <button onClick={() => sendInvite(contact.id, contact.name, contact.phone)}
                              style={{ padding: '6px 14px', borderRadius: 2, fontSize: 11, fontWeight: 500, flexShrink: 0, background: invited.has(contact.id) ? T.stone : T.black, color: invited.has(contact.id) ? T.t2 : 'white', border: 'none', cursor: 'pointer', outline: 'none', transition: 'all 0.15s' }}>
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
