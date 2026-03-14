import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform, animate, PanInfo } from 'framer-motion';
import {
  Activity, Footprints, Bike, Mountain, Gauge, TreePine, Zap, Accessibility,
  Route, X, Crosshair, Layers, ChevronDown,
  Dumbbell, Waves, Snowflake, Flame, Timer, TrendingUp, Shuffle,
} from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getAllTerritories, getPlayer, StoredTerritory, getSavedRoutes, StoredSavedRoute } from '@shared/services/store';
import { useTheme } from '@shared/hooks/useTheme';
import { addTerritoryOverlay } from '@features/territory/services/territoryLayer';
import { getTodaysMissions } from '@features/missions/services/missionStore';
import { findRoutesNearby } from '@shared/services/sync';
import { haptic } from '@shared/lib/haptics';
import type { Mission } from '@features/missions/services/missions';

// ── Types ──────────────────────────────────────────────────────────────────
type ActivityType = 'run' | 'walk' | 'jog' | 'cycle' | 'hike' | 'trail_run' | 'sprint' | 'wheelchair'
  | 'interval' | 'tempo' | 'fartlek' | 'cross_country' | 'swim' | 'strength' | 'hiit' | 'ski'
  | 'stair_climb' | 'race';
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
interface ActivityDef { id: ActivityType; label: string; iconEl: typeof Activity; color: string; bg: string; category: 'running' | 'outdoor' | 'training' | 'other' }
const ACTIVITIES: ActivityDef[] = [
  // Running
  { id: 'run',           label: 'Run',           iconEl: Activity,      color: '#0D9488', bg: '#CCFBF1', category: 'running' },
  { id: 'jog',           label: 'Jog',           iconEl: Gauge,         color: '#0891B2', bg: '#CFFAFE', category: 'running' },
  { id: 'sprint',        label: 'Sprint',        iconEl: Zap,           color: '#DC2626', bg: '#FEE2E2', category: 'running' },
  { id: 'interval',      label: 'Intervals',     iconEl: Timer,         color: '#7C3AED', bg: '#EDE9FE', category: 'running' },
  { id: 'tempo',         label: 'Tempo',         iconEl: TrendingUp,    color: '#EA580C', bg: '#FFEDD5', category: 'running' },
  { id: 'fartlek',       label: 'Fartlek',       iconEl: Shuffle,       color: '#2563EB', bg: '#DBEAFE', category: 'running' },
  { id: 'race',          label: 'Race',          iconEl: Flame,         color: '#E11D48', bg: '#FFE4E6', category: 'running' },
  // Outdoor
  { id: 'walk',          label: 'Walk',          iconEl: Footprints,    color: '#059669', bg: '#D1FAE5', category: 'outdoor' },
  { id: 'hike',          label: 'Hike',          iconEl: Mountain,      color: '#B45309', bg: '#FEF3C7', category: 'outdoor' },
  { id: 'trail_run',     label: 'Trail Run',     iconEl: TreePine,      color: '#15803D', bg: '#DCFCE7', category: 'outdoor' },
  { id: 'cross_country', label: 'Cross Country', iconEl: Route,         color: '#4338CA', bg: '#E0E7FF', category: 'outdoor' },
  { id: 'cycle',         label: 'Cycle',         iconEl: Bike,          color: '#0284C7', bg: '#E0F2FE', category: 'outdoor' },
  { id: 'stair_climb',   label: 'Stairs',        iconEl: TrendingUp,    color: '#9333EA', bg: '#F3E8FF', category: 'outdoor' },
  // Training
  { id: 'hiit',          label: 'HIIT',          iconEl: Flame,         color: '#DC2626', bg: '#FEE2E2', category: 'training' },
  { id: 'strength',      label: 'Strength',      iconEl: Dumbbell,      color: '#4B5563', bg: '#F3F4F6', category: 'training' },
  { id: 'swim',          label: 'Swim',          iconEl: Waves,         color: '#0369A1', bg: '#E0F2FE', category: 'training' },
  // Other
  { id: 'wheelchair',    label: 'Wheelchair',    iconEl: Accessibility, color: '#6D28D9', bg: '#EDE9FE', category: 'other' },
  { id: 'ski',           label: 'Ski / Snow',    iconEl: Snowflake,     color: '#0EA5E9', bg: '#E0F2FE', category: 'other' },
];
const CATEGORIES: { key: ActivityDef['category']; label: string }[] = [
  { key: 'running', label: 'Running' },
  { key: 'outdoor', label: 'Outdoor' },
  { key: 'training', label: 'Training' },
  { key: 'other', label: 'Other' },
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

// ── Activity Picker (categorised grid) ───────────────────────────────────
function ActivityPicker({ value, onChange, onClose }: { value: ActivityType; onChange: (v: ActivityType) => void; onClose: () => void }) {
  const selected = ACTIVITIES.find(a => a.id === value)!;

  return (
    <div className="bg-white rounded-t-3xl px-5 pt-4 pb-8 max-h-[70vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Choose Activity</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">Select your workout type</p>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
          <X className="w-4 h-4 text-gray-500" strokeWidth={2} />
        </button>
      </div>

      {/* Current selection chip */}
      <div className="flex items-center gap-3 rounded-2xl p-3 mb-5 border-2 border-teal-200 bg-teal-50/50">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: selected.bg }}>
          <selected.iconEl className="w-5 h-5" style={{ color: selected.color }} strokeWidth={2.2} />
        </div>
        <div className="flex-1">
          <span className="text-sm font-bold text-gray-900">{selected.label}</span>
          <span className="text-[10px] text-gray-400 block capitalize">{selected.category}</span>
        </div>
        <div className="w-5 h-5 rounded-full bg-teal-500 flex items-center justify-center">
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      </div>

      {/* Categorised grid */}
      {CATEGORIES.map(cat => {
        const items = ACTIVITIES.filter(a => a.category === cat.key);
        if (items.length === 0) return null;
        return (
          <div key={cat.key} className="mb-4">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] mb-2 px-0.5">{cat.label}</h4>
            <div className="grid grid-cols-4 gap-2">
              {items.map(a => {
                const Icon = a.iconEl;
                const isActive = a.id === value;
                return (
                  <motion.button
                    key={a.id}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => { onChange(a.id); haptic('light'); }}
                    className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded-2xl border-2 transition-all ${
                      isActive
                        ? 'border-teal-400 shadow-sm'
                        : 'border-transparent hover:bg-gray-50'
                    }`}
                    style={isActive ? { backgroundColor: a.bg + '80' } : {}}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: isActive ? a.bg : '#F3F4F6' }}
                    >
                      <Icon
                        className="w-5 h-5"
                        style={{ color: isActive ? a.color : '#9CA3AF' }}
                        strokeWidth={isActive ? 2.2 : 1.8}
                      />
                    </div>
                    <span className={`text-[10px] font-semibold leading-tight text-center ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                      {a.label}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function RunScreen() {
  const navigate = useNavigate();
  const { dark } = useTheme();

  const [activityType, setActivityType]     = useState<ActivityType>('run');
  const [gps, setGps] = useState<{ status: GpsState; accuracy: number | null; location: { lat: number; lng: number } | null }>({
    status: 'searching', accuracy: null, location: null,
  });
  const [showGpsLoader, setShowGpsLoader]   = useState(true);
  const [showActivityDial, setShowActivityDial] = useState(false);
  const [showRoutePicker, setShowRoutePicker]   = useState(false);
  const [mapStyle, setMapStyle]             = useState<MapStyleId>(() => dark ? 'dark' : 'standard');
  const [showStylePicker, setShowStylePicker]   = useState(false);
  const [isLocating, setIsLocating]         = useState(false);

  // Territory intel
  const [intelStats, setIntelStats] = useState({ enemy: 0, neutral: 0, weak: 0 });
  const [missions, setMissions]     = useState<Mission[]>([]);

  // Saved routes
  const [savedRoutes, setSavedRoutes] = useState<StoredSavedRoute[]>([]);
  const [nearbyRoutes, setNearbyRoutes] = useState<{ id: string; name: string; emoji: string; distanceM: number; durationSec: number | null; gpsPoints: { lat: number; lng: number }[]; username: string; distM: number }[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<{ name: string; gpsPoints: { lat: number; lng: number }[] } | null>(null);

  const mapContainer    = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<maplibregl.Map | null>(null);
  const userMarkerRef   = useRef<maplibregl.Marker | null>(null);
  const userLngLatRef   = useRef<[number, number] | null>(null);
  const watchIdRef      = useRef<number | null>(null);
  const gpsReadyRef     = useRef(false);
  const territoriesRef  = useRef<StoredTerritory[]>([]);
  const lastGpsUpdateRef = useRef<number>(0);

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

    const initialStyle = MAP_STYLES.find(s => s.id === (dark ? 'dark' : 'standard'))!;
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: initialStyle.styleUrl!,
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

          // Always update marker position (DOM-only, no React re-render)
          if (userMarkerRef.current) {
            userMarkerRef.current.setLngLat(lngLat);
            if (!userMarkerRef.current.getElement().parentElement) userMarkerRef.current.addTo(map);
          }

          // Throttle React state updates to max 1 per 2 seconds
          const now = Date.now();
          if (now - lastGpsUpdateRef.current < 2000 && gpsReadyRef.current) return;
          lastGpsUpdateRef.current = now;

          setGps({ status: 'ready', accuracy: pos.coords.accuracy, location: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
          gpsReadyRef.current = true;
          setShowGpsLoader(false);
          if (!map.getBounds().contains(lngLat)) map.flyTo({ center: lngLat, zoom: 15, duration: 800 });
        },
        () => setGps(prev => ({ ...prev, status: 'error' })),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
      );
    });

    const ro = new ResizeObserver(() => { if (mapRef.current) mapRef.current.resize(); });
    ro.observe(mapContainer.current);

    return () => {
      ro.disconnect();
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
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

  // Sync map style when dark mode toggles
  useEffect(() => {
    changeMapStyle(dark ? 'dark' : 'standard');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark]);

  // Load saved routes when picker opens
  const openRoutePicker = async () => {
    setShowRoutePicker(true);
    haptic('light');
    const routes = await getSavedRoutes();
    setSavedRoutes(routes);
  };

  const handleFindNearby = async () => {
    if (!gps.location) return;
    setNearbyLoading(true);
    try {
      const results = await findRoutesNearby(gps.location.lng, gps.location.lat, 5000);
      setNearbyRoutes(results);
    } catch (e) {
      console.warn('findRoutesNearby error:', e);
    } finally {
      setNearbyLoading(false);
    }
  };

  const selectRoute = (route: { name: string; gpsPoints: { lat: number; lng: number }[] }) => {
    setSelectedRoute(route);
    setShowRoutePicker(false);
    haptic('medium');
  };

  const handleStart = () => {
    if (gps.status === 'ready' && gps.location) {
      navigate('/active-run', {
        state: {
          activityType,
          startLocation: gps.location,
          ghostRoute: selectedRoute ? selectedRoute.gpsPoints : undefined,
        },
      });
      haptic('medium');
    }
  };

  // ── Bottom sheet snap logic ──────────────────────────────────
  const COLLAPSED_H = 240;   // px – buttons + stats visible
  const EXPANDED_H_RATIO = 0.6; // 60% of screen when expanded
  const [windowH, setWindowH] = useState(() => window.innerHeight);
  useEffect(() => {
    const onResize = () => setWindowH(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const expandedH = Math.round(windowH * EXPANDED_H_RATIO);

  const sheetH = useMotionValue(COLLAPSED_H);
  const [isExpanded, setIsExpanded] = useState(false);
  const mapHeight = useTransform(sheetH, (h: number) => windowH - h);

  // Snap to nearest stop after drag
  const handleDragEnd = useCallback((_: unknown, info: PanInfo) => {
    const cur = sheetH.get();
    const vel = info.velocity.y;
    // Flick up → expand, flick down → collapse
    let target: number;
    if (vel < -300) target = expandedH;
    else if (vel > 300) target = COLLAPSED_H;
    else target = cur > (COLLAPSED_H + expandedH) / 2 ? expandedH : COLLAPSED_H;

    animate(sheetH, target, { type: 'spring', damping: 30, stiffness: 300 });
    setIsExpanded(target === expandedH);
  }, [sheetH, expandedH]);

  // Resize map when sheet height changes
  useEffect(() => {
    const unsub = sheetH.on('change', () => {
      if (mapRef.current) mapRef.current.resize();
    });
    return unsub;
  }, [sheetH]);

  const signalStrength = getSignalStrength(gps.accuracy, gps.status);
  const currentActivity = ACTIVITIES.find(a => a.id === activityType)!;
  const CurrentIcon = currentActivity.iconEl;

  return (
    <div className="fixed inset-0 flex flex-col bg-gray-100" style={{ height: '100dvh' }}>

      {/* ── MAP SECTION (responsive) ──────────────────────────────── */}
      <motion.div className="relative flex-shrink-0" style={{ height: mapHeight }}>
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
      </motion.div>

      {/* ── DRAGGABLE BOTTOM SHEET ─────────────────────────────────── */}
      <motion.div
        className="bg-white rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)] border-t border-gray-200 flex flex-col overflow-hidden z-20"
        style={{ height: sheetH, touchAction: 'none' }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.1}
        onDrag={(_: unknown, info: PanInfo) => {
          const newH = Math.max(COLLAPSED_H, Math.min(expandedH, sheetH.get() - info.delta.y));
          sheetH.set(newH);
        }}
        onDragEnd={handleDragEnd}
      >
        {/* Drag handle */}
        <div
          className="flex justify-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing"
          onDoubleClick={() => {
            const target = isExpanded ? COLLAPSED_H : expandedH;
            animate(sheetH, target, { type: 'spring', damping: 30, stiffness: 300 });
            setIsExpanded(!isExpanded);
          }}
        >
          <div className="w-9 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Stats strip */}
        <div className="px-5 pt-1 pb-2">
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
              <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Calories</div>
              <div className="text-base font-bold text-gray-800 font-mono">0<span className="text-[10px] text-gray-400 font-normal">kcal</span></div>
            </div>
          </div>
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
            disabled={gps.status !== 'ready'}
            className={`w-20 h-20 rounded-full flex flex-col items-center justify-center transition-all ${
              gps.status === 'ready'
                ? 'bg-gradient-to-br from-teal-500 to-teal-600 shadow-[0_6px_24px_rgba(0,180,198,0.38)]'
                : 'bg-gray-300 shadow-md'
            }`}
          >
            <svg width="22" height="26" viewBox="0 0 28 32" fill="white">
              <path d="M2 0L28 16L2 32V0Z" />
            </svg>
            <span className="text-[9px] font-bold text-white mt-1">
              {gps.status === 'ready' ? 'START' : 'GPS...'}
            </span>
          </motion.button>

          {/* Route */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={openRoutePicker}
            className={`w-14 h-14 rounded-full flex flex-col items-center justify-center shadow-sm ${
              selectedRoute
                ? 'bg-teal-50 border-2 border-teal-300'
                : 'bg-gray-50 border border-gray-200'
            }`}
          >
            <Route className={`w-5 h-5 ${selectedRoute ? 'text-teal-600' : 'text-gray-500'}`} strokeWidth={2} />
            <span className={`text-[8px] font-bold mt-0.5 ${selectedRoute ? 'text-teal-600' : 'text-gray-500'}`}>
              {selectedRoute ? 'Route ✓' : 'Route'}
            </span>
          </motion.button>
        </div>

        {/* Expanded content — Territory Intel + Missions (scrollable) */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-8 space-y-3">
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
      </motion.div>

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
              <ActivityPicker
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
              <div className="bg-white rounded-t-3xl px-5 pt-4 pb-8 max-h-[75vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Routes</h3>
                  <button onClick={() => setShowRoutePicker(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                    <X className="w-4 h-4 text-gray-500" strokeWidth={2} />
                  </button>
                </div>

                {/* Clear selection */}
                {selectedRoute && (
                  <button
                    onClick={() => { setSelectedRoute(null); haptic('light'); }}
                    className="w-full mb-3 flex items-center gap-3 p-3 bg-teal-50 rounded-2xl border border-teal-200 active:scale-[0.98] transition"
                  >
                    <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center">
                      <X className="w-4 h-4 text-teal-600" strokeWidth={2} />
                    </div>
                    <div className="text-left flex-1">
                      <div className="text-sm font-semibold text-teal-700">Following: {selectedRoute.name}</div>
                      <div className="text-[10px] text-teal-500">Tap to clear route</div>
                    </div>
                  </button>
                )}

                {/* My Routes */}
                <div className="mb-4">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] mb-2 px-0.5">My Routes</h4>
                  {savedRoutes.length === 0 ? (
                    <p className="text-xs text-gray-400 px-1 py-3">No saved routes yet. Finish a run and save the route!</p>
                  ) : (
                    <div className="space-y-2">
                      {savedRoutes.map(r => (
                        <button
                          key={r.id}
                          onClick={() => selectRoute({ name: `${r.emoji} ${r.name}`, gpsPoints: r.gpsPoints })}
                          className="w-full flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100 active:scale-[0.98] transition"
                        >
                          <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-lg">
                            {r.emoji}
                          </div>
                          <div className="text-left flex-1 min-w-0">
                            <div className="text-sm font-semibold text-gray-800 truncate">{r.name}</div>
                            <div className="text-[11px] text-gray-400">
                              {(r.distanceM / 1000).toFixed(2)} km
                              {r.durationSec ? ` · ${Math.floor(r.durationSec / 60)}min` : ''}
                            </div>
                          </div>
                          <Route className="w-4 h-4 text-gray-300" strokeWidth={2} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Find Nearby */}
                <div>
                  <div className="flex items-center justify-between mb-2 px-0.5">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em]">Nearby Routes</h4>
                    <button
                      onClick={handleFindNearby}
                      disabled={nearbyLoading || gps.status !== 'ready'}
                      className="text-[11px] font-semibold text-blue-500 active:text-blue-700 disabled:text-gray-300"
                    >
                      {nearbyLoading ? 'Searching...' : 'Find Routes'}
                    </button>
                  </div>
                  {nearbyRoutes.length === 0 ? (
                    <p className="text-xs text-gray-400 px-1 py-3">
                      {nearbyLoading ? 'Looking for routes nearby...' : 'Tap "Find Routes" to discover routes near you'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {nearbyRoutes.map(r => (
                        <button
                          key={r.id}
                          onClick={() => selectRoute({ name: `${r.emoji} ${r.name}`, gpsPoints: r.gpsPoints })}
                          className="w-full flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100 active:scale-[0.98] transition"
                        >
                          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-lg">
                            {r.emoji}
                          </div>
                          <div className="text-left flex-1 min-w-0">
                            <div className="text-sm font-semibold text-gray-800 truncate">{r.name}</div>
                            <div className="text-[11px] text-gray-400">
                              {(r.distanceM / 1000).toFixed(2)} km · by {r.username} · {(r.distM / 1000).toFixed(1)}km away
                            </div>
                          </div>
                          <Route className="w-4 h-4 text-gray-300" strokeWidth={2} />
                        </button>
                      ))}
                    </div>
                  )}
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
