import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark, Calendar, Clock, MapPin, Users, Plus, X, Share2, Check } from 'lucide-react';
import { haptic } from '@shared/lib/haptics';
import { supabase } from '@shared/services/supabase';
import type { EventTab, RunEvent } from '../types';
import { categoryLabel } from '../types';
import { T, F, FD } from '@shared/design-system/tokens';

const redBo = 'rgba(217,53,24,0.2)';

const AVATAR_COLORS = [
  '#D93518', '#1A6B40', '#9E6800', '#1E4D8C', '#6B2D8C',
  '#8C2D1E', '#2D6B5C', '#5C6B2D',
];

function avatarColor(initial: string): string {
  return AVATAR_COLORS[initial.charCodeAt(0) % AVATAR_COLORS.length];
}

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatEventTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export default function Events() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab]       = useState<EventTab>('upcoming');
  const [savedEvents, setSavedEvents]   = useState<Set<string>>(new Set());
  const [events, setEvents]             = useState<RunEvent[]>([]);
  const [loading, setLoading]           = useState(true);
  const [joinedIds, setJoinedIds]       = useState<Set<string>>(new Set());
  const [isEmpireBuilder, setIsEmpireBuilder] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<RunEvent | null>(null);

  useEffect(() => {
    loadEvents();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('profiles').select('subscription_tier').eq('id', user.id).single()
        .then(({ data }) => { setIsEmpireBuilder(data?.subscription_tier === 'premium'); });
    });
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { data: eventsData } = await supabase
      .from('events')
      .select('*')
      .eq('is_active', true)
      .order('starts_at', { ascending: true });

    let participatedIds: Set<string> = new Set();
    if (user && eventsData?.length) {
      const { data: participants } = await supabase
        .from('event_participants')
        .select('event_id')
        .eq('user_id', user.id)
        .in('event_id', eventsData.map(e => e.id));
      participatedIds = new Set(participants?.map(p => p.event_id) ?? []);
    }

    setJoinedIds(participatedIds);
    setEvents((eventsData ?? []).map(e => ({
      id: e.id,
      title: e.title,
      description: e.description ?? '',
      category: e.event_type,
      date: formatEventDate(e.starts_at),
      time: formatEventTime(e.starts_at),
      location: e.location_name ?? 'TBD',
      distance: e.distance_m ? `${(e.distance_m / 1000).toFixed(1)} km` : undefined,
      participants: e.participant_count,
      organizer: 'Runivo',
      organizerInitial: 'R',
      joined: participatedIds.has(e.id),
      startsAt: e.starts_at,
      endsAt: e.ends_at,
    })));
    setLoading(false);
  };

  const toggleSave = (id: string) => {
    haptic('light');
    setSavedEvents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleJoin = async (eventId: string) => {
    haptic('medium');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const isJoined = joinedIds.has(eventId);
    setJoinedIds(prev => { const n = new Set(prev); if (isJoined) n.delete(eventId); else n.add(eventId); return n; });
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, participants: e.participants + (isJoined ? -1 : 1) } : e));
    if (isJoined) {
      await supabase.from('event_participants').delete().eq('event_id', eventId).eq('user_id', user.id);
    } else {
      await supabase.from('event_participants').insert({ event_id: eventId, user_id: user.id });
    }
  };

  const handleShare = (event: RunEvent) => {
    haptic('light');
    if (navigator.share) {
      navigator.share({ title: event.title, text: `Join me at ${event.title} on ${event.date}!` }).catch(() => {});
    }
  };

  const now = new Date();
  const CHALLENGE_TYPES = ['challenge', 'brand-challenge', 'king-of-hill', 'survival'];
  const filtered = events.filter(e => {
    const ends   = new Date(e.endsAt);
    const starts = new Date(e.startsAt);
    if (activeTab === 'past')       return ends < now;
    if (activeTab === 'challenges') return CHALLENGE_TYPES.includes(e.category) && ends >= now;
    return (starts >= now || ends >= now) && !CHALLENGE_TYPES.includes(e.category);
  });

  const tabs: { key: EventTab; label: string }[] = [
    { key: 'upcoming',   label: 'Upcoming'   },
    { key: 'challenges', label: 'Challenges' },
    { key: 'past',       label: 'Past'       },
  ];

  return (
    <div style={{ height: '100%', background: T.bg, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ background: T.white, paddingTop: 'max(14px, env(safe-area-inset-top))', borderBottom: `0.5px solid ${T.border}` }}>
        <div style={{ padding: '0 18px 12px' }}>
          <div style={{ fontSize: 20, fontStyle: 'italic', fontFamily: FD, color: T.black }}>Events</div>
          <div style={{ fontSize: 10, fontWeight: 300, fontFamily: F, color: T.t3, marginTop: 2 }}>
            Races, meetups &amp; challenges near you
          </div>
        </div>

        {/* Segmented tabs */}
        <div style={{ padding: '0 18px 12px' }}>
          <div style={{ background: T.bg, borderRadius: 20, padding: 3, display: 'flex', gap: 2 }}>
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); haptic('light'); }}
                style={{
                  flex: 1, textAlign: 'center', padding: '6px 0', borderRadius: 16,
                  fontSize: 10, fontFamily: F, cursor: 'pointer',
                  ...(activeTab === tab.key
                    ? { background: T.white, border: `0.5px solid ${T.border}`, color: T.black, fontWeight: 500 }
                    : { color: T.t3, background: 'transparent', fontWeight: 400, border: 'none' }),
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Event cards */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 100 }}>
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${T.border}`, borderTopColor: T.red, animation: 'spin 1s linear infinite' }} />
          </div>
        )}

        {!loading && filtered.length > 0 && filtered.map((event, index) => {
          const isSaved  = savedEvents.has(event.id);
          const isJoined = joinedIds.has(event.id);
          return (
            <motion.div
              key={event.id}
              whileTap={{ opacity: 0.92 }}
              onClick={() => { setSelectedEvent(event); haptic('light'); }}
              style={{
                background: T.white, padding: '16px 18px',
                borderBottom: index < filtered.length - 1 ? `0.5px solid ${T.mid}` : undefined,
                cursor: 'pointer',
              }}
            >
              {/* Top row: category + bookmark */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.t3, fontFamily: F }}>
                    {categoryLabel[event.category] ?? event.category}
                  </span>
                  {event.distance && (
                    <span style={{ padding: '2px 7px', borderRadius: 10, background: T.redLo, color: T.red, fontSize: 9, fontWeight: 500, fontFamily: F }}>
                      {event.distance}
                    </span>
                  )}
                  {isJoined && (
                    <span style={{ padding: '2px 7px', borderRadius: 10, background: T.greenLo, color: T.green, fontSize: 9, fontWeight: 500, fontFamily: F }}>
                      Joined
                    </span>
                  )}
                </div>
                <button
                  onClick={e => { e.stopPropagation(); toggleSave(event.id); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}
                >
                  <Bookmark size={14} color={isSaved ? T.red : T.t3} fill={isSaved ? T.red : 'none'} strokeWidth={1.8} />
                </button>
              </div>

              {/* Title */}
              <div style={{ fontSize: 15, fontWeight: 500, fontFamily: F, color: T.black, marginBottom: 10, lineHeight: 1.25 }}>
                {event.title}
              </div>

              {/* Meta */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Calendar size={10} color={T.t3} strokeWidth={1.8} />
                  <span style={{ fontSize: 10, fontWeight: 300, color: T.t2, fontFamily: F }}>{event.date}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <MapPin size={10} color={T.t3} strokeWidth={1.8} />
                  <span style={{ fontSize: 10, fontWeight: 300, color: T.t2, fontFamily: F }}>{event.location}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Users size={10} color={T.t3} strokeWidth={1.8} />
                  <span style={{ fontSize: 10, fontWeight: 300, color: T.t3, fontFamily: F }}>{event.participants.toLocaleString()}</span>
                </div>
              </div>
            </motion.div>
          );
        })}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '56px 18px' }}>
            <Calendar size={32} color={T.t3} strokeWidth={1.5} />
            <div style={{ fontSize: 13, fontWeight: 500, color: T.black, fontFamily: F }}>
              {activeTab === 'past' ? 'No past events' : 'No events yet'}
            </div>
            <div style={{ fontSize: 11, fontWeight: 300, color: T.t3, fontFamily: F, textAlign: 'center' }}>
              {activeTab === 'past' ? "Events you've attended will show up here" : 'Check back soon for upcoming events'}
            </div>
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => { haptic('light'); navigate(isEmpireBuilder ? '/events/create' : '/subscription'); }}
        style={{
          position: 'fixed', bottom: 'calc(72px + env(safe-area-inset-bottom))', right: 14,
          width: 40, height: 40, borderRadius: '50%', background: T.red,
          boxShadow: '0 4px 12px rgba(217,53,24,0.30)',
          border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20,
        }}
      >
        <Plus size={16} color={T.white} strokeWidth={2.5} />
      </button>

      {/* ── Event Detail Bottom Sheet ── */}
      <AnimatePresence>
        {selectedEvent && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedEvent(null)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100 }}
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
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

                {/* Header: title + close */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                  <div style={{ flex: 1 }}>
                    {/* Category + distance pills */}
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.t3, fontFamily: F }}>
                        {categoryLabel[selectedEvent.category] ?? selectedEvent.category}
                      </span>
                      {selectedEvent.distance && (
                        <span style={{ padding: '2px 8px', borderRadius: 10, background: T.redLo, color: T.red, fontSize: 9, fontWeight: 500, fontFamily: F }}>
                          {selectedEvent.distance}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 22, fontStyle: 'italic', fontFamily: FD, color: T.black, lineHeight: 1.2 }}>
                      {selectedEvent.title}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedEvent(null)}
                    style={{ width: 28, height: 28, borderRadius: '50%', background: T.mid, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginTop: 2 }}
                  >
                    <X size={12} color={T.t2} />
                  </button>
                </div>

                {/* Description */}
                {selectedEvent.description && (
                  <p style={{ fontSize: 13, fontWeight: 300, color: T.t2, fontFamily: F, lineHeight: 1.7, margin: '0 0 20px' }}>
                    {selectedEvent.description}
                  </p>
                )}

                {/* Detail rows */}
                <div style={{ background: T.white, border: `0.5px solid ${T.border}`, borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}>
                  {[
                    { Icon: Calendar, label: 'Date',     value: selectedEvent.date     },
                    { Icon: Clock,    label: 'Time',     value: selectedEvent.time     },
                    { Icon: MapPin,   label: 'Location', value: selectedEvent.location },
                    { Icon: Users,    label: 'Going',    value: `${selectedEvent.participants.toLocaleString()} runners` },
                  ].map(({ Icon, label, value }, i, arr) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', borderBottom: i < arr.length - 1 ? `0.5px solid ${T.mid}` : 'none' }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, background: T.stone, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={13} color={T.t2} strokeWidth={1.5} />
                      </div>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 400, color: T.t3, fontFamily: F, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 400, color: T.black, fontFamily: F }}>{value}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Organizer */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: avatarColor(selectedEvent.organizerInitial), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', fontFamily: F }}>{selectedEvent.organizerInitial}</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: T.t3, fontFamily: F, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 1 }}>Organizer</div>
                    <div style={{ fontSize: 13, fontWeight: 400, color: T.black, fontFamily: F }}>{selectedEvent.organizer}</div>
                  </div>
                </div>

              </div>

              {/* Pinned footer — always above nav bar */}
              <div style={{
                padding: '12px 20px',
                paddingBottom: 'max(calc(env(safe-area-inset-bottom) + 80px), 96px)',
                background: T.bg, borderTop: `0.5px solid ${T.border}`, flexShrink: 0,
                display: 'flex', gap: 10,
              }}>
                {/* Share */}
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => handleShare(selectedEvent)}
                  style={{
                    width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                    background: T.white, border: `0.5px solid ${T.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  }}
                >
                  <Share2 size={16} color={T.t2} strokeWidth={1.5} />
                </motion.button>

                {/* Bookmark */}
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => toggleSave(selectedEvent.id)}
                  style={{
                    width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                    background: savedEvents.has(selectedEvent.id) ? T.redLo : T.white,
                    border: `0.5px solid ${savedEvents.has(selectedEvent.id) ? redBo : T.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  }}
                >
                  <Bookmark size={16} color={savedEvents.has(selectedEvent.id) ? T.red : T.t2} fill={savedEvents.has(selectedEvent.id) ? T.red : 'none'} strokeWidth={1.5} />
                </motion.button>

                {/* Join */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => toggleJoin(selectedEvent.id)}
                  style={{
                    flex: 1, height: 48, borderRadius: 14,
                    fontSize: 14, fontWeight: 600, fontFamily: F,
                    border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    background: joinedIds.has(selectedEvent.id) ? T.greenLo : T.black,
                    color: joinedIds.has(selectedEvent.id) ? T.green : T.white,
                  }}
                >
                  {joinedIds.has(selectedEvent.id) && <Check size={15} strokeWidth={2} />}
                  {joinedIds.has(selectedEvent.id) ? 'Joined' : 'Join event'}
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
