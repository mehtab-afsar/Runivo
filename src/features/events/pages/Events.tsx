import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MapPin, Calendar, Clock, Users, ChevronRight, Bookmark, Plus,
} from 'lucide-react';
import { haptic } from '@shared/lib/haptics';
import { supabase } from '@shared/services/supabase';
import type { EventTab, RunEvent } from '../types';
import { categoryLabel } from '../types';

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatEventTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export default function Events() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<EventTab>('upcoming');
  const [savedEvents, setSavedEvents] = useState<Set<string>>(new Set());
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [isEmpireBuilder, setIsEmpireBuilder] = useState(false);

  useEffect(() => {
    loadEvents();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('profiles').select('subscription_tier').eq('id', user.id).single()
        .then(({ data }) => { setIsEmpireBuilder(data?.subscription_tier === 'empire-builder'); });
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
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleJoin = async (eventId: string) => {
    haptic('light');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const isJoined = joinedIds.has(eventId);
    // Optimistic update
    setJoinedIds(prev => {
      const n = new Set(prev);
      if (isJoined) n.delete(eventId); else n.add(eventId);
      return n;
    });
    setEvents(prev => prev.map(e => e.id === eventId
      ? { ...e, participants: e.participants + (isJoined ? -1 : 1) } : e));

    if (isJoined) {
      await supabase.from('event_participants').delete().eq('event_id', eventId).eq('user_id', user.id);
    } else {
      await supabase.from('event_participants').insert({ event_id: eventId, user_id: user.id });
    }
  };

  const now = new Date();
  const CHALLENGE_TYPES = ['challenge', 'brand-challenge', 'king-of-hill', 'survival'];
  const filtered = events.filter(e => {
    const ends = new Date(e.endsAt);
    const starts = new Date(e.startsAt);
    if (activeTab === 'past') return ends < now;
    if (activeTab === 'challenges') return CHALLENGE_TYPES.includes(e.category) && ends >= now;
    return (starts >= now || ends >= now) && !CHALLENGE_TYPES.includes(e.category);
  });

  const stagger = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };
  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, damping: 24, stiffness: 200 } },
  };

  return (
    <div className="h-full bg-[#FAFAFA] dark:bg-[#0A0A0A] overflow-y-auto pb-24">
      <div style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>

        {/* Header */}
        <div className="px-5 mb-5">
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Events</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">Races, meetups & challenges near you</p>
        </div>

        {/* Tabs */}
        <div className="px-5 mb-5">
          <div className="flex gap-6 border-b border-gray-100">
            {(['upcoming', 'challenges', 'past'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); haptic('light'); }}
                className={`pb-3 text-[13px] font-semibold capitalize transition-all border-b-2 -mb-px ${
                  activeTab === tab
                    ? 'text-gray-900 border-gray-900'
                    : 'text-gray-400 border-transparent'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Events */}
        {loading && (
          <div className="flex justify-center py-16">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-6 h-6 border-2 border-gray-200 border-t-[#E8435A] rounded-full"
            />
          </div>
        )}

        {!loading && filtered.length > 0 ? (
          <motion.div
            key={activeTab}
            variants={stagger}
            initial="hidden"
            animate="show"
            className="px-5 space-y-4"
          >
            {filtered.map(event => {
              const isSaved = savedEvents.has(event.id);

              return (
                <motion.div
                  key={event.id}
                  variants={item}
                  className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
                >
                  <div className="p-4">
                    {/* Top row: category + date */}
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                          {categoryLabel[event.category]}
                        </span>
                        {event.distance && (
                          <>
                            <span className="text-gray-200">&middot;</span>
                            <span className="text-stat text-[11px] font-semibold text-gray-500">{event.distance}</span>
                          </>
                        )}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleSave(event.id); }}
                        className="p-1 -mr-1"
                      >
                        <Bookmark
                          className={`w-4 h-4 transition ${isSaved ? 'text-gray-900 fill-gray-900' : 'text-gray-300'}`}
                          strokeWidth={1.8}
                        />
                      </button>
                    </div>

                    {/* Title */}
                    <h3 className="text-[16px] font-bold text-gray-900 leading-snug mb-1.5">{event.title}</h3>
                    <p className="text-[13px] text-gray-400 leading-relaxed mb-4">{event.description}</p>

                    {/* Details */}
                    <div className="flex flex-wrap gap-x-4 gap-y-2 mb-4">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-gray-300" strokeWidth={1.8} />
                        <span className="text-[12px] text-gray-600">{event.date}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-gray-300" strokeWidth={1.8} />
                        <span className="text-[12px] text-gray-600">{event.time}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-gray-300" strokeWidth={1.8} />
                        <span className="text-[12px] text-gray-600">{event.location}</span>
                      </div>
                    </div>

                    {/* Bottom row */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                      <div className="flex items-center gap-3">
                        {/* Organizer */}
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                            <span className="text-[9px] font-bold text-gray-500">{event.organizerInitial}</span>
                          </div>
                          <span className="text-[12px] text-gray-500">{event.organizer}</span>
                        </div>
                        <span className="text-gray-200">&middot;</span>
                        <div className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-gray-300" strokeWidth={1.8} />
                          <span className="text-[12px] text-gray-500">{event.participants.toLocaleString()}</span>
                        </div>
                      </div>

                      {joinedIds.has(event.id) ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleJoin(event.id); }}
                          className="text-[11px] font-semibold text-[#E8435A]"
                        >
                          Joined ✓
                        </button>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleJoin(event.id); }}
                          className="text-[12px] font-semibold text-gray-900 flex items-center gap-1"
                        >
                          Join
                          <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        ) : !loading && (
          <div className="flex flex-col items-center justify-center py-20 px-5">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Calendar className="w-6 h-6 text-gray-300" strokeWidth={1.5} />
            </div>
            <h3 className="text-[15px] font-semibold text-gray-600 mb-1">
              {activeTab === 'past' ? 'No past events' : 'No events yet'}
            </h3>
            <p className="text-[13px] text-gray-400 text-center max-w-[260px]">
              {activeTab === 'past' ? 'Events you\'ve attended will show up here' : 'Check back soon for upcoming events'}
            </p>
          </div>
        )}

      </div>

      {/* Create Event FAB */}
      <button
        onClick={() => {
          haptic('light');
          navigate(isEmpireBuilder ? '/events/create' : '/subscription');
        }}
        className="fixed bottom-24 right-5 w-14 h-14 rounded-full
                   bg-gradient-to-br from-[#E8435A] to-[#D03A4F]
                   flex items-center justify-center
                   shadow-[0_4px_16px_rgba(232,67,90,0.35)] z-20"
      >
        <Plus className="w-6 h-6 text-white" strokeWidth={2.5} />
      </button>
    </div>
  );
}
