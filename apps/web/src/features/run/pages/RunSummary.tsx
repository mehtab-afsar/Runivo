import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Flag, Swords, X, Bookmark, Share2, Flame, Sparkles, Utensils, ChevronDown } from 'lucide-react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { toPng } from 'html-to-image'
import { SaveRouteModal } from '@features/run/components/SaveRouteModal'
import { usePlayerStats } from '@features/profile/hooks/usePlayerStats'
import { ShareCardGenerator } from '@shared/ui/ShareCardGenerator'
import type { LiveRunData, Location } from '@shared/types/index'
import { getProfile } from '@shared/services/profile'
import { calcRunCalories } from '@features/nutrition/services/nutritionService'
import { addNutritionEntry, getDefaultShoe, getShoes, saveRun, getRunById, StoredShoe } from '@shared/services/store'
import { todayKey } from '@features/nutrition/services/nutritionService'
import { FoodSearch } from '@features/nutrition/components/FoodSearch'
import { uploadStory } from '@shared/services/storiesService'
import { useTheme } from '@/shared/hooks/useTheme'
import { usePostRunInsights } from '@features/intelligence/hooks/usePostRunInsights'
import { T as TBase } from '@shared/design-system/tokens'

// ─── Design tokens ───────────────────────────────────────────────────────────
const T = {
  ...TBase,
  pageBg:  '#EDEAE5',
  surface: '#FFFFFF',
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
  if (coords.length < 2 || totalDuration <= 0) return []
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
      const segDist = d - prevDist
      if (segDist === 0) { km++; continue }
      const frac = (km - prevDist) / segDist
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
  const [showShare, setShowShare]           = useState(false)
  const [showSaveRoute, setShowSaveRoute]   = useState(false)
  const [showPostRunFood, setShowPostRunFood] = useState(false)
  const [foodToast, setFoodToast]           = useState('')
  const [runShoe, setRunShoe]               = useState<StoredShoe | null>(null)
  const [allShoes, setAllShoes]             = useState<StoredShoe[]>([])
  const [showShoeDrawer, setShowShoeDrawer] = useState(false)
  const [shoeTotalKm, setShoeTotalKm]       = useState(0)
  const [weightKg, setWeightKg] = useState(70)
  const [_enrichedRun, setEnrichedRun] = useState<import('@shared/services/store').StoredRun | null>(null)
  const runId = (location.state?.runId as string | null | undefined) ?? ''
  const { insights: aiInsights, loading: aiLoading } = usePostRunInsights(runId)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const storyCardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getProfile().then(p => { if (p?.weightKg) setWeightKg(p.weightKg) })
    // Load shoes for the post-run shoe chip
    Promise.all([getDefaultShoe(), getShoes()]).then(([def, all]) => {
      setRunShoe(def ?? null)
      setAllShoes(all.filter(s => !s.isRetired))
    })
    // Load enriched run (for wearable HR/cadence/elevation if available)
    if (runId) getRunById(runId).then(r => setEnrichedRun(r ?? null))
  }, [])

  // Auto-upload story card 1500ms after mount (fire-and-forget)
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!storyCardRef.current) return
      try {
        const dataUrl = await toPng(storyCardRef.current, {
          cacheBust: true, pixelRatio: 2,
          width: 1080, height: 1920,
          style: { transform: 'scale(1)', transformOrigin: 'top left' },
        })
        await uploadStory(dataUrl, location.state?.runId ?? undefined)
      } catch {
        // Story upload is non-critical — ignore errors silently
      }
    }, 1500)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const runData: LiveRunData & {
    route?: Location[]
    finalStats?: Record<string, unknown>
    actionType?: string
    success?: boolean
    xpEarned?: number
    coinsEarned?: number
    bonusCoins?: number
    enemyCaptured?: number
    leveledUp?: boolean
    preRunLevel?: number
    newLevel?: number
    newStreak?: number
    completedMissions?: { id: string; title: string }[]
    startTime?: number
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
    const map = mapRef.current
    if (!map) return
    // Re-add route source/layers after style change (setStyle wipes user sources/layers)
    map.once('style.load', () => {
      if (routeCoords.length >= 2) {
        try {
          if (!map.getSource('route')) {
            map.addSource('route', {
              type: 'geojson',
              data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: routeCoords } },
            })
            map.addLayer({ id: 'route-glow', type: 'line', source: 'route', paint: { 'line-color': 'rgba(232,67,90,0.2)', 'line-width': 14, 'line-blur': 10 } })
            map.addLayer({ id: 'route-line', type: 'line', source: 'route', paint: { 'line-color': '#E8435A', 'line-width': 4, 'line-opacity': 0.95 }, layout: { 'line-cap': 'round', 'line-join': 'round' } })
          }
        } catch { /* already added */ }
      }
    })
    map.setStyle(dark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT)
  }, [dark]) // eslint-disable-line react-hooks/exhaustive-deps

  const calories = calcRunCalories((runData.distance * 1000), weightKg)


  const rewards = {
    xp:         runData.xpEarned    ?? 0,
    coins:      runData.coinsEarned ?? 0,
    bonusCoins: runData.bonusCoins  ?? 0,
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

  const dateLabel = new Date(runData.startTime ?? Date.now()).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

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
                {rewards.bonusCoins > 0 && (
                  <div style={{ background: '#111', padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 15 }}>🪙</span>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Bonus coins</span>
                    </div>
                    <span style={{ fontFamily: "'Barlow', sans-serif", fontWeight: 300, fontSize: 16, color: '#F59E0B' }}>
                      +{rewards.bonusCoins}
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
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Shoe chip ────────────────────────────────────────────────────── */}
        <motion.div {...fadeUp(0.40)} style={{ marginBottom: 12 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 14px', background: T.surface, borderRadius: 10,
            border: `0.5px solid ${T.border}`,
          }}>
            <span style={{ fontSize: 15 }}>👟</span>
            {runShoe ? (
              <>
                <span style={{ flex: 1, fontFamily: "'Barlow', sans-serif", fontSize: 12, fontWeight: 400, color: T.black }}>
                  {runShoe.nickname ?? `${runShoe.brand} ${runShoe.model}`}
                </span>
                {shoeTotalKm > 0 && (
                  <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: T.t3 }}>{shoeTotalKm.toFixed(0)} km</span>
                )}
                {allShoes.length > 1 && (
                  <button
                    onClick={() => setShowShoeDrawer(true)}
                    style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: T.t2, background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', display: 'flex', alignItems: 'center', gap: 2 }}
                  >
                    change <ChevronDown size={11} color={T.t2} strokeWidth={1.5} />
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={() => navigate('/gear/add')}
                style={{ fontFamily: "'Barlow', sans-serif", fontSize: 12, color: '#D93518', background: 'none', border: 'none', cursor: 'pointer', flex: 1, textAlign: 'left', padding: 0 }}
              >
                Add shoes to track km →
              </button>
            )}
          </div>
        </motion.div>

        {/* ── AI Post-Run Analysis ─────────────────────────────────────────── */}
        {(aiLoading || aiInsights) && runId && (
          <motion.div {...fadeUp(0.44)} style={{ marginBottom: 16 }}>
            <div style={{
              background: '#F2EEF9', border: '0.5px solid rgba(90,58,138,0.2)',
              borderRadius: 10, padding: '14px 16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(90,58,138,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Sparkles size={13} color="#5A3A8A" strokeWidth={1.5} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5A3A8A', fontFamily: "'Barlow', sans-serif" }}>
                  Runivo Intelligence
                </span>
              </div>
              {aiLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[60, 80, 55].map((w, i) => (
                    <div key={i} style={{ height: 10, width: `${w}%`, background: 'rgba(90,58,138,0.12)', borderRadius: 4 }} />
                  ))}
                </div>
              ) : aiInsights && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: '#3D2466', fontFamily: "'Barlow', sans-serif", lineHeight: 1.4, margin: 0 }}>
                    {aiInsights.praise}
                  </p>
                  <p style={{ fontSize: 11, fontWeight: 300, color: '#5A3A8A', fontFamily: "'Barlow', sans-serif", lineHeight: 1.5, margin: 0 }}>
                    {aiInsights.analysis}
                  </p>
                  <div style={{ paddingTop: 6, borderTop: '0.5px solid rgba(90,58,138,0.15)' }}>
                    <p style={{ fontSize: 11, fontWeight: 400, color: '#7C5CAE', fontFamily: "'Barlow', sans-serif", lineHeight: 1.5, margin: 0 }}>
                      💡 {aiInsights.suggestion}
                    </p>
                  </div>
                  {aiInsights.recovery && (
                    <div style={{ paddingTop: 8, borderTop: '0.5px solid rgba(90,58,138,0.15)', marginTop: 2 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5A3A8A', marginBottom: 6, fontFamily: "'Barlow', sans-serif" }}>
                        Recovery Prescription
                      </div>
                      <p style={{ fontSize: 12, color: '#3B2461', lineHeight: 1.5, margin: 0, fontFamily: "'Barlow', sans-serif" }}>
                        {aiInsights.recovery}
                      </p>
                    </div>
                  )}
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
              onClick={() => setShowPostRunFood(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '6px 12px', borderRadius: 20,
                background: T.black, border: 'none', cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <Utensils size={11} color="#fff" strokeWidth={1.5} />
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

      {/* ── Off-screen story card (captured by toPng for auto-upload) ─────── */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0, width: 1080, height: 1920, overflow: 'hidden', pointerEvents: 'none' }}>
        <div
          ref={storyCardRef}
          style={{
            width: 1080, height: 1920,
            background: 'linear-gradient(135deg, #0A0A0F 0%, #12121A 100%)',
            position: 'relative', overflow: 'hidden',
            fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
            display: 'flex', flexDirection: 'column',
          }}
        >
          {/* accent top bar */}
          <div style={{ height: 6, background: 'linear-gradient(90deg, transparent, #00B4C6, transparent)' }} />
          {/* content */}
          <div style={{ flex: 1, padding: '80px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: 180, fontWeight: 800, color: '#fff', lineHeight: 0.9, letterSpacing: '-0.03em', fontFamily: "'JetBrains Mono', monospace" }}>
              {runData.distance.toFixed(2)}
            </div>
            <div style={{ fontSize: 48, fontWeight: 600, color: 'rgba(255,255,255,0.45)', marginTop: 8, letterSpacing: '0.15em', textTransform: 'uppercase' as const }}>
              kilometers
            </div>
            <div style={{ display: 'flex', gap: 60, marginTop: 80 }}>
              {[
                { label: 'DURATION', value: formatTime(runData.duration) },
                { label: 'AVG PACE', value: `${formatPace(runData.pace)}/km` },
                { label: 'ZONES', value: String(runData.territoriesClaimed || 0) },
              ].map((s, i) => (
                <div key={i}>
                  <div style={{ fontSize: 22, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.2em', marginBottom: 12, fontWeight: 500 }}>{s.label}</div>
                  <div style={{ fontSize: 56, fontWeight: 700, color: '#fff', fontFamily: "'JetBrains Mono', monospace" }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
          {/* footer */}
          <div style={{ padding: '0 80px 80px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 30, fontWeight: 700, color: '#fff' }}>{player?.username || 'Runner'}</div>
            <div style={{ fontSize: 42, fontFamily: "'Cormorant Garamond', Georgia, serif", fontStyle: 'italic', fontWeight: 600, color: '#fff' }}>
              Run<span style={{ color: '#00B4C6' }}>ivo</span>
            </div>
          </div>
        </div>
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

      {showPostRunFood && (
        <FoodSearch
          defaultMeal={(() => {
            const h = new Date().getHours();
            if (h < 11) return 'breakfast';
            if (h < 15) return 'lunch';
            if (h < 20) return 'dinner';
            return 'snacks';
          })()}
          onAdd={async (entry) => {
            await addNutritionEntry({ ...entry, date: todayKey(), loggedAt: Date.now(), xpAwarded: false });
            setShowPostRunFood(false);
            setFoodToast('Meal logged ✓');
            setTimeout(() => setFoodToast(''), 2500);
          }}
          onClose={() => setShowPostRunFood(false)}
        />
      )}

      {foodToast && (
        <div style={{
          position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          background: '#0A0A0A', color: '#fff', borderRadius: 20,
          padding: '8px 18px', fontSize: 12, fontWeight: 500,
          fontFamily: "'Barlow', sans-serif", zIndex: 9999,
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        }}>
          {foodToast}
        </div>
      )}

      {/* ── Shoe picker drawer ───────────────────────────────────────────── */}
      {showShoeDrawer && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setShowShoeDrawer(false)}
        >
          <div
            style={{ width: '100%', background: '#fff', borderRadius: '16px 16px 0 0', padding: '16px', paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
            onClick={e => e.stopPropagation()}
          >
            <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 12, fontWeight: 600, color: '#6B6560', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Select shoe</p>
            {allShoes.map(shoe => (
              <button
                key={shoe.id}
                onClick={async () => {
                  setRunShoe(shoe);
                  setShowShoeDrawer(false);
                  // Assign this shoe to the current run in IDB
                  if (runId) {
                    const existing = await getRunById(runId);
                    if (existing) await saveRun({ ...existing, shoeId: shoe.id });
                  }
                  // Update shoeTotalKm (rough estimate from this session — exact on next full load)
                  setShoeTotalKm(prev => prev); // no-op; will refresh on next mount
                }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '11px 0', background: 'none', border: 'none', borderBottom: '0.5px solid #E8E4DF',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{ width: 24, height: 24, borderRadius: 6, background: shoe.color ?? '#0A0A0A', flexShrink: 0 }} />
                <span style={{ flex: 1, fontFamily: "'Barlow', sans-serif", fontSize: 13, fontWeight: 400, color: '#0A0A0A' }}>
                  {shoe.nickname ?? `${shoe.brand} ${shoe.model}`}
                </span>
                {shoe.id === runShoe?.id && (
                  <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: 10, color: '#0A0A0A', fontWeight: 600 }}>✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default RunSummary
