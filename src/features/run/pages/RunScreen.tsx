import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Footprints, Bike, Mountain, Gauge, TreePine, Zap, Accessibility,
  Route, X, Crosshair, Layers, ChevronDown, BookmarkPlus, Search,
} from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getAllTerritories, getPlayer, StoredTerritory } from '@shared/services/store';
import { addTerritoryOverlay } from '@features/territory/services/territoryLayer';
import { getTodaysMissions } from '@features/missions/services/missionStore';
import { haptic } from '@shared/lib/haptics';
import type { Mission } from '@features/missions/services/missions';

// ── Types ──────────────────────────────────────────────────────────────────
type ActivityType = 'run' | 'walk' | 'jog' | 'cycle' | 'hike' | 'trail_run' | 'sprint' | 'wheelchair';
type MapStyleId   = 'standard' | 'dark' | 'light' | 'terrain' | 'satellite';
type GpsState     = 'searching' | 'ready' | 'error';
type SignalStrength = 'strong' | 'moderate' | 'weak' | 'searching';

// ── Map styles ─────────────────────────────────────────────────────────────
interface MapStyleDef { id: MapStyleId; label: string; preview: string; styleUrl?: string; rasterTiles?: string[]; sourceMaxZoom?: number }
const MAP_STYLES: MapStyleDef[] = [
  { id: 'standard',  label: 'Standard',  preview: '#E8F5E9', styleUrl: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json' },
  { id: 'dark',      label: 'Dark',      preview: '#263238', styleUrl: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json' },
  { id: 'light',     label: 'Light',     preview: '#FAFAFA', styleUrl: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json' },
  { id: 'terrain',   label: 'Terrain',   preview: '#C8E6C9', rasterTiles: ['https://a.tile.opentopomap.org/{z}/{x}/{y}.png','https://b.tile.opentopomap.org/{z}/{x}/{y}.png'], sourceMaxZoom: 17 },
  { id: 'satellite', label: 'Satellite', preview: '#1B5E20', rasterTiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], sourceMaxZoom: 18 },
];
function buildRasterStyle(tiles: string[], sourceMaxZoom = 19): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: { 'raster-tiles': { type: 'raster', tiles, tileSize: 256, attribution: '', maxzoom: sourceMaxZoom } },
    layers: [{ id: 'raster-layer', type: 'raster', source: 'raster-tiles', minzoom: 0, maxzoom: 22 }],
  };
}

// ── Activities ─────────────────────────────────────────────────────────────
const ACTIVITIES: { id: ActivityType; label: string; iconEl: typeof Activity }[] = [
  { id: 'run',         label: 'Run',         iconEl: Activity      },
  { id: 'walk',        label: 'Walk',        iconEl: Footprints    },
  { id: 'jog',         label: 'Jog',         iconEl: Gauge         },
  { id: 'cycle',       label: 'Cycle',       iconEl: Bike          },
  { id: 'hike',        label: 'Hike',        iconEl: Mountain      },
  { id: 'trail_run',   label: 'Trail Run',   iconEl: TreePine      },
  { id: 'sprint',      label: 'Sprint',      iconEl: Zap           },
  { id: 'wheelchair',  label: 'Wheelchair',  iconEl: Accessibility },
];

// ── GPS signal bars ────────────────────────────────────────────────────────
function SignalBars({ strength }: { strength: SignalStrength }) {
  const colors: Record<SignalStrength, string> = { strong: '#14B8A6', moderate: '#EAB308', weak: '#F87171', searching: '#D1D5DB' };
  const activeBars = strength === 'strong' ? 3 : strength === 'moderate' ? 2 : strength === 'weak' ? 1 : 0;
  const color = colors[strength];
  return (
    <svg width="18" height="16" viewBox="0 0 18 16" className={strength === 'searching' ? 'animate-pulse' : ''}>
      <rect x="0" y="10" width="4" height="6" rx="1" fill={activeBars >= 1 ? color : '#E5E7EB'} />
      <rect x="7" y="5" width="4" height="11" rx="1" fill={activeBars >= 2 ? color : '#E5E7EB'} />
      <rect x="14" y="0" width="4" height="16" rx="1" fill={activeBars >= 3 ? color : '#E5E7EB'} />
    </svg>
  );
}
function getSignalStrength(acc: number | null, state: GpsState): SignalStrength {
  if (state !== 'ready' || acc === null) return 'searching';
  if (acc < 20) return 'strong';
  if (acc < 50) return 'moderate';
  return 'weak';
}

