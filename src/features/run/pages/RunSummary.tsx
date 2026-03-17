import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Flag, Swords, Gem, X, Bookmark, Share2, Flame, UtensilsCrossed } from 'lucide-react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { SaveRouteModal } from '@features/run/components/SaveRouteModal'
import { usePlayerStats } from '@features/profile/hooks/usePlayerStats'
import { ShareCardGenerator } from '@shared/ui/ShareCardGenerator'
import type { LiveRunData, Location } from '@shared/types/index'
import { getProfile } from '@shared/services/profile'
import { getNutritionProfile, addNutritionEntry } from '@shared/services/store'
import { calcRunCalories } from '@features/nutrition/services/nutritionService'
import { useTheme } from '@shared/hooks/useTheme'

// ─── Design tokens ───────────────────────────────────────────────────────────
const T = {
  pageBg:  '#EDEAE5',
  stone:   '#F0EDE8',
  mid:     '#E8E4DF',
  border:  '#DDD9D4',
  surface: '#FFFFFF',
  black:   '#0A0A0A',
  t2:      '#6B6560',
  t3:      '#A39E98',
  red:     '#E8435A',
}

// ─── Formatters ──────────────────────────────────────────────────────────────
const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}
const formatPace = (paceMinutesPerKm: number): string => {
  const m = Math.floor(paceMinutesPerKm)
  const s = Math.floor((paceMinutesPerKm - m) * 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ─── Splits computation ───────────────────────────────────────────────────────
function haversineDist(a: [number, number], b: [number, number]): number {
  const R = 6371
  const dLat = ((b[1] - a[1]) * Math.PI) / 180
  const dLng = ((b[0] - a[0]) * Math.PI) / 180
  const lat1 = (a[1] * Math.PI) / 180
  const lat2 = (b[1] * Math.PI) / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

interface Split { km: number; pace: number }

function computeSplits(coords: [number, number][], totalDuration: number): Split[] {
  if (coords.length < 2) return []
  // assign proportional timestamps
  let cumDist = 0
  const pts: { coord: [number, number]; dist: number }[] = [{ coord: coords[0], dist: 0 }]
  for (let i = 1; i < coords.length; i++) {
    cumDist += haversineDist(coords[i - 1], coords[i])
    pts.push({ coord: coords[i], dist: cumDist })
  }
  const totalDist = cumDist
  if (totalDist < 0.1) return []

  const splits: Split[] = []
  let prevDist = 0
  let prevTime = 0
  let km = 1
  for (let i = 1; i < pts.length; i++) {
    const d = pts[i].dist
    while (d >= km && km <= Math.floor(totalDist) + 1) {
      const frac = (km - prevDist) / (d - prevDist)
      const t = prevTime + frac * ((pts[i].dist / totalDist) * totalDuration - prevTime)
      const segTime = t - prevTime
      const pace = segTime / 60 // min/km for exactly 1 km
      splits.push({ km, pace })
      prevDist = km
      prevTime = t
      km++
    }
    prevTime = (pts[i].dist / totalDist) * totalDuration
  }
  return splits.slice(0, Math.min(splits.length, 20))
}

const MAP_STYLE_LIGHT = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
const MAP_STYLE_DARK  = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

export const RunSummary: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { player, levelTitle, xpProgress } = usePlayerStats()
  const { dark } = useTheme()
  const [showShare, setShowShare] = useState(false)
  const [showSaveRoute, setShowSaveRoute] = useState(false)
  const [weightKg, setWeightKg] = useState(70)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    getProfile().then(p => { if (p?.weightKg) setWeightKg(p.weightKg) })
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
      style: dark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT,
      center,
      zoom: 15,
      interactive: false,
      attributionControl: false,
    })

    setTimeout(() => map.resize(), 0)
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
          paint: { 'line-color': 'rgba(232,67,90,0.2)', 'line-width': 14, 'line-blur': 10 },
        })
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          paint: { 'line-color': '#E8435A', 'line-width': 4, 'line-opacity': 0.95 },
          layout: { 'line-cap': 'round', 'line-join': 'round' },
        })
        const startEl = document.createElement('div')
        startEl.style.cssText = 'width:10px;height:10px;background:#10B981;border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(16,185,129,0.5)'
        new maplibregl.Marker({ element: startEl }).setLngLat(routeCoords[0]).addTo(map)
        const endEl = document.createElement('div')
        endEl.style.cssText = 'width:12px;height:12px;background:#E8435A;border:2px solid white;border-radius:50%;box-shadow:0 1px 6px rgba(232,67,90,0.6)'
        new maplibregl.Marker({ element: endEl }).setLngLat(routeCoords[routeCoords.length - 1]).addTo(map)
      } else {
        const endEl = document.createElement('div')
        endEl.style.cssText = 'width:14px;height:14px;background:#E8435A;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(232,67,90,0.5)'
        new maplibregl.Marker({ element: endEl }).setLngLat(center).addTo(map)
      }
    })

    mapRef.current = map
    return () => { ro.disconnect(); map.remove(); mapRef.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!mapRef.current) return
    mapRef.current.setStyle(dark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT)
  }, [dark])

  const calories = calcRunCalories((runData.distance * 1000), weightKg)

  // Auto-log run burn to nutrition if profile exists
  useEffect(() => {
    const runId = location.state?.runId as string | undefined
    if (!runId || !runData.success || runData.distance <= 0) return
    const today = new Date().toISOString().slice(0, 10)
    getNutritionProfile().then(prof => {
      if (!prof) return
      const burnKcal = calcRunCalories(runData.distance * 1000, prof.weightKg)
      addNutritionEntry({
        date: today,
        meal: 'snacks',
        name: 'Run burn',
        kcal: -burnKcal,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        servingSize: `${runData.distance.toFixed(2)} km`,
        source: 'run',
        runId,
        xpAwarded: false,
        loggedAt: Date.now(),
      }).catch(() => {/* silent */})
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rewards = {
    xp:       runData.xpEarned  ?? 0,
    coins:    runData.coinsEarned   ?? 0,
    diamonds: runData.diamondsEarned ?? 0,
  }

  const getHeading = () => {
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

  // Splits
  const splits = useMemo(() => computeSplits(routeCoords, runData.duration), [routeCoords, runData.duration])
  const avgSplitPace = splits.length > 0 ? splits.reduce((s, x) => s + x.pace, 0) / splits.length : runData.pace
  const maxSplitPace = splits.length > 0 ? Math.max(...splits.map(s => s.pace)) : runData.pace + 1
  const minSplitPace = splits.length > 0 ? Math.min(...splits.map(s => s.pace)) : Math.max(0, runData.pace - 1)

  const splitBarColor = (pace: number) => {
    if (pace <= avgSplitPace - 0.2) return '#10B981'
    if (pace >= avgSplitPace + 0.2) return T.red
    return '#F59E0B'
  }

  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  // ─── Fade-up animation factory ─────────────────────────────────────────────
  const fadeUp = (delay: number) => ({
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.38, delay, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
  })

  return (
    <div style={{ minHeight: '100vh', background: T.pageBg, paddingBottom: 40 }}>

      {/* ── Map ────────────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', height: 200, overflow: 'hidden', background: T.mid }}>
        <div ref={mapContainerRef} style={{ position: 'absolute', inset: 0 }} />
        {/* bottom fade */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(to bottom, transparent 55%, ${T.pageBg})`,
          pointerEvents: 'none',
        }} />
        <button
          onClick={() => navigate('/home')}
          style={{
            position: 'absolute', top: 16, right: 16, zIndex: 10,
            width: 30, height: 30, borderRadius: '50%',
            background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(6px)',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 1px 6px rgba(0,0,0,0.12)',
          }}
        >
          <X size={14} strokeWidth={2.5} color={T.black} />
        </button>
      </div>

      {/* ── Scrollable content ─────────────────────────────────────────────── */}
      <div style={{ padding: '0 16px', marginTop: -8, position: 'relative', zIndex: 10 }}>

        {/* ── Title area ───────────────────────────────────────────────────── */}
        <motion.div {...fadeUp(0.10)} style={{ marginBottom: 20 }}>
          <div style={{
            display: 'inline-block',
            fontSize: 10, fontWeight: 600, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: T.t3,
            marginBottom: 4,
          }}>
            {runData.actionType === 'attack' ? 'Attack Run' :
             runData.actionType === 'defend' ? 'Defence Run' :
             runData.actionType === 'fortify' ? 'Fortify Run' : 'Training Run'}
          </div>
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontStyle: 'italic', fontWeight: 400,
            fontSize: 28, lineHeight: 1.15,
            color: runData.success ? T.black : T.red,
            margin: '0 0 6px',
          }}>
            {getHeading()}
          </h1>
          <div style={{ fontSize: 12, color: T.t3, fontFamily: "'Barlow', sans-serif", fontWeight: 300 }}>
            {dateLabel}
          </div>
        </motion.div>

        {/* ── Primary stats — 3-col 1px gap grid ───────────────────────────── */}
        <motion.div {...fadeUp(0.18)} style={{ marginBottom: 16 }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            gap: 1, background: T.mid, borderRadius: 4, overflow: 'hidden',
          }}>
            {[
              { label: 'Distance', value: runData.distance.toFixed(2), unit: 'km' },
              { label: 'Time',     value: formatTime(runData.duration), unit: '' },
              { label: 'Avg Pace', value: formatPace(runData.pace),     unit: '/km' },
            ].map(({ label, value, unit }) => (
              <div key={label} style={{
                background: T.surface, padding: '14px 12px 12px',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
              }}>
                <div style={{
                  fontFamily: "'Barlow', sans-serif", fontWeight: 300,
                  fontSize: 24, letterSpacing: '-0.02em', color: T.black,
                  lineHeight: 1,
                }}>
                  {value}
                  {unit && <span style={{ fontSize: 11, fontWeight: 400, color: T.t3, marginLeft: 2 }}>{unit}</span>}
                </div>
                <div style={{ fontSize: 10, color: T.t3, marginTop: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Territory results — 2×2 grid ─────────────────────────────────── */}
        <motion.div {...fadeUp(0.26)} style={{ marginBottom: 16 }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: 1, background: T.mid, borderRadius: 4, overflow: 'hidden',
          }}>
            {[
              {
                icon: <Flag size={15} strokeWidth={2} color={T.red} />,
                iconBg: 'rgba(232,67,90,0.08)',
                label: 'Territories Claimed',
                value: runData.success ? (runData.territoriesClaimed || 0) : 0,
                valueColor: T.red,
              },
              {
                icon: <Swords size={15} strokeWidth={2} color="#8B5CF6" />,
                iconBg: 'rgba(139,92,246,0.08)',
                label: 'Enemy Captured',
                value: runData.enemyCaptured ?? 0,
                valueColor: '#8B5CF6',
              },
              {
                icon: <span style={{ fontSize: 14, lineHeight: 1 }}>🔥</span>,
                iconBg: 'rgba(249,115,22,0.08)',
                label: 'Day Streak',
                value: `${streakDisplay}d`,
                valueColor: '#F97316',
              },
              {
                icon: <span style={{ fontSize: 14, lineHeight: 1 }}>🔥</span>,
                iconBg: 'rgba(16,185,129,0.08)',
                label: 'Calories',
                value: `${calories}`,
                valueColor: '#10B981',
              },
            ].map(({ icon, iconBg, label, value, valueColor }) => (
              <div key={label} style={{
                background: T.surface, padding: '14px 14px 12px',
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 6,
                  background: iconBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {icon}
                </div>
                <div>
                  <div style={{
                    fontFamily: "'Barlow', sans-serif", fontWeight: 300,
                    fontSize: 22, letterSpacing: '-0.02em', color: valueColor, lineHeight: 1,
                  }}>
                    {value}
                  </div>
                  <div style={{ fontSize: 10, color: T.t3, marginTop: 3, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    {label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Splits table ─────────────────────────────────────────────────── */}
        {splits.length > 0 && (
          <motion.div {...fadeUp(0.34)} style={{ marginBottom: 16 }}>
            <div style={{ background: T.surface, borderRadius: 4, overflow: 'hidden' }}>
              {/* header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '32px 1fr 56px',
                gap: 8, padding: '10px 14px 8px',
                borderBottom: `1px solid ${T.mid}`,
              }}>
                {['KM', 'PACE BAR', 'PACE'].map(h => (
                  <div key={h} style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', color: T.t3, textTransform: 'uppercase' }}>{h}</div>
                ))}
              </div>
              {/* rows */}
              {splits.map((s, i) => {
                const barColor = splitBarColor(s.pace)
                const paceRange = maxSplitPace - minSplitPace || 1
                // slower pace = longer bar width (inverted)
                const barWidth = 20 + ((s.pace - minSplitPace) / paceRange) * 80
                return (
                  <div
                    key={i}
                    style={{
                      display: 'grid', gridTemplateColumns: '32px 1fr 56px',
                      gap: 8, padding: '9px 14px',
                      borderBottom: i < splits.length - 1 ? `1px solid ${T.mid}` : 'none',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 500, color: T.t2 }}>{s.km}</div>
                    <div style={{ height: 6, borderRadius: 3, background: T.mid, overflow: 'hidden' }}>
                      <div style={{
                        width: `${barWidth}%`, height: '100%',
                        background: barColor, borderRadius: 3,
                        transition: 'width 0.6s ease',
                      }} />
                    </div>
                    <div style={{
                      fontFamily: "'Barlow', sans-serif", fontWeight: 300,
                      fontSize: 13, color: barColor, textAlign: 'right',
                    }}>
                      {formatPace(s.pace)}<span style={{ fontSize: 10, color: T.t3 }}>/km</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* ── Rewards card (only on success) ───────────────────────────────── */}
        {runData.success && (
          <motion.div {...fadeUp(0.42)} style={{ marginBottom: 16 }}>
            <div style={{ background: T.black, borderRadius: 4, padding: '20px 16px', color: T.surface }}>

              {/* Level-up banner */}
              {runData.leveledUp && (
                <div style={{
                  background: 'rgba(232,67,90,0.15)',
                  border: '1px solid rgba(232,67,90,0.3)',
                  borderRadius: 3,
                  padding: '10px 14px',
                  marginBottom: 16,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ fontSize: 20 }}>🎉</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.red }}>Level Up!</div>
                    <div style={{ fontSize: 11, color: 'rgba(232,67,90,0.7)', marginTop: 1 }}>
                      Lv {runData.preRunLevel} → Lv {runData.newLevel}
                    </div>
                  </div>
                </div>
              )}

              {/* XP row */}
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>
                  XP Earned
                </div>
                <div style={{ fontFamily: "'Barlow', sans-serif", fontWeight: 300, fontSize: 22, color: T.red, letterSpacing: '-0.01em' }}>
                  +{rewards.xp} <span style={{ fontSize: 12, color: 'rgba(232,67,90,0.7)' }}>XP</span>
                </div>
              </div>

              {/* XP progress bar */}
              <div style={{ position: 'relative', height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden', marginBottom: 6 }}>
                <motion.div
                  initial={{ width: `${xpPrevPercent}%` }}
                  animate={{ width: `${xpNewPercent}%` }}
                  transition={{ duration: 1.4, delay: 0.5, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
                  style={{ position: 'absolute', left: 0, top: 0, height: '100%', background: T.red, borderRadius: 2 }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 16 }}>
                <span>Lv {player?.level ?? 1}</span>
                <span>{xpProgress.progress} / {xpProgress.needed} XP</span>
                <span>Lv {(player?.level ?? 1) + 1}</span>
              </div>

              {/* Reward rows — 1px gap */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 16 }}>
                {rewards.coins > 0 && (
                  <div style={{ background: '#111', padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 15 }}>🪙</span>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Coins earned</span>
                    </div>
                    <span style={{ fontFamily: "'Barlow', sans-serif", fontWeight: 300, fontSize: 16, color: '#F59E0B' }}>
                      +{rewards.coins}
                    </span>
                  </div>
                )}
                {rewards.diamonds > 0 && (
                  <div style={{ background: '#111', padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Gem size={14} strokeWidth={2} color="#8B5CF6" />
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Diamonds earned</span>
                    </div>
                    <span style={{ fontFamily: "'Barlow', sans-serif", fontWeight: 300, fontSize: 16, color: '#8B5CF6' }}>
                      +{rewards.diamonds}
                    </span>
                  </div>
                )}
              </div>

              {/* Completed missions */}
              {(runData.completedMissions?.length ?? 0) > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>
                    Missions Completed
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                    {runData.completedMissions!.map(m => (
                      <div key={m.id} style={{ background: '#111', padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 16, height: 16, borderRadius: '50%',
                            background: 'rgba(16,185,129,0.15)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <span style={{ fontSize: 9, color: '#10B981' }}>✓</span>
                          </div>
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{m.title}</span>
                        </div>
                        {(m.diamondReward ?? 0) > 0 && (
                          <span style={{ fontSize: 11, color: '#8B5CF6', fontWeight: 500 }}>
                            +{m.diamondReward} 💎
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Fuel recovery card ───────────────────────────────────────────── */}
        <motion.div {...fadeUp(0.46)} style={{ marginBottom: 16 }}>
          <div style={{
            background: 'rgba(249,115,22,0.06)', border: '0.5px solid rgba(249,115,22,0.2)',
            borderRadius: 10, padding: '14px 16px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(249,115,22,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Flame size={16} color="#F97316" strokeWidth={1.5} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: T.black, fontFamily: "'Barlow', sans-serif" }}>
                Fuel your recovery
              </div>
              <div style={{ fontSize: 11, fontWeight: 300, color: T.t3, fontFamily: "'Barlow', sans-serif", marginTop: 1 }}>
                You burned {calories} kcal — log a meal now
              </div>
            </div>
            <button
              onClick={() => navigate('/calories')}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '6px 12px', borderRadius: 20,
                background: T.black, border: 'none', cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <UtensilsCrossed size={11} color="#fff" strokeWidth={1.5} />
              <span style={{ fontSize: 10, fontWeight: 600, color: '#fff', letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: "'Barlow', sans-serif" }}>
                Log meal
              </span>
            </button>
          </div>
        </motion.div>

        {/* ── Action buttons ───────────────────────────────────────────────── */}
        <motion.div {...fadeUp(0.50)} style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <button
            onClick={() => navigate('/home')}
            style={{
              flex: 1, padding: '14px 0', borderRadius: 3,
              background: T.black, color: T.surface,
              border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, letterSpacing: '0.03em',
            }}
          >
            Done
          </button>
          {routeCoords.length >= 2 && (
            <button
              onClick={() => setShowSaveRoute(true)}
              style={{
                flex: 1, padding: '14px 0', borderRadius: 3,
                background: T.stone, color: T.black,
                border: `1px solid ${T.border}`, cursor: 'pointer',
                fontSize: 13, fontWeight: 500,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <Bookmark size={14} strokeWidth={2} />
              Save Route
            </button>
          )}
          <button
            onClick={() => setShowShare(true)}
            style={{
              flex: 1, padding: '14px 0', borderRadius: 3,
              background: T.stone, color: T.black,
              border: `1px solid ${T.border}`, cursor: 'pointer',
              fontSize: 13, fontWeight: 500,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <Share2 size={14} strokeWidth={2} />
            Share
          </button>
        </motion.div>

      </div>

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
      <SaveRouteModal
        isOpen={showSaveRoute}
        onClose={() => setShowSaveRoute(false)}
        gpsPoints={(runData.route ?? []).map((p: Location) => ({ lat: p.lat, lng: p.lng }))}
        distanceM={runData.distance * 1000}
        durationSec={runData.duration}
        sourceRunId={location.state?.runId ?? null}
      />

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

export default RunSummary
