import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Flag, Swords, Flame, Gem, Activity, X } from 'lucide-react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { StatCard } from '@shared/ui/StatCard'

const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};
const formatPace = (paceMinutesPerKm: number): string => {
  const minutes = Math.floor(paceMinutesPerKm);
  const secs = Math.floor((paceMinutesPerKm - minutes) * 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};
import { usePlayerStats } from '@features/profile/hooks/usePlayerStats'
import { ShareCardGenerator } from '@shared/ui/ShareCardGenerator'
import SplitsTable from '@shared/ui/SplitsTable'
import type { LiveRunData, Location } from '@shared/types/index'
import { getProfile } from '@shared/services/profile'

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
  const { player, levelTitle, xpProgress } = usePlayerStats()
  const [showShare, setShowShare] = useState(false)
  const [weightKg, setWeightKg] = useState(70)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    getProfile().then(p => { if (p?.weightKg) setWeightKg(p.weightKg); });
  }, [])

  const runData: LiveRunData & {
    route?: Location[]
    finalStats?: Record<string, unknown>
    actionType?: string
    success?: boolean
    xpEarned?: number
    coinsEarned?: number
    diamondsEarned?: number
    enemyCaptured?: number
    leveledUp?: boolean
    preRunLevel?: number
    newLevel?: number
    newStreak?: number
    completedMissions?: { id: string; title: string; diamondReward?: number }[]
  } = location.state?.runData || {
    distance: 0,
    duration: 0,
    pace: 0,
    territoriesClaimed: 0,
    currentLocation: { lat: 0, lng: 0 },
    isActive: false,
    isPaused: false,
    route: [],
    actionType: 'claim',
    success: false,
  }

  const routeCoords: [number, number][] = (runData.route ?? []).map(
    (p: Location) => [p.lng, p.lat]
  )

  // Fit map bounds to the route; fall back to run end location
  const routeBounds: [[number, number], [number, number]] | null = routeCoords.length >= 2
    ? [
        [Math.min(...routeCoords.map(c => c[0])), Math.min(...routeCoords.map(c => c[1]))],
        [Math.max(...routeCoords.map(c => c[0])), Math.max(...routeCoords.map(c => c[1]))],
      ]
    : null

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const center: [number, number] = routeCoords.length > 0
      ? routeCoords[Math.floor(routeCoords.length / 2)]
      : [runData.currentLocation.lng, runData.currentLocation.lat]

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center,
      zoom: 15,
      interactive: false,
      attributionControl: false,
    })

    // Force correct dimensions after the map is mounted into the DOM
    setTimeout(() => map.resize(), 0)

    // Re-resize if layout shifts (e.g. safe-area, bottom sheet)
    const ro = new ResizeObserver(() => map.resize())
    ro.observe(mapContainerRef.current)

    map.on('load', () => {
      map.resize()

      if (routeCoords.length >= 2) {
        map.fitBounds(routeBounds!, { padding: 48, duration: 0, maxZoom: 17 })

        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: routeCoords },
          },
        })
        map.addLayer({
          id: 'route-glow',
          type: 'line',
          source: 'route',
          paint: { 'line-color': 'rgba(0,180,198,0.2)', 'line-width': 14, 'line-blur': 10 },
        })
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          paint: { 'line-color': '#00B4C6', 'line-width': 4, 'line-opacity': 0.95 },
          layout: { 'line-cap': 'round', 'line-join': 'round' },
        })

        // Start marker (green dot)
        const startEl = document.createElement('div')
        startEl.style.cssText = 'width:10px;height:10px;background:#10B981;border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(16,185,129,0.5)'
        new maplibregl.Marker({ element: startEl }).setLngLat(routeCoords[0]).addTo(map)

        // End marker (teal dot)
        const endEl = document.createElement('div')
        endEl.style.cssText = 'width:12px;height:12px;background:#00B4C6;border:2px solid white;border-radius:50%;box-shadow:0 1px 6px rgba(0,180,198,0.6)'
        new maplibregl.Marker({ element: endEl }).setLngLat(routeCoords[routeCoords.length - 1]).addTo(map)
      } else {
        // Fewer than 2 GPS points — just pin the end location
        const endEl = document.createElement('div')
        endEl.style.cssText = 'width:14px;height:14px;background:#00B4C6;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,180,198,0.5)'
        new maplibregl.Marker({ element: endEl }).setLngLat(center).addTo(map)
      }
    })

    mapRef.current = map
    return () => { ro.disconnect(); map.remove(); mapRef.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

// MET(8) × weightKg × durationHours — weightKg loaded from profile biometrics
const calories = Math.round(8 * weightKg * (runData.duration / 3600))

  const rewards = {
    xp: runData.xpEarned ?? 0,
    coins: runData.coinsEarned ?? 0,
    diamonds: runData.diamondsEarned ?? 0,
  }

  const getActionTitle = () => {
    if (!runData.success) return `${runData.actionType || 'Action'} Failed`
    switch (runData.actionType) {
      case 'attack':  return 'Territory Conquered'
      case 'defend':  return 'Territory Defended'
      case 'fortify': return 'Territory Fortified'
      default:        return 'Run Complete'
    }
  }

  const xpNewPercent  = xpProgress.percent
  const xpPrevPercent = Math.max(0, xpNewPercent - (rewards.xp / Math.max(xpProgress.needed, 1)) * 100)

  const streakDisplay = runData.newStreak ?? player?.streakDays ?? 0
  const territoryRows = [
    { icon: <Flag className="w-5 h-5 text-teal-600" strokeWidth={2} />, label: 'Territories Claimed',  value: runData.success ? (runData.territoriesClaimed || 0) : 0 },
    { icon: <Swords className="w-5 h-5 text-pink-500" strokeWidth={2} />, label: 'Enemy Zones Captured', value: runData.enemyCaptured ?? 0 },
    { icon: <Flame className="w-5 h-5 text-orange-500" strokeWidth={2} />, label: 'Daily Streak',          value: `${streakDisplay} days` },
    { icon: <Activity className="w-5 h-5 text-emerald-500" strokeWidth={2} />, label: 'Calories Burned',       value: calories },
  ]

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0A0A] pb-32">
      <div className="relative h-[35vh] overflow-hidden bg-gray-100">
        <div ref={mapContainerRef} className="absolute inset-0" />
        {/* fade into the content below */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#FAFAFA] dark:to-[#0A0A0A] pointer-events-none" />
        <button
          onClick={() => navigate('/home')}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 backdrop-blur shadow-md flex items-center justify-center text-gray-500 hover:text-gray-700 z-10"
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
            <div className="gradient-border p-5 space-y-4">
              {/* Level-up banner */}
              {runData.leveledUp && (
                <div className="flex items-center gap-3 bg-teal-50 rounded-xl px-4 py-3">
                  <span className="text-2xl">🎉</span>
                  <div>
                    <p className="text-sm font-bold text-teal-700">Level Up!</p>
                    <p className="text-xs text-teal-600">
                      Lv {runData.preRunLevel} → Lv {runData.newLevel}
                    </p>
                  </div>
                </div>
              )}

              {/* XP row */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">XP Earned</span>
                <span className="text-stat text-xl font-bold text-teal-600">+{rewards.xp} XP</span>
              </div>
              <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: `${xpPrevPercent}%` }}
                  animate={{ width: `${xpNewPercent}%` }}
                  transition={{ duration: 1.4, delay: 0.5, ease: [0.4, 0, 0.2, 1] }}
                  className="absolute left-0 top-0 h-full bg-gradient-to-r from-teal-500 to-teal-400 rounded-full"
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>Lv {player?.level ?? 1}</span>
                <span>{xpProgress.progress} / {xpProgress.needed} XP</span>
                <span>Lv {(player?.level ?? 1) + 1}</span>
              </div>

              {/* Coins row */}
              {rewards.coins > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="w-4 h-4 text-amber-500 font-bold text-base leading-none">🪙</span>
                  <span>+{rewards.coins} coins earned</span>
                </div>
              )}

              {/* Diamonds row */}
              {rewards.diamonds > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Gem className="w-4 h-4 text-purple-500" strokeWidth={2} />
                  <span>+{rewards.diamonds} diamonds earned</span>
                </div>
              )}

              {/* Completed missions */}
              {(runData.completedMissions?.length ?? 0) > 0 && (
                <div className="pt-1 border-t border-gray-100">
                  <p className="text-xs text-gray-400 mb-1.5">Missions Completed</p>
                  {runData.completedMissions!.map(m => (
                    <div key={m.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">✓ {m.title}</span>
                      {(m.diamondReward ?? 0) > 0 && (
                        <span className="text-purple-500 font-medium text-xs">+{m.diamondReward} 💎</span>
                      )}
                    </div>
                  ))}
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