// ── Activity Dial (drum scroll picker) ────────────────────────────────────
const ITEM_H = 60;
function ActivityDial({ value, onChange, onClose }: { value: ActivityType; onChange: (v: ActivityType) => void; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollIdx, setScrollIdx] = useState(() => ACTIVITIES.findIndex(a => a.id === value));

  useEffect(() => {
    const idx = ACTIVITIES.findIndex(a => a.id === value);
    if (containerRef.current) containerRef.current.scrollTop = idx * ITEM_H;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const idx = Math.max(0, Math.min(ACTIVITIES.length - 1, Math.round(containerRef.current.scrollTop / ITEM_H)));
    setScrollIdx(idx);
    if (ACTIVITIES[idx].id !== value) {
      onChange(ACTIVITIES[idx].id);
      haptic('light');
    }
  };

  return (
    <div className="bg-white rounded-t-3xl px-6 pt-4 pb-8">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base font-bold text-gray-900">Activity</h3>
        <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
          <X className="w-4 h-4 text-gray-500" strokeWidth={2} />
        </button>
      </div>
      <p className="text-[11px] text-gray-400 mb-4">Scroll to choose your activity</p>

      <div style={{ position: 'relative', height: ITEM_H * 5, overflow: 'hidden' }}>
        {/* Center highlight band */}
        <div style={{ position: 'absolute', top: ITEM_H * 2, height: ITEM_H, left: 0, right: 0, background: 'rgba(0,180,198,0.07)', borderTop: '1.5px solid rgba(0,180,198,0.2)', borderBottom: '1.5px solid rgba(0,180,198,0.2)', zIndex: 1, pointerEvents: 'none', borderRadius: 12 }} />

        {/* Scroll container */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          style={{ height: '100%', overflowY: 'scroll', scrollSnapType: 'y mandatory', paddingTop: ITEM_H * 2, paddingBottom: ITEM_H * 2 }}
          className="no-scrollbar"
        >
          {ACTIVITIES.map((a, i) => {
            const Icon = a.iconEl;
            const dist = Math.abs(i - scrollIdx);
            const scale = dist === 0 ? 1.12 : dist === 1 ? 0.86 : 0.70;
            const opacity = dist === 0 ? 1 : dist === 1 ? 0.45 : 0.18;
            return (
              <div
                key={a.id}
                onClick={() => {
                  const container = containerRef.current;
                  if (container) container.scrollTo({ top: i * ITEM_H, behavior: 'smooth' });
                  onChange(a.id);
                  setScrollIdx(i);
                  haptic('light');
                }}
                style={{ scrollSnapAlign: 'center', height: ITEM_H, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, transform: `scale(${scale})`, opacity, transition: 'transform 0.18s ease, opacity 0.18s ease', cursor: 'pointer' }}
              >
                <Icon style={{ width: dist === 0 ? 28 : 22, height: dist === 0 ? 28 : 22, color: dist === 0 ? '#0D9488' : '#9CA3AF', strokeWidth: dist === 0 ? 2.2 : 1.5 }} />
                <span style={{ fontSize: dist === 0 ? 18 : 14, fontWeight: dist === 0 ? 700 : 500, color: dist === 0 ? '#111827' : '#9CA3AF' }}>{a.label}</span>
              </div>
            );
          })}
        </div>

        {/* Fade gradients */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: ITEM_H * 2, background: 'linear-gradient(to bottom, white 50%, transparent)', pointerEvents: 'none', zIndex: 2 }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: ITEM_H * 2, background: 'linear-gradient(to top, white 50%, transparent)', pointerEvents: 'none', zIndex: 2 }} />
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function RunScreen() {
  const navigate = useNavigate();

  const [activityType, setActivityType]     = useState<ActivityType>('run');
  const [gpsStatus, setGpsStatus]           = useState<GpsState>('searching');
  const [gpsAccuracy, setGpsAccuracy]       = useState<number | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showGpsLoader, setShowGpsLoader]   = useState(true);
  const [showActivityDial, setShowActivityDial] = useState(false);
  const [showRoutePicker, setShowRoutePicker]   = useState(false);
  const [mapStyle, setMapStyle]             = useState<MapStyleId>('standard');
  const [showStylePicker, setShowStylePicker]   = useState(false);
  const [isLocating, setIsLocating]         = useState(false);

  // Territory intel
  const [intelStats, setIntelStats] = useState({ enemy: 0, neutral: 0, weak: 0 });
  const [missions, setMissions]     = useState<Mission[]>([]);

  const mapContainer    = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<maplibregl.Map | null>(null);
  const userMarkerRef   = useRef<maplibregl.Marker | null>(null);
  const userLngLatRef   = useRef<[number, number] | null>(null);
  const watchIdRef      = useRef<number | null>(null);
  const gpsReadyRef     = useRef(false);
  const territoriesRef  = useRef<StoredTerritory[]>([]);

  // GPS loader min 3s
  useEffect(() => {
    const t = setTimeout(() => { if (gpsReadyRef.current) setShowGpsLoader(false); }, 3000);
    return () => clearTimeout(t);
  }, []);

  // Load territory intel + missions
  useEffect(() => {
    (async () => {
      const p = await getPlayer();
      const territories = await getAllTerritories();
      if (p) {
        const enemy   = territories.filter(t => t.ownerId && t.ownerId !== p.id).length;
        const neutral = territories.filter(t => !t.ownerId).length;
        const weak    = territories.filter(t => t.ownerId && t.ownerId !== p.id && t.defense < 40).length;
        setIntelStats({ enemy, neutral, weak });
      }
      const m = await getTodaysMissions();
      setMissions(m.slice(0, 3));
    })();
  }, []);

  // Init map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [77.2090, 28.6139],
      zoom: 15,
      attributionControl: false,
    });

    map.on('load', async () => {
      mapRef.current = map;
      setTimeout(() => map.resize(), 0);

      const p = await getPlayer();
      if (p) {
        const territories = await getAllTerritories();
        territoriesRef.current = territories;
        addTerritoryOverlay(map, territories, { playerId: p.id, showLabels: false });
      }

      const markerEl = document.createElement('div');
      markerEl.innerHTML = `
        <div style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;inset:0;border-radius:50%;background:rgba(0,180,198,0.15);animation:run-pulse 2s ease-out infinite;"></div>
          <div style="width:14px;height:14px;border-radius:50%;background:#00B4C6;border:3px solid white;box-shadow:0 2px 8px rgba(0,180,198,0.4);position:relative;z-index:1;"></div>
        </div>`;
      const marker = new maplibregl.Marker({ element: markerEl, anchor: 'center' }).setLngLat([77.2090, 28.6139]);
      userMarkerRef.current = marker;

      watchIdRef.current = navigator.geolocation.watchPosition(
        pos => {
          const lngLat: [number, number] = [pos.coords.longitude, pos.coords.latitude];
          userLngLatRef.current = lngLat;
          setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setGpsAccuracy(pos.coords.accuracy);
          setGpsStatus('ready');
          gpsReadyRef.current = true;
          setShowGpsLoader(false);
          if (userMarkerRef.current) {
            userMarkerRef.current.setLngLat(lngLat);
            if (!userMarkerRef.current.getElement().parentElement) userMarkerRef.current.addTo(map);
          }
          if (!map.getBounds().contains(lngLat)) map.flyTo({ center: lngLat, zoom: 15, duration: 800 });
        },
        () => setGpsStatus('error'),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
      );
    });

    const styleEl = document.createElement('style');
    styleEl.textContent = `@keyframes run-pulse { 0%{transform:scale(0.5);opacity:1} 100%{transform:scale(1.8);opacity:0} }`;
    document.head.appendChild(styleEl);

    const ro = new ResizeObserver(() => { if (mapRef.current) mapRef.current.resize(); });
    ro.observe(mapContainer.current);

    return () => {
      ro.disconnect();
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      styleEl.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const recenterMap = () => {
    haptic('light');
    if (userLngLatRef.current && mapRef.current) { mapRef.current.flyTo({ center: userLngLatRef.current, zoom: 15, duration: 800 }); return; }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lngLat: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        userLngLatRef.current = lngLat;
        mapRef.current?.flyTo({ center: lngLat, zoom: 15, duration: 800 });
        if (userMarkerRef.current && mapRef.current) {
          userMarkerRef.current.setLngLat(lngLat);
          if (!userMarkerRef.current.getElement().parentElement) userMarkerRef.current.addTo(mapRef.current);
        }
        setIsLocating(false);
      },
      () => setIsLocating(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const changeMapStyle = (styleId: MapStyleId) => {
    if (!mapRef.current || styleId === mapStyle) return;
    setMapStyle(styleId);
    setShowStylePicker(false);
    haptic('light');
    const styleDef = MAP_STYLES.find(s => s.id === styleId)!;
    const center = mapRef.current.getCenter();
    const zoom = mapRef.current.getZoom();
    mapRef.current.setStyle(styleDef.rasterTiles ? buildRasterStyle(styleDef.rasterTiles, styleDef.sourceMaxZoom) : styleDef.styleUrl!);
    mapRef.current.once('style.load', async () => {
      mapRef.current?.jumpTo({ center, zoom });
      const p = await getPlayer();
      if (p && mapRef.current) addTerritoryOverlay(mapRef.current, territoriesRef.current, { playerId: p.id, showLabels: false });
      if (userMarkerRef.current && userLngLatRef.current && mapRef.current) {
        userMarkerRef.current.setLngLat(userLngLatRef.current);
        if (!userMarkerRef.current.getElement().parentElement) userMarkerRef.current.addTo(mapRef.current);
      }
    });
  };

  const handleStart = () => {
    if (gpsStatus === 'ready' && currentLocation) {
      navigate('/active-run', { state: { activityType, startLocation: currentLocation } });
      haptic('medium');
    }
  };

  const signalStrength = getSignalStrength(gpsAccuracy, gpsStatus);
  const currentActivity = ACTIVITIES.find(a => a.id === activityType)!;
  const CurrentIcon = currentActivity.iconEl;

  return (
    <div className="fixed inset-0 flex flex-col bg-gray-100" style={{ height: '100dvh' }}>

      {/* ── MAP SECTION (75%) ──────────────────────────────────────── */}
      <div className="relative" style={{ height: '75%', flexShrink: 0 }}>
        <div ref={mapContainer} className="absolute inset-0 w-full h-full" />

        {/* Back / home button — top left */}
        <button
          onClick={() => navigate('/home')}
          className="absolute left-4 z-10 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full shadow-md border border-gray-100 flex items-center justify-center active:scale-90 transition"
          style={{ top: 'max(12px, env(safe-area-inset-top))' }}
        >
          <ChevronDown className="w-5 h-5 text-gray-600" strokeWidth={2.2} />
        </button>

        {/* GPS signal — top right */}
        <div
          className="absolute right-4 z-10 bg-white/90 backdrop-blur-sm rounded-xl px-3 py-2 flex items-center gap-2 shadow-sm border border-gray-100"
          style={{ top: 'max(12px, env(safe-area-inset-top))' }}
        >
          <SignalBars strength={signalStrength} />
          <span className="text-[10px] font-medium text-gray-500">GPS</span>
        </div>

        {/* Locate + Layers — right center */}
        <div className="absolute right-4 z-10 flex flex-col gap-2" style={{ top: '50%', transform: 'translateY(-50%)' }}>
          <button
            onClick={recenterMap}
            className={`w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm shadow-md border border-gray-100 flex items-center justify-center active:scale-90 transition ${isLocating ? 'animate-pulse' : ''}`}
          >
            <Crosshair className={`w-[18px] h-[18px] ${isLocating ? 'text-teal-500' : 'text-gray-500'}`} strokeWidth={2} />
          </button>
          <button
            onClick={() => { setShowStylePicker(!showStylePicker); haptic('light'); }}
            className={`w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm shadow-md border border-gray-100 flex items-center justify-center active:scale-90 transition ${showStylePicker ? 'ring-2 ring-teal-400' : ''}`}
          >
            <Layers className="w-[18px] h-[18px] text-gray-500" strokeWidth={2} />
          </button>
        </div>

        {/* Map Style Picker popover */}
        <AnimatePresence>
          {showStylePicker && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-20" onClick={() => setShowStylePicker(false)} />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, x: 8 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9, x: 8 }}
                transition={{ type: 'spring', damping: 22, stiffness: 300 }}
                className="absolute right-16 z-30 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 w-[200px]"
                style={{ top: '50%', transform: 'translateY(-50%)' }}
              >
                <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold block mb-2 px-1">Map Type</span>
                <div className="grid grid-cols-3 gap-2">
                  {MAP_STYLES.map(s => (
                    <button key={s.id} onClick={() => changeMapStyle(s.id)} className="flex flex-col items-center gap-1">
                      <div className={`w-14 h-14 rounded-xl border-2 transition-all ${mapStyle === s.id ? 'border-teal-500 shadow-sm' : 'border-gray-200'}`} style={{ backgroundColor: s.preview }} />
                      <span className={`text-[10px] font-medium ${mapStyle === s.id ? 'text-teal-600' : 'text-gray-500'}`}>{s.label}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* GPS Loader overlay */}
        <AnimatePresence>
          {showGpsLoader && (
            <motion.div
              initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center z-20"
            >
              <motion.div
                animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                className="w-10 h-10 rounded-full mb-3"
                style={{ borderWidth: '3px', borderStyle: 'solid', borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }}
              />
              <span className="text-white text-sm font-medium">Fetching GPS...</span>
              <span className="text-white/60 text-[11px] mt-1">Finding your position</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Distance card floating near bottom of map (leaves ~14px map strip below) */}
        <div className="absolute left-4 right-4 z-10" style={{ bottom: 14 }}>
          <div className="bg-white/92 backdrop-blur-xl rounded-2xl shadow-lg border border-white/70 px-5 py-3">
            <div className="text-center mb-1.5">
              <span className="text-3xl font-bold text-gray-900 tracking-tight font-mono">0.00</span>
              <span className="text-xs text-gray-400 font-medium ml-1">km</span>
            </div>
            <div className="flex items-center justify-center gap-5">
              <div className="text-center">
                <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Time</div>
                <div className="text-base font-bold text-gray-800 font-mono">0:00</div>
              </div>
              <div className="w-px h-6 bg-gray-200" />
              <div className="text-center">
                <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Pace</div>
                <div className="text-base font-bold text-gray-800 font-mono">0:00<span className="text-[10px] text-gray-400 font-normal">/km</span></div>
              </div>
              <div className="w-px h-6 bg-gray-200" />
              <div className="text-center">
                <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Zones</div>
                <div className="text-base font-bold text-gray-800 font-mono">0</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM SCROLLABLE CARD (25%) ───────────────────────────── */}
      <div className="flex-1 bg-white overflow-y-auto" style={{ minHeight: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-9 h-1 rounded-full bg-gray-200" />
        </div>

        {/* 3 buttons */}
        <div className="flex items-center justify-center gap-6 py-3 px-6">
          {/* Activity */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => { setShowActivityDial(true); haptic('light'); }}
            className="w-14 h-14 rounded-full bg-gray-50 border border-gray-200 flex flex-col items-center justify-center shadow-sm"
          >
            <CurrentIcon className="w-5 h-5 text-teal-600" strokeWidth={2} />
            <span className="text-[8px] font-bold text-gray-500 mt-0.5">{currentActivity.label}</span>
          </motion.button>

          {/* START */}
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={handleStart}
            disabled={gpsStatus !== 'ready'}
            className={`w-20 h-20 rounded-full flex flex-col items-center justify-center transition-all ${
              gpsStatus === 'ready'
                ? 'bg-gradient-to-br from-teal-500 to-teal-600 shadow-[0_6px_24px_rgba(0,180,198,0.38)]'
                : 'bg-gray-300 shadow-md'
            }`}
          >
            <svg width="22" height="26" viewBox="0 0 28 32" fill="white">
              <path d="M2 0L28 16L2 32V0Z" />
            </svg>
            <span className="text-[9px] font-bold text-white mt-1">
              {gpsStatus === 'ready' ? 'START' : 'GPS...'}
            </span>
          </motion.button>

          {/* Route */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => { setShowRoutePicker(true); haptic('light'); }}
            className="w-14 h-14 rounded-full bg-gray-50 border border-gray-200 flex flex-col items-center justify-center shadow-sm"
          >
            <Route className="w-5 h-5 text-gray-500" strokeWidth={2} />
            <span className="text-[8px] font-bold text-gray-500 mt-0.5">Route</span>
          </motion.button>
        </div>

        {/* Territory Intel — visible on scroll */}
        <div className="px-4 pb-8 space-y-3">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">Territory Intel</h3>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-red-50 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-red-500 font-mono">{intelStats.enemy}</div>
              <div className="text-[10px] text-red-400 font-semibold mt-0.5">Enemy</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-gray-500 font-mono">{intelStats.neutral}</div>
              <div className="text-[10px] text-gray-400 font-semibold mt-0.5">Free</div>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-amber-500 font-mono">{intelStats.weak}</div>
              <div className="text-[10px] text-amber-400 font-semibold mt-0.5">Weak</div>
            </div>
          </div>

          {missions.length > 0 && (
            <>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1 pt-1">Active Missions</h3>
              <div className="space-y-2">
                {missions.map(m => (
                  <div key={m.id} className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[12px] font-semibold text-gray-700">{m.title}</span>
                      <span className="text-[11px] font-bold text-teal-600">{m.rewards.xp} XP</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (m.current / m.target) * 100)}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1">{m.current} / {m.target}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── ACTIVITY DIAL MODAL ────────────────────────────────────── */}
      <AnimatePresence>
        {showActivityDial && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/30 z-40" onClick={() => setShowActivityDial(false)} />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="absolute bottom-0 left-0 right-0 z-50"
              style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
            >
              <ActivityDial
                value={activityType}
                onChange={v => setActivityType(v)}
                onClose={() => setShowActivityDial(false)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── ROUTE PICKER MODAL ────────────────────────────────────── */}
      <AnimatePresence>
        {showRoutePicker && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/30 z-40" onClick={() => setShowRoutePicker(false)} />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="absolute bottom-0 left-0 right-0 z-50"
              style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
            >
              <div className="bg-white rounded-t-3xl px-6 pt-4 pb-8">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-base font-bold text-gray-900">Routes</h3>
                  <button onClick={() => setShowRoutePicker(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                    <X className="w-4 h-4 text-gray-500" strokeWidth={2} />
                  </button>
                </div>
                <div className="space-y-3">
                  <button
                    onClick={() => { setShowRoutePicker(false); haptic('light'); }}
                    className="w-full flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 active:scale-98 transition"
                  >
                    <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
                      <BookmarkPlus className="w-5 h-5 text-teal-600" strokeWidth={2} />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-bold text-gray-800">Save Route</div>
                      <div className="text-[11px] text-gray-400">Save your current path</div>
                    </div>
                  </button>
                  <button
                    onClick={() => { setShowRoutePicker(false); haptic('light'); }}
                    className="w-full flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 active:scale-98 transition"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                      <Search className="w-5 h-5 text-blue-600" strokeWidth={2} />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-bold text-gray-800">Find Routes Near Me</div>
                      <div className="text-[11px] text-gray-400">Discover popular routes nearby</div>
                    </div>
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

export { RunScreen };
