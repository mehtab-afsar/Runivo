import { useState } from 'react';
import { motion } from 'framer-motion';
// import { useNavigate } from 'react-router-dom';
import {
  MapPin, Calendar, Clock, Users, ChevronRight, Bookmark,
} from 'lucide-react';
import { haptic } from '../../lib/haptics';

type EventTab = 'upcoming' | 'challenges' | 'past';

interface RunEvent {
  id: string;
  title: string;
  description: string;
  category: 'race' | 'meetup' | 'challenge';
  date: string;
  time: string;
  location: string;
  distance?: string;
  participants: number;
  spotsLeft?: number;
  organizer: string;
  organizerInitial: string;
  saved?: boolean;
  joined?: boolean;
  image?: string; // placeholder pattern
}

const events: RunEvent[] = [
  {
    id: '1',
    title: 'Delhi Half Marathon 2026',
    description: 'Annual half marathon through the heart of Delhi. Chip-timed, certified course with aid stations every 2km.',
    category: 'race',
    date: 'Sun, Mar 22',
    time: '6:00 AM',
    location: 'Jawaharlal Nehru Stadium',
    distance: '21.1 km',
    participants: 4200,
    spotsLeft: 340,
    organizer: 'Delhi Runners Club',
    organizerInitial: 'D',
  },
  {
    id: '2',
    title: 'Saturday Morning Group Run',
    description: 'Casual 5-8km run through Lodhi Garden. All paces welcome. Coffee after!',
    category: 'meetup',
    date: 'Sat, Mar 8',
    time: '6:30 AM',
    location: 'Lodhi Garden, Gate 2',
    distance: '5-8 km',
    participants: 28,
    organizer: 'Sarah Johnson',
    organizerInitial: 'S',
    joined: true,
  },
  {
    id: '3',
    title: 'March 100K Challenge',
    description: 'Run 100km total this month. Log your runs and track progress against the community.',
    category: 'challenge',
    date: 'Mar 1 - 31',
    time: 'All Month',
    location: 'Anywhere',
    participants: 1890,
    organizer: 'Runivo',
    organizerInitial: 'R',
    joined: true,
  },
  {
    id: '4',
    title: 'Sunset Trail Run',
    description: 'Evening trail run on the Northern Ridge. Moderate difficulty, bring headlamp for the return.',
    category: 'meetup',
    date: 'Wed, Mar 12',
    time: '4:30 PM',
    location: 'Northern Ridge Trailhead',
    distance: '10 km',
    participants: 15,
    spotsLeft: 5,
    organizer: 'Trail Tribe Delhi',
    organizerInitial: 'T',
  },
  {
    id: '5',
    title: 'Fastest 5K - Weekly Sprint',
    description: 'Beat your personal best this week. Top 3 finishers earn exclusive badges.',
    category: 'challenge',
    date: 'This Week',
    time: 'Anytime',
    location: 'Anywhere',
    participants: 567,
    organizer: 'Runivo',
    organizerInitial: 'R',
  },
  {
    id: '6',
    title: 'Nehru Park Interval Session',
    description: 'Structured speed workout: 8x400m with 90s recovery. Coach-led session.',
    category: 'meetup',
    date: 'Tue, Mar 11',
    time: '6:00 AM',
    location: 'Nehru Park, South Gate',
    distance: '6 km',
    participants: 22,
    spotsLeft: 8,
    organizer: 'Coach Rahul',
    organizerInitial: 'C',
  },
];

const categoryLabel: Record<string, string> = {
  race: 'Race',
  meetup: 'Meetup',
  challenge: 'Challenge',
};

export default function Events() {
  const [activeTab, setActiveTab] = useState<EventTab>('upcoming');
  const [savedEvents, setSavedEvents] = useState<Set<string>>(new Set());

  const toggleSave = (id: string) => {
    haptic('light');
    setSavedEvents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = activeTab === 'past'
    ? []
    : activeTab === 'challenges'
    ? events.filter(e => e.category === 'challenge')
    : events.filter(e => e.category !== 'challenge');

  const stagger = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };
  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, damping: 24, stiffness: 200 } },
  };

  return (
    <div className="h-full bg-[#FAFAFA] overflow-y-auto pb-24">
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
        {filtered.length > 0 ? (
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

                      {event.joined ? (
                        <span className="text-[11px] font-semibold text-teal-600">Joined</span>
                      ) : event.spotsLeft !== undefined ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); haptic('light'); }}
                          className="text-[12px] font-semibold text-gray-900 flex items-center gap-1"
                        >
                          {event.spotsLeft} spots left
                          <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                        </button>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); haptic('light'); }}
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
        ) : (
          <div className="flex flex-col items-center justify-center py-20 px-5">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Calendar className="w-6 h-6 text-gray-300" strokeWidth={1.5} />
            </div>
            <h3 className="text-[15px] font-semibold text-gray-600 mb-1">No past events</h3>
            <p className="text-[13px] text-gray-400 text-center max-w-[260px]">
              Events you've attended will show up here
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
