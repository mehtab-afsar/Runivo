import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Flag, Navigation } from 'lucide-react';
import { useActiveRun } from '@features/run/hooks/useActiveRun';
import { FirstRunGuide } from '@features/run/components/FirstRunGuide';
import { postRunSync, createFeedPost } from '@shared/services/sync';
import { AnimatedCounter } from '@shared/ui/AnimatedCounter';
import { haptic } from '@shared/lib/haptics';
import { addTerritoryOverlay, updateTerritoryData } from '@features/territory/services/territoryLayer';
import { getAllTerritories } from '@shared/services/store';

// ── Design tokens (identical to Home / Map / Record) ────────────────────────
const T = {
  bg:      '#F7F6F4',
  surface: '#FFFFFF',
  border:  '#E0DFDD',
  black:   '#0A0A0A',
  red:     '#D93518',
  muted:   '#6B6B6B',
  font:    "'Barlow', -apple-system, sans-serif",
};

// ── Helpers ──────────────────────────────────────────────────────────────────
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
          fill="${T.red}" stroke="white" stroke-width="2" stroke-linejoin="round"/>
      </svg>
    </div>`;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

// ── Component ────────────────────────────────────────────────────────────────
export default function ActiveRun() {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const routeState = routerLocation.state as { startLocation?: { lat: number; lng: number }; ghostRoute?: { lat: number; lng: number }[] } | null;
  const startLocation = routeState?.startLocation;
  const ghostRoute    = routeState?.ghostRoute;

  const mapContainer  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<maplibregl.Map | null>(null);
  const markerRef     = useRef<maplibregl.Marker | null>(null);
  const routeSourceAdded = useRef(false);
  const startDotAdded    = useRef(false);
  const userLngLatRef = useRef<[number, number] | null>(
    startLocation ? [startLocation.lng, startLocation.lat] : null
  );
  const preRunWatchIdRef = useRef<number | null>(null);
  const lastEaseRef      = useRef<number>(0);
  const lastEasePosRef   = useRef<[number, number] | null>(null);
  const isRunningRef     = useRef(false);
  const userPanningRef   = useRef(false);

  const {
    isRunning, isPaused, elapsed, distance, pace,
    gpsPoints, claimProgress,
    territoriesClaimed, lastClaimEvent, energyBlocked, gpsError,
    startRun, pauseRun, resumeRun, finishRun, player,
  } = useActiveRun();

  const [mapReady, setMapReady]             = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm]   = useState(false);

  // Warn before browser close/refresh while a run is active
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isRunning) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isRunning]);

  // Init map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    const initCenter: [number, number] = userLngLatRef.current ?? [77.2090, 28.6139];

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLE,
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
        addTerritoryOverlay(map, territories, { playerId: player.id, showLabels: true });
      }

      // Ghost route (dashed guide line)
      if (ghostRoute && ghostRoute.length >= 2) {
        try {
          map.addSource('ghost-route', {
            type: 'geojson',
            data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: ghostRoute.map(p => [p.lng, p.lat]) } },
          });
          map.addLayer({
            id: 'ghost-route-line', type: 'line', source: 'ghost-route',
            paint: { 'line-color': '#9CA3AF', 'line-width': 3, 'line-opacity': 0.45, 'line-dasharray': [4, 3] },
            layout: { 'line-cap': 'round', 'line-join': 'round' },
          });
        } catch (e) { console.warn('Ghost route layer error:', e); }
      }

      // Arrow marker
      const el = document.createElement('div');
      el.style.cssText = 'position:relative;width:28px;height:28px;';
      el.innerHTML = arrowMarkerHTML(0);
      markerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat(userLngLatRef.current ?? initCenter)
        .addTo(map);

      map.on('dragstart', () => { userPanningRef.current = true; });
      map.on('dragend',   () => { userPanningRef.current = false; });

      preRunWatchIdRef.current = navigator.geolocation.watchPosition(
        pos => {
          if (isRunningRef.current) {
            if (preRunWatchIdRef.current !== null) { navigator.geolocation.clearWatch(preRunWatchIdRef.current); preRunWatchIdRef.current = null; }
            return;
          }
          const lngLat: [number, number] = [pos.coords.longitude, pos.coords.latitude];
          userLngLatRef.current = lngLat;
          markerRef.current?.setLngLat(lngLat);
          if (!userPanningRef.current) map.easeTo({ center: lngLat, zoom: 16, pitch: 45, duration: 600 });
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 3000 }
      );
    });

    const ro = new ResizeObserver(() => { mapRef.current?.resize(); });
    ro.observe(mapContainer.current);

    return () => {
      ro.disconnect();
      if (preRunWatchIdRef.current !== null) navigator.geolocation.clearWatch(preRunWatchIdRef.current);
      map.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync isRunning ref
  useEffect(() => {
    isRunningRef.current = isRunning;
    if (isRunning && preRunWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(preRunWatchIdRef.current);
      preRunWatchIdRef.current = null;
    }
  }, [isRunning]);

  // Update route trail + marker on each GPS point
  useEffect(() => {
    if (!mapRef.current || !mapReady || gpsPoints.length === 0) return;
    const map = mapRef.current;
    const latest = gpsPoints[gpsPoints.length - 1];

    markerRef.current?.setLngLat([latest.lng, latest.lat]);

    if (isRunning && gpsPoints.length >= 2) {
      const bearing = calcBearing(gpsPoints[gpsPoints.length - 2], latest);
      const arrowEl = markerRef.current?.getElement().querySelector('[data-arrow]') as HTMLElement | null;
      if (arrowEl) arrowEl.style.transform = `rotate(${bearing}deg)`;
    }

    if (isRunning && !isPaused && !userPanningRef.current) {
      const now = Date.now();
      const lngLat: [number, number] = [latest.lng, latest.lat];
      let shouldEase = now - lastEaseRef.current > 2000;
      if (shouldEase && lastEasePosRef.current) {
        const R = 6371000;
        const dLat = ((latest.lat - lastEasePosRef.current[1]) * Math.PI) / 180;
        const dLon = ((latest.lng - lastEasePosRef.current[0]) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos((lastEasePosRef.current[1] * Math.PI) / 180) * Math.cos((latest.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
        if (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) < 5) shouldEase = false;
      }
      if (shouldEase) {
        lastEaseRef.current = now;
        lastEasePosRef.current = lngLat;
        map.easeTo({ center: lngLat, duration: 1000 });
      }
    }

    const coords = gpsPoints.map(p => [p.lng, p.lat]);

    if (!startDotAdded.current) {
      try {
        map.addSource('start-point', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [gpsPoints[0].lng, gpsPoints[0].lat] } } });
        map.addLayer({ id: 'start-dot', type: 'circle', source: 'start-point', paint: { 'circle-radius': 8, 'circle-color': T.red, 'circle-stroke-width': 2.5, 'circle-stroke-color': '#fff' } });
        startDotAdded.current = true;
      } catch (e) { console.warn(e); }
    }

    if (coords.length < 2) return;

    if (!routeSourceAdded.current) {
      try {
        map.addSource('route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } } });
        map.addLayer({ id: 'route-glow', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': `rgba(217,53,24,0.2)`, 'line-width': 14, 'line-blur': 6 } });
        map.addLayer({ id: 'route-line', type: 'line', source: 'route', paint: { 'line-color': T.red, 'line-width': 5, 'line-opacity': 0.95 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
        routeSourceAdded.current = true;
      } catch (e) { console.warn(e); }
    } else {
      const src = map.getSource('route') as maplibregl.GeoJSONSource;
      src?.setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } });
    }
  }, [gpsPoints, mapReady, isRunning, isPaused]);

  // Re-render territory when zone is claimed
  useEffect(() => {
    if (!lastClaimEvent || lastClaimEvent.type !== 'claimed' || !mapRef.current || !player) return;
    (async () => {
      if (!mapRef.current || !player) return;
      updateTerritoryData(mapRef.current, await getAllTerritories(), player.id);
    })();
  }, [lastClaimEvent, player]);

  const recenterMap = () => {
    if (!mapRef.current) return;
    const pt = gpsPoints.length > 0 ? gpsPoints[gpsPoints.length - 1] : null;
    const center = pt ? [pt.lng, pt.lat] as [number,number] : userLngLatRef.current;
    if (center) mapRef.current.flyTo({ center, zoom: 16, pitch: 45, duration: 500 });
  };

  const handleFinish = useCallback(async () => {
    const result = await finishRun();
    if (!result) return;
    // Run sync and feed post independently — feed post should not be blocked by sync failure
    postRunSync().catch(err => console.error('[ActiveRun] postRunSync failed:', err));
    createFeedPost(result.runId, result.distance, result.territoriesClaimed).catch(err => console.warn('[ActiveRun] feed post failed:', err));
    const lastPoint = result.gpsPoints?.[result.gpsPoints.length - 1];
    navigate(`/run-summary/${result.runId}`, {
      state: {
        runData: {
          distance: result.distance, duration: result.elapsed,
          pace: result.elapsed > 0 ? result.distance / result.elapsed : 0,
          territoriesClaimed: result.territoriesClaimed,
          currentLocation: lastPoint ? { lat: lastPoint.lat, lng: lastPoint.lng } : { lat: 0, lng: 0 },
          isActive: false, isPaused: false,
          route: (result.gpsPoints || []).map((p: { lat: number; lng: number }) => ({ lat: p.lat, lng: p.lng })),
          actionType: 'claim', success: true,
          xpEarned: result.xpEarned ?? 0,
          enemyCaptured: 0,
          leveledUp: result.leveledUp ?? false,
          preRunLevel: result.preRunLevel ?? (player?.level ?? 1),
          newLevel: result.newLevel ?? (player?.level ?? 1),
          newStreak: result.newStreak ?? 0,
          completedMissions: result.completedMissions ?? [],
        },
      },
    });
  }, [finishRun, navigate, player]);

  return (
    <div className="fixed inset-0" style={{ width: '100vw', height: '100dvh', fontFamily: T.font }}>
      <style>{`
        @keyframes claim-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Full-screen map */}
      <div ref={mapContainer} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      {/* ── CLAIM PROGRESS BANNER ─────────────────────────────────────── */}
      <AnimatePresence>
        {claimProgress > 0 && claimProgress < 100 && (
          <motion.div
            initial={{ y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -80, opacity: 0 }}
            transition={{ type: 'spring', damping: 25 }}
            className="absolute left-4 right-4 z-20"
            style={{ top: 'max(16px, env(safe-area-inset-top))' }}
          >
            <div style={{ background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(16px)', border: `0.5px solid ${T.border}`, borderRadius: 16, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 400, fontSize: 11, color: T.muted, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Flag style={{ width: 13, height: 13, color: T.red }} strokeWidth={1.5} />
                    Capturing Territory
                  </span>
                  <span style={{ fontWeight: 500, fontSize: 12, color: T.red }}>{Math.round(claimProgress)}%</span>
                </div>
                <div style={{ height: 3, background: T.bg, borderRadius: 9, overflow: 'hidden', border: `0.5px solid ${T.border}` }}>
                  <motion.div style={{ height: '100%', background: T.red, transformOrigin: 'left', borderRadius: 9 }}
                    animate={{ scaleX: claimProgress / 100 }} transition={{ type: 'spring', stiffness: 50, damping: 15 }} />
                </div>
              </div>
              <div style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid rgba(217,53,24,0.2)`, borderTopColor: T.red, animation: 'claim-spin 1.4s linear infinite', flexShrink: 0 }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CAPTURE TOAST ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {lastClaimEvent?.type === 'claimed' && (
          <motion.div
            initial={{ y: -60, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -60, opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', damping: 22, stiffness: 220 }}
            className="absolute left-0 right-0 z-30 flex justify-center"
            style={{ top: 'max(20px, env(safe-area-inset-top))' }}
          >
            {/* Black capsule toast */}
            <div style={{ background: T.black, borderRadius: 40, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.22)' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: T.red, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Flag style={{ width: 13, height: 13, color: '#fff' }} strokeWidth={1.5} />
              </div>
              <div>
                <p style={{ fontWeight: 500, fontSize: 13, color: '#fff', lineHeight: 1.2 }}>Territory Claimed</p>
                <p style={{ fontWeight: 300, fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 1 }}>Zone secured</p>
              </div>
              <div style={{ marginLeft: 4, textAlign: 'right' }}>
                <p style={{ fontWeight: 500, fontSize: 13, color: T.red }}>+{lastClaimEvent.xpEarned} XP</p>
                <p style={{ fontWeight: 300, fontSize: 11, color: '#D4A200', marginTop: 1 }}>+{lastClaimEvent.coinsEarned}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── BACK / RECENTER BUTTON ─────────────────────────────────────── */}
      <div className="absolute right-4 z-20" style={{ top: 'max(16px, env(safe-area-inset-top))' }}>
        <motion.button whileTap={{ scale: 0.88 }} onClick={recenterMap}
          style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', border: `0.5px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
          <Navigation style={{ width: 16, height: 16, color: T.black }} strokeWidth={1.5} />
        </motion.button>
      </div>

      {/* ── BOTTOM HUD ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ y: 220 }} animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 200, delay: 0.15 }}
        className="absolute bottom-0 left-0 right-0 z-20"
      >
        <div style={{ background: 'rgba(247,246,244,0.97)', backdropFilter: 'blur(20px)', borderTop: `0.5px solid ${T.border}`, borderRadius: '20px 20px 0 0', boxShadow: '0 -4px 24px rgba(0,0,0,0.07)' }}>
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div style={{ width: 36, height: 3, borderRadius: 9, background: T.border }} />
          </div>

          {/* Distance — big Barlow 300 */}
          <div className="text-center pt-2 pb-3">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4 }}>
              <span style={{ fontFamily: T.font, fontWeight: 300, fontSize: 68, color: T.black, letterSpacing: '-0.02em', lineHeight: 1 }}>
                <AnimatedCounter value={distance} decimals={2} />
              </span>
              <span style={{ fontFamily: T.font, fontWeight: 400, fontSize: 20, color: T.muted }}>km</span>
            </div>
          </div>

          {/* Energy blocked warning */}
          <AnimatePresence>
            {energyBlocked && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mx-4 mb-2">
                <div style={{ background: '#FFFBEB', border: `0.5px solid rgba(245,158,11,0.25)`, borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#D4A200" strokeWidth="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                  <span style={{ fontFamily: T.font, fontWeight: 400, fontSize: 11, color: '#B45309' }}>Low energy — run ~1km to unlock next claim</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stats strip — 3 cells */}
          <div className="flex items-stretch mx-4 mb-4"
            style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 14 }}>
            {[
              { label: 'TIME',     value: formatTime(elapsed),             unit: ''     },
              { label: 'PACE',     value: pace,                             unit: '/km'  },
              { label: 'CALORIES', value: String(Math.round(distance * 88)), unit: 'kcal' },
            ].map((s, i) => (
              <div key={s.label} className="flex-1 flex flex-col items-center py-3"
                style={{ borderLeft: i > 0 ? `0.5px solid ${T.border}` : 'none' }}>
                <span style={{ fontFamily: T.font, fontWeight: 400, fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{s.label}</span>
                <span style={{ fontFamily: T.font, fontWeight: 300, fontSize: 22, color: T.black, lineHeight: 1.1, marginTop: 2 }}>
                  {s.value}{s.unit && <span style={{ fontFamily: T.font, fontWeight: 400, fontSize: 10, color: T.muted }}>{' '}{s.unit}</span>}
                </span>
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-5 px-6"
            style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
            {!isRunning ? (
              /* Pre-run START button */
              <motion.button whileTap={{ scale: 0.92 }} onClick={startRun}
                className="flex items-center justify-center gap-3 flex-1"
                style={{ background: T.black, borderRadius: 16, padding: '15px 20px' }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: T.red, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="11" height="13" viewBox="0 0 11 13" fill="white"><path d="M0.5 0.5L10.5 6.5L0.5 12.5V0.5Z" /></svg>
                </div>
                <span style={{ fontFamily: T.font, fontWeight: 500, fontSize: 14, color: '#fff', letterSpacing: '0.06em' }}>START RUN</span>
              </motion.button>
            ) : (
              <>
                {/* Stop */}
                <motion.button whileTap={{ scale: 0.88 }}
                  onClick={() => { setShowFinishConfirm(true); haptic('medium'); }}
                  style={{ width: 54, height: 54, borderRadius: '50%', background: T.black, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <div style={{ width: 16, height: 16, borderRadius: 3, background: '#fff' }} />
                </motion.button>

                {/* Pause / Resume — large centre button */}
                <motion.button whileTap={{ scale: 0.88 }}
                  onClick={isPaused ? resumeRun : pauseRun}
                  style={{
                    width: 72, height: 72, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isPaused ? T.black : T.surface,
                    border: isPaused ? 'none' : `0.5px solid ${T.border}`,
                    boxShadow: isPaused ? `0 4px 20px rgba(0,0,0,0.18)` : '0 2px 8px rgba(0,0,0,0.06)',
                  }}>
                  {isPaused ? (
                    <svg width="20" height="24" viewBox="0 0 20 24" fill="white"><path d="M1 0L19 12L1 24V0Z" /></svg>
                  ) : (
                    <div style={{ display: 'flex', gap: 5 }}>
                      <div style={{ width: 4, height: 18, borderRadius: 3, background: T.black }} />
                      <div style={{ width: 4, height: 18, borderRadius: 3, background: T.black }} />
                    </div>
                  )}
                </motion.button>

                {/* Recenter */}
                <motion.button whileTap={{ scale: 0.88 }} onClick={recenterMap}
                  style={{ width: 54, height: 54, borderRadius: '50%', background: T.surface, border: `0.5px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <Navigation style={{ width: 18, height: 18, color: T.black }} strokeWidth={1.5} />
                </motion.button>
              </>
            )}
          </div>
        </div>
      </motion.div>

      <FirstRunGuide claimProgress={claimProgress} territoriesClaimed={territoriesClaimed} isRunning={isRunning} />

      {/* ── FINISH CONFIRM SHEET ───────────────────────────────────────── */}
      <AnimatePresence>
        {showFinishConfirm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.3)' }}
              onClick={() => setShowFinishConfirm(false)} />
            <motion.div
              initial={{ y: 200, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 200, opacity: 0 }}
              transition={{ type: 'spring', damping: 28 }}
              className="fixed bottom-0 left-0 right-0 z-50 px-4"
              style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
            >
              <div style={{ background: T.surface, borderRadius: 24, padding: 24, border: `0.5px solid ${T.border}`, boxShadow: '0 -4px 40px rgba(0,0,0,0.12)' }}>
                <h3 style={{ fontFamily: T.font, fontWeight: 500, fontSize: 18, color: T.black, marginBottom: 6 }}>Finish Run?</h3>
                <p style={{ fontFamily: T.font, fontWeight: 300, fontSize: 13, color: T.muted, marginBottom: 20 }}>
                  {distance.toFixed(2)} km · {formatTime(elapsed)} · {territoriesClaimed} {territoriesClaimed === 1 ? 'territory' : 'territories'} claimed
                </p>
                {/* Stats summary row */}
                <div className="flex mb-5" style={{ background: T.bg, border: `0.5px solid ${T.border}`, borderRadius: 12 }}>
                  {[
                    { label: 'Distance', value: `${distance.toFixed(2)} km` },
                    { label: 'Time',     value: formatTime(elapsed) },
                    { label: 'Zones',    value: String(territoriesClaimed) },
                  ].map((s, i) => (
                    <div key={s.label} className="flex-1 flex flex-col items-center py-3"
                      style={{ borderLeft: i > 0 ? `0.5px solid ${T.border}` : 'none' }}>
                      <span style={{ fontFamily: T.font, fontWeight: 400, fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{s.label}</span>
                      <span style={{ fontFamily: T.font, fontWeight: 300, fontSize: 18, color: T.black, marginTop: 2 }}>{s.value}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowFinishConfirm(false)}
                    style={{ flex: 1, padding: '14px 0', borderRadius: 14, background: T.bg, border: `0.5px solid ${T.border}`, fontFamily: T.font, fontWeight: 400, fontSize: 14, color: T.muted }}>
                    Continue
                  </button>
                  <button onClick={handleFinish}
                    style={{ flex: 1, padding: '14px 0', borderRadius: 14, background: T.black, fontFamily: T.font, fontWeight: 500, fontSize: 14, color: '#fff' }}>
                    Finish
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── GPS ERROR BANNER ──────────────────────────────────────────── */}
      <AnimatePresence>
        {gpsError !== null && isRunning && (
          <motion.div
            initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -60, opacity: 0 }}
            transition={{ type: 'spring', damping: 25 }}
            style={{
              position: 'absolute', top: 'max(16px, env(safe-area-inset-top))',
              left: 16, right: 16, zIndex: 30,
              background: '#FF3B30', borderRadius: 12, padding: '10px 14px',
              display: 'flex', alignItems: 'center', gap: 10,
            }}
          >
            <Flag style={{ width: 16, height: 16, color: '#fff', flexShrink: 0 }} />
            <span style={{ fontFamily: T.font, fontWeight: 400, fontSize: 13, color: '#fff' }}>
              {gpsError === 1 ? 'GPS permission denied — check location settings' : 'GPS signal lost — move to open sky'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LEAVE CONFIRM SHEET (manual back button) ──────────────────── */}
      <AnimatePresence>
        {showLeaveConfirm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.45)' }}
              onClick={() => setShowLeaveConfirm(false)} />
            <motion.div
              initial={{ y: 200, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 200, opacity: 0 }}
              transition={{ type: 'spring', damping: 28 }}
              style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 61,
                padding: '0 16px', paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
              }}
            >
              <div style={{ background: T.surface, borderRadius: 24, padding: 24, border: `0.5px solid ${T.border}`, boxShadow: '0 -4px 40px rgba(0,0,0,0.16)' }}>
                <h3 style={{ fontFamily: T.font, fontWeight: 500, fontSize: 18, color: T.black, marginBottom: 6 }}>Leave run?</h3>
                <p style={{ fontFamily: T.font, fontWeight: 300, fontSize: 13, color: T.muted, marginBottom: 20 }}>
                  Your run is in progress. If you leave now, all data will be lost.
                </p>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button onClick={() => setShowLeaveConfirm(false)}
                    style={{ flex: 1, padding: '14px 0', borderRadius: 14, background: T.bg, border: `0.5px solid ${T.border}`, fontFamily: T.font, fontWeight: 400, fontSize: 14, color: T.muted }}>
                    Stay
                  </button>
                  <button onClick={() => navigate(-1)}
                    style={{ flex: 1, padding: '14px 0', borderRadius: 14, background: '#FF3B30', fontFamily: T.font, fontWeight: 500, fontSize: 14, color: '#fff' }}>
                    Leave & discard
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
