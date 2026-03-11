import { useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Activity, Footprints, Bike, Mountain } from 'lucide-react';
import { getRuns, StoredRun } from '@shared/services/store';
import { pullRuns } from '@shared/services/sync';

export default function History() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<StoredRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRuns();
  }, []);

  const loadRuns = async () => {
    setLoading(true);
    // Show local runs immediately for instant render
    const localRuns = await getRuns();
    setRuns(localRuns);
    setLoading(false);
    // Then pull from Supabase and refresh (may update GPS traces even if count is same)
    try {
      await pullRuns(100);
      const synced = await getRuns();
      setRuns(synced);
    } catch {
      // Offline — local data is sufficient
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s}s`;
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTimeOfDay = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Filter out 0-distance runs (incomplete/aborted sessions)
  const validRuns = runs.filter(r => r.distanceMeters >= 50);

  const totalDistance = validRuns.reduce((s, r) => s + r.distanceMeters / 1000, 0);
  const totalTime = validRuns.reduce((s, r) => s + r.durationSec, 0);
  const totalTerritories = validRuns.reduce((s, r) => s + r.territoriesClaimed.length, 0);

  const groupedRuns: { date: string; runs: StoredRun[] }[] = [];
  validRuns.forEach(run => {
    const dateStr = new Date(run.startTime).toDateString();
    const existing = groupedRuns.find(g => g.date === dateStr);
    if (existing) existing.runs.push(run);
    else groupedRuns.push({ date: dateStr, runs: [run] });
  });

  const activityIcons: Record<string, ReactNode> = {
    run: <Activity className="w-5 h-5 text-teal-600" strokeWidth={2} />,
    walk: <Footprints className="w-5 h-5 text-emerald-500" strokeWidth={2} />,
    cycle: <Bike className="w-5 h-5 text-purple-500" strokeWidth={2} />,
    hike: <Mountain className="w-5 h-5 text-orange-500" strokeWidth={2} />,
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0A0A] pb-24">
      <div className="px-5 pb-5" style={{ paddingTop: 'max(20px, env(safe-area-inset-top))' }}>
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-bold text-gray-900">Run History</h1>
          <span className="text-stat text-sm text-gray-400">{validRuns.length} runs</span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl shadow-sm p-3 text-center border border-gray-100">
            <span className="text-[10px] uppercase tracking-[0.2em] text-gray-400 block mb-1">Distance</span>
            <span className="text-stat text-lg font-bold text-gray-900">{totalDistance.toFixed(1)}</span>
            <span className="text-stat text-xs text-gray-400 ml-0.5">km</span>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-3 text-center border border-gray-100">
            <span className="text-[10px] uppercase tracking-[0.2em] text-gray-400 block mb-1">Time</span>
            <span className="text-stat text-lg font-bold text-gray-900">
              {Math.floor(totalTime / 3600)}h {Math.floor((totalTime % 3600) / 60)}m
            </span>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-3 text-center border border-gray-100">
            <span className="text-[10px] uppercase tracking-[0.2em] text-gray-400 block mb-1">Zones</span>
            <span className="text-stat text-lg font-bold text-teal-600">{totalTerritories}</span>
          </div>
        </div>
      </div>

      <div className="px-5">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-2xl shadow-sm p-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-100" />
                  <div className="flex-1">
                    <div className="h-3.5 w-32 bg-gray-100 rounded mb-2" />
                    <div className="h-2.5 w-48 bg-gray-100 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : runs.length === 0 ? (
          <div className="text-center py-16">
            <div className="flex justify-center mb-4"><Activity className="w-10 h-10 text-gray-300" strokeWidth={1.5} /></div>
            <p className="text-lg font-semibold text-gray-900 mb-2">No runs yet</p>
            <p className="text-sm text-gray-400 mb-6">Start your first run to begin claiming territories</p>
            <button
              onClick={() => navigate('/run')}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-teal-600
                         text-sm font-bold text-black shadow-[0_4px_16px_rgba(0,180,198,0.15)]"
            >
              Start Running
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedRuns.map((group, gi) => (
              <div key={group.date}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {formatDate(new Date(group.date).getTime())}
                  </span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                <div className="space-y-2">
                  {group.runs.map((run, ri) => (
                    <motion.div
                      key={run.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: gi * 0.05 + ri * 0.03 }}
                      onClick={() => {
                        // Parse "m:ss" pace string → decimal minutes per km
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
                              isActive: false,
                              isPaused: false,
                              route: run.gpsPoints.map(p => ({ lat: p.lat, lng: p.lng })),
                              actionType: 'claim',
                              success: true,
                              xpEarned: run.xpEarned,
                              coinsEarned: run.coinsEarned,
                              diamondsEarned: run.diamondsEarned,
                              enemyCaptured: run.enemyCaptured,
                            },
                          },
                        });
                      }}
                      className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100
                                 active:scale-[0.98] transition cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center">
                          {activityIcons[run.activityType] || <Activity className="w-5 h-5 text-teal-600" strokeWidth={2} />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-gray-900 capitalize">{run.activityType}</span>
                            <span className="text-[10px] text-gray-400">{formatTimeOfDay(run.startTime)}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span className="text-stat">{(run.distanceMeters / 1000).toFixed(2)} km</span>
                            <span className="text-gray-300">&middot;</span>
                            <span className="text-stat">{formatTime(run.durationSec)}</span>
                            <span className="text-gray-300">&middot;</span>
                            <span className="text-stat">{run.avgPace}/km</span>
                          </div>
                        </div>

                        {run.territoriesClaimed.length > 0 && (
                          <div className="flex flex-col items-center shrink-0">
                            <span className="text-stat text-lg font-bold text-teal-600">{run.territoriesClaimed.length}</span>
                            <span className="text-[9px] text-gray-400 uppercase tracking-wider">zones</span>
                          </div>
                        )}

                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(209,213,219,1)" strokeWidth="2">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
