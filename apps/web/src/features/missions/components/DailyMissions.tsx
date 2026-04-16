import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getTodaysMissions, claimMissionReward } from '@features/missions/services/missionStore';
import { getPlayer, savePlayer } from '@shared/services/store';
import { Mission } from '@features/missions/services/missions';
import { haptic } from '@shared/lib/haptics';

export function DailyMissions() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  useEffect(() => {
    loadMissions();
  }, []);

  const loadMissions = async () => {
    setLoading(true);
    const m = await getTodaysMissions();
    setMissions(m);
    setLoading(false);
  };

  const handleClaim = async (mission: Mission) => {
    if (!mission.completed || mission.claimed) return;

    setClaimingId(mission.id);
    haptic('success');

    const claimed = await claimMissionReward(mission.id);
    if (claimed) {
      const player = await getPlayer();
      if (player) {
        const updated = {
          ...player,
          xp: player.xp + claimed.rewards.xp,
          coins: player.coins + claimed.rewards.coins,
        };
        await savePlayer(updated);
      }

      setMissions(prev =>
        prev.map(m => (m.id === mission.id ? { ...m, claimed: true } : m))
      );
    }

    setTimeout(() => setClaimingId(null), 500);
  };

  const getTimeRemaining = () => {
    if (missions.length === 0) return '';
    const remaining = missions[0].expiresAt - Date.now();
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const difficultyColors = {
    easy: 'bg-green-50 text-green-600 border-green-200',
    medium: 'bg-amber-50 text-amber-600 border-amber-200',
    hard: 'bg-red-50 text-red-600 border-red-200',
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-2xl p-4 animate-pulse border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gray-100" />
              <div className="flex-1">
                <div className="h-3.5 w-32 bg-gray-100 rounded mb-2" />
                <div className="h-2.5 w-48 bg-gray-100 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-gray-900">Daily Missions</h3>
          <p className="text-xs text-gray-400 mt-0.5">Resets in {getTimeRemaining()}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-stat text-sm font-bold text-[#D93518]">
            {missions.filter(m => m.completed).length}
          </span>
          <span className="text-xs text-gray-300">/</span>
          <span className="text-stat text-sm text-gray-500">{missions.length}</span>
        </div>
      </div>

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {missions.map((mission, index) => (
            <motion.div
              key={mission.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className={`bg-white rounded-2xl p-4 border transition-all shadow-sm ${
                mission.claimed
                  ? 'border-gray-100 opacity-50'
                  : mission.completed
                  ? 'border-[#FEF0EE] shadow-[0_2px_12px_rgba(217,53,24,0.08)]'
                  : 'border-gray-100'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ${
                  mission.completed ? 'bg-[#FEF0EE]' : 'bg-gray-50'
                }`}>
                  {mission.claimed ? '\u2705' : mission.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-gray-900 truncate">{mission.title}</span>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${difficultyColors[mission.difficulty]}`}>
                      {mission.difficulty}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">{mission.description}</p>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${mission.completed ? 'bg-[#D93518]' : 'bg-gray-300'}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (mission.current / mission.target) * 100)}%` }}
                        transition={{ duration: 0.8, delay: index * 0.1 }}
                      />
                    </div>
                    <span className="text-stat text-[11px] text-gray-400 shrink-0">
                      {mission.type === 'run_distance' || mission.type === 'run_in_enemy_zone'
                        ? `${mission.current.toFixed(1)}/${mission.target}`
                        : `${Math.floor(mission.current)}/${mission.target}`}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 ml-1">
                  {mission.completed && !mission.claimed ? (
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={() => handleClaim(mission)}
                      disabled={claimingId === mission.id}
                      className="px-3 py-2 rounded-xl bg-gradient-to-r from-[#D93518] to-[#B82D14]
                                 text-xs font-bold text-white
                                 shadow-[0_2px_12px_rgba(217,53,24,0.2)]
                                 disabled:opacity-50"
                    >
                      Claim
                    </motion.button>
                  ) : mission.claimed ? (
                    <span className="text-xs text-gray-300">Claimed</span>
                  ) : (
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-stat text-[11px] text-[#D93518]">+{mission.rewards.xp} XP</span>
                      <span className="text-stat text-[11px] text-amber-500">+{mission.rewards.coins} coins</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {missions.length > 0 && missions.every(m => m.completed) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-[#FEF0EE] to-[#F0EBF5]
                     border border-[#FEF0EE] text-center"
        >
          <p className="text-sm font-semibold text-gray-900">All missions complete!</p>
          <p className="text-xs text-gray-400 mt-1">Come back tomorrow for new challenges</p>
        </motion.div>
      )}
    </div>
  );
}
