import { useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Footprints, Bike, Mountain, ChevronRight } from 'lucide-react';
import { getRuns, StoredRun } from '@shared/services/store';
import { pullRuns } from '@shared/services/sync';
import { T, F } from '@shared/design-system/tokens';

// Local overrides for values that differ from the standard token sheet
const pageBg   = '#F7F5F2'
const black    = '#1A1A1A'
const t2       = 'rgba(0,0,0,0.55)'
const t3       = 'rgba(0,0,0,0.35)'
const border   = 'rgba(0,0,0,0.07)'
const mid      = 'rgba(0,0,0,0.12)'
const red      = T.red
const redLo    = 'rgba(217,53,24,0.10)'
const green    = '#22A05B'
const greenLo  = 'rgba(34,160,91,0.10)'
const orange   = '#E8863A'
const orangeLo = 'rgba(232,134,58,0.12)'
const purple   = '#7C3AED'
const purpleLo = 'rgba(124,58,237,0.10)'

type ActivityFilter = 'all' | 'run' | 'walk' | 'cycle' | 'hike';

const FILTERS: { key: ActivityFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'run', label: 'Run' },
  { key: 'walk', label: 'Walk' },
  { key: 'cycle', label: 'Cycle' },
  { key: 'hike', label: 'Hike' },
];

const ACTIVITY_CONFIG: Record<string, { color: string; lo: string; icon: ReactNode }> = {
  run:   { color: red,    lo: redLo,    icon: <Activity size={18} strokeWidth={2} /> },
  walk:  { color: green,  lo: greenLo,  icon: <Footprints size={18} strokeWidth={2} /> },
  cycle: { color: purple, lo: purpleLo, icon: <Bike size={18} strokeWidth={2} /> },
  hike:  { color: orange, lo: orangeLo, icon: <Mountain size={18} strokeWidth={2} /> },
};

function getActivityConfig(type: string) {
  return ACTIVITY_CONFIG[type] ?? ACTIVITY_CONFIG.run;
}

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

