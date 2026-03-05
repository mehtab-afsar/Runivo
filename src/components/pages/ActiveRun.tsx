import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Flag, Swords } from 'lucide-react';
import { useActiveRun } from '../../hooks/useActiveRun';
import { AnimatedCounter } from '../ui/AnimatedCounter';
import { haptic } from '../../lib/haptics';
import {
  addTerritoryOverlay,
  animateClaimHex,
  updateTerritoryData,
} from '../../map/territoryLayer';
import { getAllTerritories } from '../../game/store';

export default function ActiveRun() {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const startLocation = (routerLocation.state as { startLocation?: { lat: number; lng: number } } | null)?.startLocation;

  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const routeSourceAdded = useRef(false);
  const userLngLatRef = useRef<[number, number] | null>(
    startLocation ? [startLocation.lng, startLocation.lat] : null
  );
  const watchIdRef = useRef<number | null>(null);

  const {
    isRunning, isPaused, elapsed, distance, pace,
    gpsPoints, currentZone, claimProgress,
    territoriesClaimed, lastClaimEvent,
    startRun, pauseRun, resumeRun, finishRun, player,
  } = useActiveRun();

  const [mapReady, setMapReady] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const initCenter: [number, number] = userLngLatRef.current ?? [77.2090, 28.6139];

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
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

      // Create marker element
      const el = document.createElement('div');
      el.className = 'user-marker';
      el.style.position = 'relative';
      el.innerHTML = `
        <div style="
          width: 20px; height: 20px;
          background: #00B4C6;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,180,198,0.4);
        "></div>
        <div style="
          position: absolute; top: -2px; left: -2px;
          width: 24px; height: 24px;
          border-radius: 50%;
          border: 2px solid rgba(0,180,198,0.3);
          animation: pulse-ring 2s ease-out infinite;
        "></div>
      `;

      // Place marker immediately at known location if available
      if (userLngLatRef.current) {
        markerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat(userLngLatRef.current)
          .addTo(map);
      } else {
        markerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat(initCenter);
      }

      // Continuously watch position for accurate tracking
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const lngLat: [number, number] = [pos.coords.longitude, pos.coords.latitude];
          userLngLatRef.current = lngLat;
          if (markerRef.current) {
            markerRef.current.setLngLat(lngLat);
            if (!markerRef.current.getElement().parentElement) {
              markerRef.current.addTo(map);
            }
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
    });

    const ro = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.resize();
    });
    ro.observe(mapContainer.current);

    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse-ring {
        0% { transform: scale(1); opacity: 1; }
        100% { transform: scale(3); opacity: 0; }
      }
    `;
    document.head.appendChild(style);

    return () => {
      ro.disconnect();
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      map.remove();
      mapRef.current = null;
      style.remove();
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !mapReady || gpsPoints.length === 0) return;

    const latest = gpsPoints[gpsPoints.length - 1];
    const map = mapRef.current;

    if (markerRef.current) {
      markerRef.current.setLngLat([latest.lng, latest.lat]);
    }

    if (isRunning && !isPaused) {
      map.easeTo({ center: [latest.lng, latest.lat], duration: 1000 });
    }

    const routeCoords = gpsPoints.map(p => [p.lng, p.lat]);

    if (!routeSourceAdded.current) {
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
        paint: { 'line-color': 'rgba(0, 180, 198, 0.15)', 'line-width': 12, 'line-blur': 8 },
      });

      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        paint: { 'line-color': '#00B4C6', 'line-width': 4, 'line-opacity': 0.9 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });

      routeSourceAdded.current = true;
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
    if (!mapRef.current) return;

    animateClaimHex(mapRef.current, lastClaimEvent.hexId);

    (async () => {
      if (!mapRef.current || !player) return;
      const territories = await getAllTerritories();
      updateTerritoryData(mapRef.current, territories, player.id);
    })();
  }, [lastClaimEvent, player]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      console.log('Territory clicked:', detail);
    };
    window.addEventListener('territory-click', handler);
    return () => window.removeEventListener('territory-click', handler);
  }, []);

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
    if (result) {
      const lastPoint = result.gpsPoints?.[result.gpsPoints.length - 1];
      navigate(`/run-summary/${result.runId}`, {
        state: {
          runData: {
            distance: result.distance,
            duration: result.elapsed,
            pace: result.elapsed > 0 ? result.distance / result.elapsed : 0,
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
          },
        },
      });
    }
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

  const zoneGradients: Record<string, string> = {
    owned: 'from-teal-500/15 via-transparent to-transparent',
    enemy: 'from-pink-500/15 via-transparent to-transparent',
    neutral: 'from-gray-500/5 via-transparent to-transparent',
  };

  return (
    <div className="fixed inset-0 bg-white" style={{ width: '100vw', height: '100dvh', minHeight: '100vh' }}>
      <div ref={mapContainer} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }} />

      <AnimatePresence mode="wait">
        {currentZone && (
          <motion.div
            key={currentZone}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className={`absolute top-0 left-0 right-0 h-40 bg-gradient-to-b ${zoneGradients[currentZone]} pointer-events-none z-10`}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {claimProgress > 0 && claimProgress < 100 && (
          <motion.div
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            transition={{ type: 'spring', damping: 25 }}
            className="absolute left-4 right-4 z-20"
            style={{ top: 'max(16px, env(safe-area-inset-top))' }}
          >
            <div className="bg-white rounded-2xl p-3.5 flex items-center gap-3 shadow-lg border border-gray-100">
              <div className="flex-1">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-medium text-gray-500">
                    {currentZone === 'enemy' ? (
                      <span className="flex items-center gap-1.5"><Swords className="w-3.5 h-3.5 text-pink-500" strokeWidth={2} /> Attacking Territory</span>
                    ) : (
                      <span className="flex items-center gap-1.5"><Flag className="w-3.5 h-3.5 text-teal-600" strokeWidth={2} /> Claiming Territory</span>
                    )}
                  </span>
                  <span className="text-stat text-xs font-bold text-teal-600">
                    {Math.round(claimProgress)}%
                  </span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${
                      currentZone === 'enemy'
                        ? 'bg-gradient-to-r from-pink-500 to-pink-400'
                        : 'bg-gradient-to-r from-teal-500 to-teal-400'
                    }`}
                    animate={{ width: `${claimProgress}%` }}
                    transition={{ type: 'spring', stiffness: 50, damping: 15 }}
                  />
                </div>
              </div>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className={`w-8 h-8 rounded-full border-2 ${
                  currentZone === 'enemy'
                    ? 'border-pink-200 border-t-pink-500'
                    : 'border-teal-200 border-t-teal-500'
                }`}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {lastClaimEvent?.type === 'claimed' && (
          <motion.div
            initial={{ y: -100, opacity: 0, scale: 0.85 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -100, opacity: 0, scale: 0.85 }}
            transition={{ type: 'spring', damping: 20, stiffness: 200 }}
            className="absolute left-4 right-4 z-30"
            style={{ top: 'max(20px, env(safe-area-inset-top))' }}
          >
            <div className="bg-white rounded-2xl p-4 flex items-center gap-3 shadow-lg border border-teal-200">
              <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center">
                <Flag className="w-6 h-6 text-teal-600" strokeWidth={2} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900">Territory Claimed!</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {lastClaimEvent.previousOwner ? 'Captured from enemy!' : 'New zone secured'}
                </p>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-stat text-sm font-bold text-teal-600">
                  +{lastClaimEvent.xpEarned} XP
                </span>
                <span className="text-stat text-xs font-bold text-amber-500">
                  +{lastClaimEvent.coinsEarned} coins
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className="absolute right-4 z-20 flex flex-col gap-2"
        style={{ top: 'max(16px, env(safe-area-inset-top))' }}
      >
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={recenterMap}
          className="w-11 h-11 rounded-full bg-white shadow-md border border-gray-100 flex items-center justify-center"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
          </svg>
        </motion.button>
      </div>

      <motion.div
        initial={{ y: 200 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200, delay: 0.2 }}
        className="absolute bottom-0 left-0 right-0 z-20"
      >
        <div className="bg-white/95 backdrop-blur-xl rounded-t-3xl border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-8 h-1 rounded-full bg-gray-200" />
          </div>

          <div className="text-center pt-1 pb-3">
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-stat text-6xl font-bold text-gray-900 tracking-tight leading-none">
                <AnimatedCounter value={distance} decimals={2} />
              </span>
              <span className="text-stat text-xl text-gray-400 font-medium">km</span>
            </div>
          </div>

          <div className="flex items-center justify-around px-6 pb-4 border-b border-gray-100">
            <div className="flex flex-col items-center">
              <span className="text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-1">Time</span>
              <span className="text-stat text-2xl font-semibold text-gray-900">{formatTime(elapsed)}</span>
            </div>
            <div className="w-px h-10 bg-gray-200" />
            <div className="flex flex-col items-center">
              <span className="text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-1">Pace</span>
              <span className="text-stat text-2xl font-semibold text-gray-900">
                {pace}<span className="text-sm text-gray-400 ml-0.5">/km</span>
              </span>
            </div>
            <div className="w-px h-10 bg-gray-200" />
            <div className="flex flex-col items-center">
              <span className="text-[10px] uppercase tracking-[0.2em] text-gray-400 mb-1">Zones</span>
              <span className="text-stat text-2xl font-bold text-teal-600">{territoriesClaimed}</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-6 py-5 px-6 pb-safe">
            {!isRunning ? (
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={startRun}
                className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-500 to-teal-600
                           flex items-center justify-center
                           shadow-[0_4px_24px_rgba(0,180,198,0.3)]"
              >
                <svg width="28" height="32" viewBox="0 0 28 32" fill="white">
                  <path d="M2 0L28 16L2 32V0Z" />
                </svg>
              </motion.button>
            ) : (
              <>
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={() => { setShowFinishConfirm(true); haptic('medium'); }}
                  className="w-14 h-14 rounded-full bg-red-50 border border-red-200
                             flex items-center justify-center"
                >
                  <div className="w-5 h-5 rounded-sm bg-red-500" />
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={isPaused ? resumeRun : pauseRun}
                  className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                    isPaused
                      ? 'bg-gradient-to-br from-teal-500 to-teal-600 shadow-[0_4px_24px_rgba(0,180,198,0.3)]'
                      : 'bg-gray-100 border-2 border-gray-200'
                  }`}
                >
                  {isPaused ? (
                    <svg width="28" height="32" viewBox="0 0 28 32" fill="white">
                      <path d="M2 0L28 16L2 32V0Z" />
                    </svg>
                  ) : (
                    <div className="flex gap-2">
                      <div className="w-3 h-7 bg-gray-600 rounded-sm" />
                      <div className="w-3 h-7 bg-gray-600 rounded-sm" />
                    </div>
                  )}
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={recenterMap}
                  className="w-14 h-14 rounded-full bg-gray-50 border border-gray-200
                             flex items-center justify-center"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
                  </svg>
                </motion.button>
              </>
            )}
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showFinishConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-40"
              onClick={() => setShowFinishConfirm(false)}
            />
            <motion.div
              initial={{ y: 200, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 200, opacity: 0 }}
              transition={{ type: 'spring', damping: 25 }}
              className="fixed bottom-0 left-0 right-0 z-50 p-6 pb-safe"
            >
              <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-xl">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Finish Run?</h3>
                <p className="text-sm text-gray-500 mb-6">
                  {distance.toFixed(2)} km · {formatTime(elapsed)} · {territoriesClaimed} territories claimed
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowFinishConfirm(false)}
                    className="flex-1 py-3.5 rounded-2xl bg-gray-50 border border-gray-200
                               text-sm font-semibold text-gray-600 active:scale-[0.97] transition"
                  >
                    Continue
                  </button>
                  <button
                    onClick={handleFinish}
                    className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-teal-500 to-teal-600
                               text-sm font-bold text-white active:scale-[0.97] transition
                               shadow-[0_4px_16px_rgba(0,180,198,0.25)]"
                  >
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
