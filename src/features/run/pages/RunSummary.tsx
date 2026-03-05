import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Flag, Swords, Flame, Gem, Activity, X } from 'lucide-react'
import { StatCard } from '@shared/ui/StatCard'
import { formatTime, formatPace, generateMockTerritories } from '@shared/data/mockData'
import { useGameState } from '@shared/hooks/useGameState'
import { usePlayerStats } from '@features/profile/hooks/usePlayerStats'
import { ShareCardGenerator } from '@shared/ui/ShareCardGenerator'
import SplitsTable from '@shared/ui/SplitsTable'
import type { LiveRunData, Location } from '@shared/types/index'

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.09 } },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: { ease: [0.4, 0, 0.2, 1] as [number, number, number, number] } },
}

export const RunSummary: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { playerStats } = useGameState()
  const { player, levelTitle } = usePlayerStats()
  const [showShare, setShowShare] = useState(false)

  const runData: LiveRunData & {
    route?: Location[]
    finalStats?: Record<string, unknown>
    actionType?: string
    success?: boolean
  } = location.state?.runData || {
    distance: 2.1,
    duration: 754,
    pace: 5.97,
    territoriesClaimed: 3,
    currentLocation: { lat: 28.6139, lng: 77.2090 },
    isActive: false,
    isPaused: false,
    route: [],
    actionType: 'claim',
    success: true,
  }

  void generateMockTerritories(50) // legacy - territories count from run data
  const calories = Math.round(runData.distance * 88)

  const calculateRewards = () => {
    if (!runData.success) return { xp: 0, coins: 0, gems: 0 }
    const base = {
      xp:    runData.actionType === 'attack' ? 75 : runData.actionType === 'claim' ? 50 : 25,
      coins: runData.actionType === 'attack' ? 40 : runData.actionType === 'claim' ? 25 : 15,
      gems:  runData.actionType === 'attack' ? 5 : 0,
    }
    const distBonus = Math.floor(runData.distance * 5)
    return { xp: base.xp + distBonus, coins: base.coins + distBonus, gems: base.gems }
  }

  const rewards = calculateRewards()

  const getActionTitle = () => {
    if (!runData.success) return `${runData.actionType || 'Action'} Failed`
    switch (runData.actionType) {
      case 'attack':  return 'Territory Conquered'
      case 'defend':  return 'Territory Defended'
      case 'fortify': return 'Territory Fortified'
      default:        return 'Run Complete'
    }
  }

  const xpPrevPercent = 30
  const xpNewPercent  = Math.min(95, xpPrevPercent + Math.floor(rewards.xp / 35))

  const territoryRows = [
    { icon: <Flag className="w-5 h-5 text-teal-600" strokeWidth={2} />, label: 'Territories Claimed',  value: runData.success ? (runData.territoriesClaimed || 1) : 0 },
    { icon: <Swords className="w-5 h-5 text-pink-500" strokeWidth={2} />, label: 'Enemy Zones Captured', value: runData.actionType === 'attack' && runData.success ? 1 : 0 },
    { icon: <Flame className="w-5 h-5 text-orange-500" strokeWidth={2} />, label: 'Daily Streak',          value: `${playerStats.dailyStreak} days` },
    { icon: <Activity className="w-5 h-5 text-emerald-500" strokeWidth={2} />, label: 'Calories Burned',       value: calories },
  ]

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-32">
      <div className="relative h-[35vh] bg-gray-100 overflow-hidden">
      {/* Route map - pending implementation */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#FAFAFA]" />
        <button
          onClick={() => navigate('/home')}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 backdrop-blur shadow-md flex items-center justify-center text-gray-500 hover:text-gray-700"
        >
          <X className="w-5 h-5" strokeWidth={2} />
        </button>
      </div>

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="px-5 -mt-6 relative z-10 space-y-4"
      >
        <motion.div variants={item}>
          <h1 className="text-2xl font-bold text-gray-900 mb-1 font-display">
            {getActionTitle()}
          </h1>
          <p className="text-sm text-gray-400">
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </p>
        </motion.div>

        <motion.div variants={item} className="grid grid-cols-3 gap-2.5">
          <StatCard label="Distance" value={runData.distance.toFixed(2)} unit="km" glowColor="cyan" />
          <StatCard label="Duration" value={formatTime(runData.duration)} />
          <StatCard label="Avg Pace" value={formatPace(runData.pace)} unit="/km" />
        </motion.div>

        <motion.div variants={item}>
          <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400 font-medium mb-2.5 px-1">
            Territory Results
          </p>
          <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
            {territoryRows.map((row, i) => (
              <div
                key={i}
                className={`flex items-center gap-4 px-4 py-3.5 ${
                  i < territoryRows.length - 1 ? 'border-b border-gray-100' : ''
                }`}
              >
                <span className="w-7 flex justify-center">{row.icon}</span>
                <span className="flex-1 text-sm text-gray-500">{row.label}</span>
                <span className="text-stat text-base font-bold text-gray-900">{row.value}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Splits */}
        <motion.div variants={item}>
          <SplitsTable
            distance={runData.distance}
            duration={runData.duration}
            gpsPoints={runData.route?.map((p: Location) => ({
              lat: p.lat,
              lng: p.lng,
              timestamp: Date.now(),
              speed: 0,
              accuracy: 10,
            }))}
          />
        </motion.div>

        {runData.success && (
          <motion.div variants={item}>
            <div className="gradient-border p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-500">XP Earned</span>
                <span className="text-stat text-xl font-bold text-teal-600">+{rewards.xp} XP</span>
              </div>
              <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                <motion.div
                  initial={{ width: `${xpPrevPercent}%` }}
                  animate={{ width: `${xpNewPercent}%` }}
                  transition={{ duration: 1.4, delay: 0.5, ease: [0.4, 0, 0.2, 1] }}
                  className="absolute left-0 top-0 h-full bg-gradient-to-r from-teal-500 to-teal-400 rounded-full"
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>Lv {playerStats.level}</span>
                <span>{playerStats.xp} / {playerStats.xp + playerStats.xpToNext} XP</span>
                <span>Lv {playerStats.level + 1}</span>
              </div>

              {rewards.gems > 0 && (
                <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                  <Gem className="w-4 h-4 text-purple-500" strokeWidth={2} />
                  <span>+{rewards.gems} gems earned</span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        <motion.div variants={item} className="flex gap-3">
          <button
            onClick={() => navigate('/home')}
            className="flex-1 py-4 rounded-2xl bg-gray-50 border border-gray-200
                       text-sm font-medium text-gray-600 active:scale-[0.98] transition-transform"
          >
            Save Run
          </button>
          <button
            onClick={() => setShowShare(true)}
            className="flex-1 py-4 rounded-2xl
                       bg-gradient-to-r from-teal-500 to-teal-600
                       text-sm font-semibold text-white
                       active:scale-[0.98] transition-transform
                       shadow-[0_4px_16px_rgba(0,180,198,0.25)]"
          >
            Share Conquest
          </button>
        </motion.div>
      </motion.div>

      <ShareCardGenerator
        isOpen={showShare}
        onClose={() => setShowShare(false)}
        runData={{
          distance: runData.distance,
          duration: formatTime(runData.duration),
          pace: formatPace(runData.pace),
          territoriesClaimed: runData.territoriesClaimed || 0,
          xpEarned: rewards.xp,
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          timeOfDay: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          activityType: runData.actionType || 'run',
          playerName: player?.username || 'Runner',
          playerLevel: player?.level || 1,
          levelTitle: levelTitle,
          streakDays: player?.streakDays || 0,
          routePoints: runData.route?.map((p: Location) => ({ lat: p.lat, lng: p.lng })),
        }}
      />
    </div>
  )
}

export default RunSummary;