function formatDate(timestamp: number) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTimeOfDay(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

export default function History() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<StoredRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ActivityFilter>('all');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const local = await getRuns();
      setRuns(local);
      setLoading(false);
      try {
        await pullRuns(100);
        const synced = await getRuns();
        setRuns(synced);
      } catch { /* offline */ }
    })();
  }, []);

  const validRuns = runs.filter(r => r.distanceMeters >= 50);
  const filtered = filter === 'all' ? validRuns : validRuns.filter(r => r.activityType === filter);

  const totalDistance = validRuns.reduce((s, r) => s + r.distanceMeters / 1000, 0);
  const totalTime = validRuns.reduce((s, r) => s + r.durationSec, 0);
  const totalZones = validRuns.reduce((s, r) => s + r.territoriesClaimed.length, 0);

  const grouped: { date: string; runs: StoredRun[] }[] = [];
  filtered.forEach(run => {
    const key = new Date(run.startTime).toDateString();
    const existing = grouped.find(g => g.date === key);
    if (existing) existing.runs.push(run);
    else grouped.push({ date: key, runs: [run] });
  });

  return (
    <div style={{ minHeight: '100%', background: pageBg, fontFamily: F, paddingBottom: 96 }}>

      {/* Header */}
      <div style={{ padding: '0 20px', paddingTop: 'max(20px, env(safe-area-inset-top))', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: black, margin: 0 }}>Run History</h1>
            <p style={{ fontSize: 13, color: t3, margin: '2px 0 0' }}>{validRuns.length} activities recorded</p>
          </div>
        </div>

        {/* Stat chips */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[
            { label: 'Distance', value: `${totalDistance.toFixed(1)}`, unit: 'km' },
            { label: 'Time', value: `${Math.floor(totalTime / 3600)}h ${Math.floor((totalTime % 3600) / 60)}m`, unit: '' },
            { label: 'Zones', value: `${totalZones}`, unit: '', valueColor: red },
          ].map(s => (
            <div key={s.label} style={{
              background: T.white, borderRadius: 14, padding: '12px 10px', textAlign: 'center',
              border: `1px solid ${border}`,
            }}>
              <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: t3, margin: '0 0 4px' }}>{s.label}</p>
              <p style={{ fontSize: 18, fontWeight: 700, color: s.valueColor ?? black, margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                {s.value}<span style={{ fontSize: 11, fontWeight: 500, color: t3 }}>{s.unit && ` ${s.unit}`}</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, padding: '0 20px', marginBottom: 20, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            padding: '7px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', flexShrink: 0,
            fontSize: 13, fontWeight: 600, fontFamily: F, transition: 'all 0.15s',
            background: filter === f.key ? black : T.white,
            color: filter === f.key ? T.white : t2,
            boxShadow: filter === f.key ? 'none' : `0 1px 3px ${border}`,
          }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '0 20px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ background: T.white, borderRadius: 16, padding: 16, border: `1px solid ${border}` }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: T.stone }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 13, width: 120, background: T.stone, borderRadius: 6, marginBottom: 8 }} />
                    <div style={{ height: 11, width: 180, background: T.stone, borderRadius: 6 }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: T.stone, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Activity size={24} color={t3} strokeWidth={1.5} />
            </div>
            <p style={{ fontSize: 17, fontWeight: 700, color: black, margin: '0 0 6px' }}>
              {filter === 'all' ? 'No runs yet' : `No ${filter}s yet`}
            </p>
            <p style={{ fontSize: 13, color: t3, margin: '0 0 24px' }}>
              {filter === 'all' ? 'Start your first activity to claim territories' : `Switch to a different filter or start a ${filter}`}
            </p>
            {filter === 'all' && (
              <button onClick={() => navigate('/run')} style={{
                padding: '12px 28px', borderRadius: 14, border: 'none', cursor: 'pointer',
                background: black, color: T.white, fontSize: 14, fontWeight: 700, fontFamily: F,
              }}>
                Start Running
              </button>
            )}
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {grouped.map((group, gi) => (
                <div key={group.date}>
                  {/* Date divider */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: t3, whiteSpace: 'nowrap' }}>
                      {formatDate(new Date(group.date).getTime())}
                    </span>
                    <div style={{ flex: 1, height: 1, background: border }} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {group.runs.map((run, ri) => {
                      const cfg = getActivityConfig(run.activityType);
                      return (
                        <motion.div
                          key={run.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: gi * 0.04 + ri * 0.025 }}
                          onClick={() => {
                            const [paceM, paceS] = run.avgPace.split(':').map(Number);
                            const paceNum = (paceM || 0) + (paceS || 0) / 60;
                            navigate(`/run-summary/${run.id}`, {
                              state: {
                                runData: {
                                  distance: run.distanceMeters / 1000,
                                  duration: run.durationSec,
                                  pace: paceNum,
                                  territoriesClaimed: run.territoriesClaimed.length,
                                  currentLocation: run.gpsPoints.length > 0
                                    ? { lat: run.gpsPoints[run.gpsPoints.length - 1].lat, lng: run.gpsPoints[run.gpsPoints.length - 1].lng }
                                    : { lat: 0, lng: 0 },
                                  isActive: false, isPaused: false,
                                  route: run.gpsPoints.map(p => ({ lat: p.lat, lng: p.lng })),
                                  actionType: 'claim', success: true,
                                  xpEarned: run.xpEarned, coinsEarned: run.coinsEarned,
                                  enemyCaptured: run.enemyCaptured,
                                },
                              },
                            });
                          }}
                          style={{
                            background: T.white, borderRadius: 16, padding: 16,
                            border: `1px solid ${border}`, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 12,
                          }}
                          whileTap={{ scale: 0.98 }}
                        >
                          {/* Icon */}
                          <div style={{
                            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                            background: cfg.lo, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: cfg.color,
                          }}>
                            {cfg.icon}
                          </div>

                          {/* Details */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: black, textTransform: 'capitalize' }}>
                                {run.activityType}
                              </span>
                              <span style={{ fontSize: 11, color: t3 }}>{formatTimeOfDay(run.startTime)}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: t2, fontVariantNumeric: 'tabular-nums' }}>
                              <span style={{ fontWeight: 600 }}>{(run.distanceMeters / 1000).toFixed(2)} km</span>
                              <span style={{ color: mid }}>·</span>
                              <span>{formatTime(run.durationSec)}</span>
                              <span style={{ color: mid }}>·</span>
                              <span>{run.avgPace}/km</span>
                            </div>
                          </div>

                          {/* Zones badge */}
                          {run.territoriesClaimed.length > 0 && (
                            <div style={{ textAlign: 'center', flexShrink: 0 }}>
                              <p style={{ fontSize: 18, fontWeight: 800, color: red, margin: 0, lineHeight: 1 }}>
                                {run.territoriesClaimed.length}
                              </p>
                              <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: t3, margin: '2px 0 0' }}>zones</p>
                            </div>
                          )}

                          <ChevronRight size={16} color={mid} strokeWidth={2} />
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
