import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Flag } from 'lucide-react';
import { useActiveRun } from '@features/run/hooks/useActiveRun';
import { useTheme } from '@shared/hooks/useTheme';
import { FirstRunGuide } from '@features/run/components/FirstRunGuide';
import { postRunSync, createFeedPost } from '@shared/services/sync';
import { AnimatedCounter } from '@shared/ui/AnimatedCounter';
import { haptic } from '@shared/lib/haptics';
import {
  addTerritoryOverlay,
  updateTerritoryData,
} from '@features/territory/services/territoryLayer';
import { getAllTerritories } from '@shared/services/store';


// Bearing between two GPS points in degrees (0 = north, clockwise)
function calcBearing(p1: { lat: number; lng: number }, p2: { lat: number; lng: number }): number {
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const lat1 = (p1.lat * Math.PI) / 180;
  const lat2 = (p2.lat * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180) / Math.PI;
}


function arrowMarkerHTML(bearing: number) {
  return `
    <div data-arrow style="position:absolute;inset:0;display:flex;align-items:center;
      justify-content:center;transform:rotate(${bearing}deg);transition:transform 0.4s ease;">
      <svg width="22" height="28" viewBox="0 0 22 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M11 1L21 24C21 24 16 20.5 11 20.5C6 20.5 1 24 1 24L11 1Z"
          fill="#00B4C6" stroke="white" stroke-width="2" stroke-linejoin="round"/>
      </svg>
    </div>
  `;
}

const MAP_STYLE_LIGHT = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const MAP_STYLE_DARK  = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

export default function ActiveRun() {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const { dark } = useTheme();
  const routeState = routerLocation.state as { startLocation?: { lat: number; lng: number }; ghostRoute?: { lat: number; lng: number }[] } | null;
  const startLocation = routeState?.startLocation;
  const ghostRoute = routeState?.ghostRoute;

  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const routeSourceAdded = useRef(false);
  const startDotAdded = useRef(false);
  const userLngLatRef = useRef<[number, number] | null>(
    startLocation ? [startLocation.lng, startLocation.lat] : null
  );
  const preRunWatchIdRef = useRef<number | null>(null);
  const lastEaseRef = useRef<number>(0);
  const lastEasePosRef = useRef<[number, number] | null>(null);
  const isRunningRef = useRef(false);
  const userPanningRef = useRef(false);
  const bearingRef = useRef(0);

  const {
    isRunning, isPaused, elapsed, distance, pace,
    gpsPoints, claimProgress,
    territoriesClaimed, lastClaimEvent, energyBlocked,
    startRun, pauseRun, resumeRun, finishRun, player,
  } = useActiveRun();

  const [mapReady, setMapReady] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const initCenter: [number, number] = userLngLatRef.current ?? [77.2090, 28.6139];

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: dark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT,
      center: initCenter,
      zoom: 16,
      pitch: 45,
      attributionControl: false,
    });

    map.on('load', async () => {
      mapRef.current = map;
      setMapReady(true);
      setTimeout(() => map.resize(), 0);

      if (player) {
        const territories = await getAllTerritories();
        addTerritoryOverlay(map, territories, {
          playerId: player.id,
          showLabels: true,
        });
      }

      // Ghost route overlay (dashed gray line from a saved/nearby route)
      if (ghostRoute && ghostRoute.length >= 2) {
        const ghostCoords = ghostRoute.map(p => [p.lng, p.lat]);
        try {
          map.addSource('ghost-route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: ghostCoords },
            },
          });
          map.addLayer({
            id: 'ghost-route-line',
            type: 'line',
            source: 'ghost-route',
            paint: {
              'line-color': '#9CA3AF',
              'line-width': 3,
              'line-opacity': 0.5,
              'line-dasharray': [4, 3],
            },
            layout: { 'line-cap': 'round', 'line-join': 'round' },
          });
        } catch (e) {
          console.warn('Ghost route layer error:', e);
        }
      }

      // Create marker element — always an arrow on this page
      const el = document.createElement('div');
      el.className = 'user-marker';
      el.style.cssText = 'position:relative;width:28px;height:28px;';
      el.innerHTML = arrowMarkerHTML(0);

      // Place marker immediately at known location if available
      const markerLngLat = userLngLatRef.current ?? initCenter;
      markerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat(markerLngLat)
        .addTo(map);

      // Track user panning so auto-center doesn't fight them
      map.on('dragstart', () => { userPanningRef.current = true; });
      map.on('dragend', () => { userPanningRef.current = false; });

      // Pre-run watcher: keeps map and marker centred until user starts running.
      // Once isRunningRef flips true, we clear this watcher (useActiveRun has its own).
      preRunWatchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          // Stop updating once the run is active — useActiveRun's watcher takes over
          if (isRunningRef.current) {
            if (preRunWatchIdRef.current !== null) {
              navigator.geolocation.clearWatch(preRunWatchIdRef.current);
              preRunWatchIdRef.current = null;
            }
            return;
          }
          const lngLat: [number, number] = [pos.coords.longitude, pos.coords.latitude];
          userLngLatRef.current = lngLat;
          if (markerRef.current) {
            markerRef.current.setLngLat(lngLat);
          }
          if (!userPanningRef.current) {
            map.easeTo({ center: lngLat, zoom: 16, pitch: 45, duration: 600 });
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 3000 }
      );
    });

    const ro = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.resize();
    });
    ro.observe(mapContainer.current);

    return () => {
      ro.disconnect();
      if (preRunWatchIdRef.current !== null) navigator.geolocation.clearWatch(preRunWatchIdRef.current);
      map.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap map style when dark mode changes
  useEffect(() => {
    if (!mapRef.current) return;
    const style = dark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;
    mapRef.current.setStyle(style);
  }, [dark]);

  // Keep isRunningRef in sync; clear pre-run watcher when run starts
  useEffect(() => {
    isRunningRef.current = isRunning;
    if (isRunning && preRunWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(preRunWatchIdRef.current);
      preRunWatchIdRef.current = null;
    }
  }, [isRunning]);

  useEffect(() => {
    if (!mapRef.current || !mapReady || gpsPoints.length === 0) return;

    const latest = gpsPoints[gpsPoints.length - 1];
    const map = mapRef.current;

    if (markerRef.current) {
      markerRef.current.setLngLat([latest.lng, latest.lat]);
    }

    // Update arrow bearing from last two GPS points
    if (isRunning && gpsPoints.length >= 2) {
      const prev = gpsPoints[gpsPoints.length - 2];
      const bearing = calcBearing(prev, latest);
      bearingRef.current = bearing;
      const arrowEl = markerRef.current?.getElement().querySelector('[data-arrow]') as HTMLElement | null;
      if (arrowEl) arrowEl.style.transform = `rotate(${bearing}deg)`;
    }

    // Throttle easeTo to max every 2s, only if moved > 5m, and user isn't panning
    if (isRunning && !isPaused && !userPanningRef.current) {
      const now = Date.now();
      const lngLat: [number, number] = [latest.lng, latest.lat];
      let shouldEase = now - lastEaseRef.current > 2000;
      if (shouldEase && lastEasePosRef.current) {
        const R = 6371000;
        const dLat = ((latest.lat - lastEasePosRef.current[1]) * Math.PI) / 180;
        const dLon = ((latest.lng - lastEasePosRef.current[0]) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos((lastEasePosRef.current[1] * Math.PI) / 180) * Math.cos((latest.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        shouldEase = dist > 5;
      }
      if (shouldEase) {
        lastEaseRef.current = now;
        lastEasePosRef.current = lngLat;
        map.easeTo({ center: lngLat, duration: 1000 });
      }
    }

    const routeCoords = gpsPoints.map(p => [p.lng, p.lat]);

    // Add start-point marker as soon as we have the first GPS point
    if (!startDotAdded.current) {
      try {
        map.addSource('start-point', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Point', coordinates: [gpsPoints[0].lng, gpsPoints[0].lat] },
          },
        });
        map.addLayer({
          id: 'start-dot',
          type: 'circle',
          source: 'start-point',
          paint: {
            'circle-radius': 8,
            'circle-color': '#00B4C6',
            'circle-stroke-width': 2.5,
            'circle-stroke-color': '#ffffff',
          },
        });
        startDotAdded.current = true;
      } catch (e) {
        console.warn('start-dot layer error:', e);
      }
    }

    // Only create the route LineString once we have >= 2 points (valid GeoJSON)
    if (routeCoords.length < 2) return;

    if (!routeSourceAdded.current) {
      try {
        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: routeCoords },
          },
        });

        map.addLayer({
          id: 'route-glow',
          type: 'line',
          source: 'route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': 'rgba(0, 180, 198, 0.25)', 'line-width': 14, 'line-blur': 6 },
        });

        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          paint: { 'line-color': '#00B4C6', 'line-width': 5, 'line-opacity': 0.95 },
          layout: { 'line-cap': 'round', 'line-join': 'round' },
        });

        routeSourceAdded.current = true;
      } catch (e) {
        console.error('Route source/layer error:', e);
      }
    } else {
      const source = map.getSource('route') as maplibregl.GeoJSONSource;
      if (source) {
        source.setData({
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: routeCoords },
        });
      }
    }
  }, [gpsPoints, mapReady, isRunning, isPaused]);

  useEffect(() => {
    if (!lastClaimEvent || lastClaimEvent.type !== 'claimed') return;
    if (!mapRef.current || !player) return;

    (async () => {
      if (!mapRef.current || !player) return;
      const territories = await getAllTerritories();
      updateTerritoryData(mapRef.current, territories, player.id);
    })();
  }, [lastClaimEvent, player]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0)
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleFinish = useCallback(async () => {
    const result = await finishRun();
    if (!result) return;

    const lastPoint = result.gpsPoints?.[result.gpsPoints.length - 1];
    const distanceKm = result.distance;
    const runId = result.runId;

    // Fire-and-forget: push run + profile to Supabase, then create feed post
    postRunSync().then(() => {
      createFeedPost(runId, distanceKm, result.territoriesClaimed);
    }).catch(console.error);

    navigate(`/run-summary/${runId}`, {
      state: {
        runData: {
          distance: distanceKm,
          duration: result.elapsed,
          pace: result.elapsed > 0 ? distanceKm / result.elapsed : 0,
          territoriesClaimed: result.territoriesClaimed,
          currentLocation: lastPoint
            ? { lat: lastPoint.lat, lng: lastPoint.lng }
            : { lat: 0, lng: 0 },
          isActive: false,
          isPaused: false,
          route: (result.gpsPoints || []).map((p: { lat: number; lng: number }) => ({
            lat: p.lat,
            lng: p.lng,
          })),
          actionType: 'claim',
          success: true,
          // Real reward data from game engine
          xpEarned: result.xpEarned ?? 0,
          coinsEarned: result.coinsEarned ?? 0,
          diamondsEarned: result.diamondsEarned ?? 0,
          enemyCaptured: 0,
          leveledUp: result.leveledUp ?? false,
          preRunLevel: result.preRunLevel ?? (player?.level ?? 1),
          newLevel: result.newLevel ?? (player?.level ?? 1),
          newStreak: result.newStreak ?? 0,
          completedMissions: result.completedMissions ?? [],
        },
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishRun, navigate]);

  const recenterMap = () => {
    if (!mapRef.current) return;
    // Prefer latest GPS point from active run, fall back to watchPosition location
    if (gpsPoints.length > 0) {
      const latest = gpsPoints[gpsPoints.length - 1];
      mapRef.current.flyTo({ center: [latest.lng, latest.lat], zoom: 16, pitch: 45, duration: 500 });
    } else if (userLngLatRef.current) {
      mapRef.current.flyTo({ center: userLngLatRef.current, zoom: 16, pitch: 45, duration: 500 });
    }
  };

  const card  = dark ? 'bg-black/70 border-white/10' : 'bg-white/95 border-gray-200';
  const text  = dark ? 'text-white'    : 'text-gray-900';
  const muted = dark ? 'text-white/40' : 'text-gray-400';
  const divdr = dark ? 'bg-white/10'   : 'bg-gray-200';
  const handle = dark ? 'bg-white/15'  : 'bg-gray-200';

  return (
    <div className="fixed inset-0" style={{ width: '100vw', height: '100dvh', minHeight: '100vh' }}>
      <div ref={mapContainer} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      {/* Claim progress banner */}
      <AnimatePresence>
        {claimProgress > 0 && claimProgress < 100 && (
          <motion.div
            initial={{ y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -80, opacity: 0 }}
            transition={{ type: 'spring', damping: 25 }}
            className="absolute left-4 right-4 z-20"
            style={{ top: 'max(16px, env(safe-area-inset-top))' }}
          >
            <div className={`backdrop-blur-xl rounded-2xl p-3.5 flex items-center gap-3 shadow-lg border ${card}`}>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-xs font-medium flex items-center gap-1.5 ${muted}`}>
                    <Flag className="w-3.5 h-3.5 text-teal-500" strokeWidth={2} /> Capturing Territory
                  </span>
                  <span className="text-stat text-xs font-bold text-teal-500">{Math.round(claimProgress)}%</span>
                </div>
                <div className={`h-1.5 rounded-full overflow-hidden ${dark ? 'bg-white/10' : 'bg-gray-100'}`}>
                  <motion.div className="h-full w-full rounded-full bg-gradient-to-r from-teal-500 to-teal-400"
                    animate={{ scaleX: claimProgress / 100 }} style={{ transformOrigin: 'left' }}
                    transition={{ type: 'spring', stiffness: 50, damping: 15 }} />
                </div>
              </div>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="w-8 h-8 rounded-full border-2 border-teal-500/30 border-t-teal-500" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Claim event toast */}
      <AnimatePresence>
        {lastClaimEvent?.type === 'claimed' && (
          <motion.div
            initial={{ y: -100, opacity: 0, scale: 0.85 }} animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -100, opacity: 0, scale: 0.85 }}
            transition={{ type: 'spring', damping: 20, stiffness: 200 }}
            className="absolute left-4 right-4 z-30"
            style={{ top: 'max(20px, env(safe-area-inset-top))' }}
          >
            <div className={`backdrop-blur-xl rounded-2xl p-4 flex items-center gap-3 shadow-lg border ${card}`}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${dark ? 'bg-teal-500/20' : 'bg-teal-50'}`}>
                <Flag className="w-6 h-6 text-teal-500" strokeWidth={2} />
              </div>
              <div className="flex-1">
                <p className={`text-sm font-bold ${text}`}>Territory Claimed!</p>
                <p className={`text-xs mt-0.5 ${muted}`}>New zone secured</p>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-stat text-sm font-bold text-teal-500">+{lastClaimEvent.xpEarned} XP</span>
                <span className="text-stat text-xs font-bold text-amber-400">+{lastClaimEvent.coinsEarned} coins</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recenter button */}
      <div className="absolute right-4 z-20 flex flex-col gap-2" style={{ top: 'max(16px, env(safe-area-inset-top))' }}>
        <motion.button whileTap={{ scale: 0.9 }} onClick={recenterMap}
          className={`w-11 h-11 rounded-full border backdrop-blur-xl flex items-center justify-center shadow-md ${dark ? 'bg-black/50 border-white/10' : 'bg-white border-gray-100'}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={dark ? 'rgba(255,255,255,0.6)' : '#6B7280'} strokeWidth="2">
            <circle cx="12" cy="12" r="3" /><path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
          </svg>
        </motion.button>
      </div>

      {/* Bottom HUD card */}
      <motion.div initial={{ y: 200 }} animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200, delay: 0.2 }}
        className="absolute bottom-0 left-0 right-0 z-20">
        <div className={`backdrop-blur-2xl rounded-t-3xl border-t shadow-[0_-4px_24px_rgba(0,0,0,0.15)] ${card}`}>
          <div className="flex justify-center pt-2 pb-1">
            <div className={`w-8 h-1 rounded-full ${handle}`} />
          </div>

          {/* Distance */}
          <div className="text-center pt-1 pb-3">
            <div className="flex items-baseline justify-center gap-1">
              <span className={`text-stat text-6xl font-bold tracking-tight leading-none ${text}`}>
                <AnimatedCounter value={distance} decimals={2} />
              </span>
              <span className={`text-stat text-xl font-medium ${muted}`}>km</span>
            </div>
          </div>

          {/* Energy blocked */}
          <AnimatePresence>
            {energyBlocked && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className={`mx-4 mb-2 px-3 py-2 rounded-xl border flex items-center gap-2 ${dark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                  <span className={`text-[11px] font-medium ${dark ? 'text-amber-400' : 'text-amber-700'}`}>Low energy — run ~1km to unlock next claim</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stats row */}
          <div className={`flex items-center justify-around px-6 pb-4 border-b ${dark ? 'border-white/10' : 'border-gray-100'}`}>
            {[
              { label: 'Time',     value: formatTime(elapsed) },
              { label: 'Pace',     value: pace,               unit: '/km' },
              { label: 'Calories', value: Math.round(distance * 88), unit: 'kcal' },
            ].map((s, i) => (
              <div key={s.label} className="flex items-center gap-4">
                {i > 0 && <div className={`w-px h-10 ${divdr}`} />}
                <div className="flex flex-col items-center">
                  <span className={`text-[10px] uppercase tracking-[0.2em] mb-1 ${muted}`}>{s.label}</span>
                  <span className={`text-stat text-2xl font-semibold ${text}`}>
                    {s.value}{s.unit && <span className={`text-sm ml-0.5 ${muted}`}>{s.unit}</span>}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-6 py-5 px-6 pb-safe">
            {!isRunning ? (
              <motion.button whileTap={{ scale: 0.88 }} onClick={startRun}
                className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-[0_4px_24px_rgba(0,180,198,0.35)]">
                <svg width="28" height="32" viewBox="0 0 28 32" fill="white"><path d="M2 0L28 16L2 32V0Z" /></svg>
              </motion.button>
            ) : (
              <>
                <motion.button whileTap={{ scale: 0.88 }}
                  onClick={() => { setShowFinishConfirm(true); haptic('medium'); }}
                  className={`w-14 h-14 rounded-full border flex items-center justify-center ${dark ? 'bg-red-500/15 border-red-500/30' : 'bg-red-50 border-red-200'}`}>
                  <div className="w-5 h-5 rounded-sm bg-red-500" />
                </motion.button>

                <motion.button whileTap={{ scale: 0.88 }}
                  onClick={isPaused ? resumeRun : pauseRun}
                  className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                    isPaused
                      ? 'bg-gradient-to-br from-teal-500 to-teal-600 shadow-[0_4px_24px_rgba(0,180,198,0.35)]'
                      : dark ? 'bg-white/10 border-2 border-white/15' : 'bg-gray-100 border-2 border-gray-200'
                  }`}>
                  {isPaused ? (
                    <svg width="28" height="32" viewBox="0 0 28 32" fill="white"><path d="M2 0L28 16L2 32V0Z" /></svg>
                  ) : (
                    <div className="flex gap-2">
                      <div className={`w-3 h-7 rounded-sm ${dark ? 'bg-white/60' : 'bg-gray-600'}`} />
                      <div className={`w-3 h-7 rounded-sm ${dark ? 'bg-white/60' : 'bg-gray-600'}`} />
                    </div>
                  )}
                </motion.button>

                <motion.button whileTap={{ scale: 0.88 }} onClick={recenterMap}
                  className={`w-14 h-14 rounded-full border flex items-center justify-center ${dark ? 'bg-white/10 border-white/15' : 'bg-gray-50 border-gray-200'}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={dark ? 'rgba(255,255,255,0.5)' : '#6B7280'} strokeWidth="2">
                    <circle cx="12" cy="12" r="3" /><path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
                  </svg>
                </motion.button>
              </>
            )}
          </div>
        </div>
      </motion.div>

      <FirstRunGuide claimProgress={claimProgress} territoriesClaimed={territoriesClaimed} isRunning={isRunning} />

      {/* Finish confirm sheet */}
      <AnimatePresence>
        {showFinishConfirm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowFinishConfirm(false)} />
            <motion.div initial={{ y: 200, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 200, opacity: 0 }}
              transition={{ type: 'spring', damping: 25 }}
              className="fixed bottom-0 left-0 right-0 z-50 p-5 pb-safe">
              <div className={`rounded-3xl p-6 border shadow-2xl backdrop-blur-2xl ${dark ? 'bg-[#111]/90 border-white/10' : 'bg-white border-gray-200'}`}>
                <h3 className={`text-lg font-bold mb-2 ${text}`}>Finish Run?</h3>
                <p className={`text-sm mb-6 ${muted}`}>
                  {distance.toFixed(2)} km · {formatTime(elapsed)} · {territoriesClaimed} territories claimed
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setShowFinishConfirm(false)}
                    className={`flex-1 py-3.5 rounded-2xl border text-sm font-semibold active:scale-[0.97] transition ${dark ? 'bg-white/10 border-white/10 text-white/70' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                    Continue
                  </button>
                  <button onClick={handleFinish}
                    className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-teal-500 to-teal-600 text-sm font-bold text-white active:scale-[0.97] transition shadow-[0_4px_16px_rgba(0,180,198,0.3)]">
                    Finish
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
