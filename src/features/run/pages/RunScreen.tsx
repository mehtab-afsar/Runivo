import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform, animate, PanInfo } from 'framer-motion';
import {
  Activity, Footprints, Bike, Mountain, Gauge, TreePine, Zap, Accessibility,
  Route, X, Layers, ChevronLeft,
  Dumbbell, Waves, Snowflake, Flame, Timer, TrendingUp, Shuffle,
  Navigation, MapPin,
} from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getAllTerritories, getPlayer, StoredTerritory, getSavedRoutes, StoredSavedRoute } from '@shared/services/store';
import { addTerritoryOverlay } from '@features/territory/services/territoryLayer';
import { findRoutesNearby } from '@shared/services/sync';
import { haptic } from '@shared/lib/haptics';

// ── Design tokens ───────────────────────────────────────────────────────────
const T = {
  bg:      '#F7F6F4',
  surface: '#FFFFFF',
  border:  '#E0DFDD',
  black:   '#0A0A0A',
  red:     '#E8391C',
  muted:   '#6B6B6B',
  font:    "'Barlow', -apple-system, sans-serif",
};

// ── Types ───────────────────────────────────────────────────────────────────
type ActivityType = 'run' | 'walk' | 'jog' | 'cycle' | 'hike' | 'trail_run' | 'sprint' | 'wheelchair'
  | 'interval' | 'tempo' | 'fartlek' | 'cross_country' | 'swim' | 'strength' | 'hiit' | 'ski'
  | 'stair_climb' | 'race';
type MapStyleId   = 'standard' | 'dark' | 'light' | 'terrain' | 'satellite';
type GpsState     = 'searching' | 'ready' | 'error';

// ── Map styles ──────────────────────────────────────────────────────────────
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

// ── Activities ──────────────────────────────────────────────────────────────
interface ActivityDef { id: ActivityType; label: string; iconEl: typeof Activity; color: string; bg: string; category: 'running' | 'outdoor' | 'training' | 'other' }
const ACTIVITIES: ActivityDef[] = [
  { id: 'run',           label: 'Run',        iconEl: Activity,      color: '#E8391C', bg: '#FDE8E4', category: 'running' },
  { id: 'jog',           label: 'Jog',        iconEl: Gauge,         color: '#E8391C', bg: '#FDE8E4', category: 'running' },
  { id: 'sprint',        label: 'Sprint',     iconEl: Zap,           color: '#DC2626', bg: '#FEE2E2', category: 'running' },
  { id: 'walk',          label: 'Walk',       iconEl: Footprints,    color: '#059669', bg: '#D1FAE5', category: 'outdoor' },
  { id: 'hike',          label: 'Hike',       iconEl: Mountain,      color: '#B45309', bg: '#FEF3C7', category: 'outdoor' },
  { id: 'trail_run',     label: 'Trail',      iconEl: TreePine,      color: '#15803D', bg: '#DCFCE7', category: 'outdoor' },
  { id: 'cycle',         label: 'Cycle',      iconEl: Bike,          color: '#0284C7', bg: '#E0F2FE', category: 'outdoor' },
  { id: 'interval',      label: 'Intervals',  iconEl: Timer,         color: '#7C3AED', bg: '#EDE9FE', category: 'running' },
  { id: 'tempo',         label: 'Tempo',      iconEl: TrendingUp,    color: '#EA580C', bg: '#FFEDD5', category: 'running' },
  { id: 'fartlek',       label: 'Fartlek',    iconEl: Shuffle,       color: '#2563EB', bg: '#DBEAFE', category: 'running' },
  { id: 'race',          label: 'Race',       iconEl: Flame,         color: '#E11D48', bg: '#FFE4E6', category: 'running' },
  { id: 'cross_country', label: 'XC',         iconEl: Route,         color: '#4338CA', bg: '#E0E7FF', category: 'outdoor' },
  { id: 'stair_climb',   label: 'Stairs',     iconEl: TrendingUp,    color: '#9333EA', bg: '#F3E8FF', category: 'outdoor' },
  { id: 'hiit',          label: 'HIIT',       iconEl: Flame,         color: '#DC2626', bg: '#FEE2E2', category: 'training' },
  { id: 'strength',      label: 'Strength',   iconEl: Dumbbell,      color: '#4B5563', bg: '#F3F4F6', category: 'training' },
  { id: 'swim',          label: 'Swim',       iconEl: Waves,         color: '#0369A1', bg: '#E0F2FE', category: 'training' },
  { id: 'wheelchair',    label: 'Wheelchair', iconEl: Accessibility, color: '#6D28D9', bg: '#EDE9FE', category: 'other' },
  { id: 'ski',           label: 'Ski',        iconEl: Snowflake,     color: '#0EA5E9', bg: '#E0F2FE', category: 'other' },
];

// ── GPS helpers ─────────────────────────────────────────────────────────────
function gpsColor(status: GpsState, acc: number | null): string {
  if (status === 'error') return '#EF4444';
  if (status === 'searching' || acc === null) return '#D1D5DB';
  if (acc < 20) return '#22C55E';
  if (acc < 50) return '#F59E0B';
  return '#F87171';
}
function gpsLabel(status: GpsState, acc: number | null): string {
  if (status === 'error') return 'GPS Error';
  if (status === 'searching' || acc === null) return 'Locating...';
  if (acc < 20) return 'GPS Strong';
  if (acc < 50) return 'GPS OK';
  return 'GPS Weak';
}

// ── Activity Picker Sheet (drum inside a sheet) ─────────────────────────────
const SHEET_DRUM_ITEM_H = 52;
const SHEET_DRUM_VISIBLE = 5;

function ActivityPickerSheet({ value, onChange, onClose }: { value: ActivityType; onChange: (v: ActivityType) => void; onClose: () => void }) {
  const [local, setLocal] = useState(value);
  const containerRef   = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  const timeoutRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localIdx       = ACTIVITIES.findIndex(a => a.id === local);

  useEffect(() => {
    if (!containerRef.current || isScrollingRef.current) return;
    containerRef.current.scrollTop = localIdx * SHEET_DRUM_ITEM_H;
  }, [localIdx]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    isScrollingRef.current = true;
    const idx = Math.round(containerRef.current.scrollTop / SHEET_DRUM_ITEM_H);
    const clamped = Math.max(0, Math.min(ACTIVITIES.length - 1, idx));
    if (clamped !== localIdx) { haptic('light'); setLocal(ACTIVITIES[clamped].id); }
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => { isScrollingRef.current = false; }, 200);
  };

  const drumH = SHEET_DRUM_ITEM_H * SHEET_DRUM_VISIBLE;

  return (
    <div style={{ background: T.surface, fontFamily: T.font, borderRadius: '20px 20px 0 0', padding: '0 0 max(24px, env(safe-area-inset-bottom)) 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12px' }}>
        <div>
          <p style={{ fontWeight: 500, fontSize: 17, color: T.black }}>Activity</p>
          <p style={{ fontWeight: 300, fontSize: 12, color: T.muted, marginTop: 2 }}>Scroll to select</p>
        </div>
        <motion.button whileTap={{ scale: 0.88 }} onClick={onClose}
          style={{ width: 32, height: 32, borderRadius: '50%', background: T.bg, border: `0.5px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X style={{ width: 15, height: 15, color: T.muted }} strokeWidth={1.5} />
        </motion.button>
      </div>

      {/* Drum */}
      <div style={{ position: 'relative', height: drumH, overflow: 'hidden', margin: '0 20px' }}>
        {/* z-index layers: band=1, scroll=2, fades=3 */}
        {/* Selection band — behind scroll */}
        <div style={{ position: 'absolute', top: SHEET_DRUM_ITEM_H * 2, left: 0, right: 0, height: SHEET_DRUM_ITEM_H, background: T.bg, borderTop: `0.5px solid ${T.border}`, borderBottom: `0.5px solid ${T.border}`, borderRadius: 12, pointerEvents: 'none', zIndex: 1 }} />
        {/* Scroll — above band so text is visible */}
        <div ref={containerRef} onScroll={handleScroll} className="hide-scrollbar"
          style={{ position: 'relative', zIndex: 2, height: '100%', overflowY: 'scroll', scrollSnapType: 'y mandatory', paddingTop: SHEET_DRUM_ITEM_H * 2, paddingBottom: SHEET_DRUM_ITEM_H * 2 }}>
          {ACTIVITIES.map((a, i) => {
            const Icon = a.iconEl;
            const active = i === localIdx;
            return (
              <div key={a.id} style={{ height: SHEET_DRUM_ITEM_H, scrollSnapAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: active ? a.bg : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}>
                  <Icon style={{ width: 16, height: 16, color: active ? a.color : '#C8C6C3' }} strokeWidth={active ? 2 : 1.5} />
                </div>
                <span style={{ fontWeight: active ? 500 : 300, fontSize: 17, color: active ? T.black : '#C8C6C3', transition: 'all 0.15s', minWidth: 90 }}>{a.label}</span>
              </div>
            );
          })}
        </div>
        {/* Fades — above scroll to create feathered edge */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: SHEET_DRUM_ITEM_H * 1.6, background: `linear-gradient(to bottom, ${T.surface} 30%, transparent)`, pointerEvents: 'none', zIndex: 3 }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: SHEET_DRUM_ITEM_H * 1.6, background: `linear-gradient(to top, ${T.surface} 30%, transparent)`, pointerEvents: 'none', zIndex: 3 }} />
      </div>

      {/* Done button */}
      <div style={{ padding: '16px 20px 0' }}>
        <motion.button whileTap={{ scale: 0.97 }}
          onClick={() => { onChange(local); haptic('medium'); onClose(); }}
          style={{ width: '100%', background: T.black, borderRadius: 14, padding: '14px 0', fontFamily: T.font, fontWeight: 500, fontSize: 14, color: '#fff', letterSpacing: '0.04em' }}>
          Done
        </motion.button>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export default function RunScreen() {
  const navigate = useNavigate();

  const [activityType, setActivityType] = useState<ActivityType>('run');
  const [gps, setGps] = useState<{ status: GpsState; accuracy: number | null; location: { lat: number; lng: number } | null }>({
    status: 'searching', accuracy: null, location: null,
  });
  const [showGpsLoader, setShowGpsLoader]       = useState(true);
  const [showActivityPicker, setShowActivityPicker] = useState(false);
  const [showRoutePicker, setShowRoutePicker]   = useState(false);
  const [mapStyle, setMapStyle]                 = useState<MapStyleId>('standard');
  const [showStylePicker, setShowStylePicker]   = useState(false);
  const [isLocating, setIsLocating]             = useState(false);
  const [intelStats, setIntelStats]             = useState({ enemy: 0, neutral: 0, weak: 0 });
  const [savedRoutes, setSavedRoutes]           = useState<StoredSavedRoute[]>([]);
  const [nearbyRoutes, setNearbyRoutes]         = useState<{ id: string; name: string; emoji: string; distanceM: number; durationSec: number | null; gpsPoints: { lat: number; lng: number }[]; username: string; distM: number }[]>([]);
  const [nearbyLoading, setNearbyLoading]       = useState(false);
  const [selectedRoute, setSelectedRoute]       = useState<{ name: string; gpsPoints: { lat: number; lng: number }[] } | null>(null);

  const mapContainer    = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<maplibregl.Map | null>(null);
  const userMarkerRef   = useRef<maplibregl.Marker | null>(null);
  const userLngLatRef   = useRef<[number, number] | null>(null);
  const watchIdRef      = useRef<number | null>(null);
  const gpsReadyRef     = useRef(false);
  const territoriesRef  = useRef<StoredTerritory[]>([]);
  const lastGpsUpdateRef = useRef<number>(0);

  // ── Sheet snap ──────────────────────────────────────────────────────────
  const COLLAPSED_H = 228;
  const [windowH, setWindowH] = useState(() => window.innerHeight);
  useEffect(() => {
    const fn = () => setWindowH(window.innerHeight);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  const EXPANDED_H = Math.round(windowH * 0.68);

  const sheetH   = useMotionValue(COLLAPSED_H);
  const mapH     = useTransform(sheetH, h => windowH - h);
  const [isExpanded, setIsExpanded] = useState(false);

  const snapSheet = useCallback((target: number) => {
    animate(sheetH, target, { type: 'spring', damping: 32, stiffness: 320 });
    setIsExpanded(target === EXPANDED_H);
  }, [sheetH, EXPANDED_H]);

  const handleDragEnd = useCallback((_: unknown, info: PanInfo) => {
    const cur = sheetH.get();
    const vel = info.velocity.y;
    let target: number;
    if (vel < -300) target = EXPANDED_H;
    else if (vel > 300) target = COLLAPSED_H;
    else target = cur > (COLLAPSED_H + EXPANDED_H) / 2 ? EXPANDED_H : COLLAPSED_H;
    snapSheet(target);
  }, [sheetH, COLLAPSED_H, EXPANDED_H, snapSheet]);

  // Resize map when sheet moves
  useEffect(() => {
    return mapH.on('change', () => { mapRef.current?.resize(); });
  }, [mapH]);

  // GPS loader min 3s
  useEffect(() => {
    const t = setTimeout(() => { if (gpsReadyRef.current) setShowGpsLoader(false); }, 3000);
    return () => clearTimeout(t);
  }, []);

  // Load territory intel
  useEffect(() => {
    (async () => {
      const p = await getPlayer();
      const territories = await getAllTerritories();
      if (p) {
        setIntelStats({
          enemy:   territories.filter(t => t.ownerId && t.ownerId !== p.id).length,
          neutral: territories.filter(t => !t.ownerId).length,
          weak:    territories.filter(t => t.ownerId && t.ownerId !== p.id && t.defense < 40).length,
        });
      }
    })();
  }, []);

  // Init map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLES[0].styleUrl!,
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
      markerEl.innerHTML = `<div style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center;"><div style="position:absolute;inset:0;border-radius:50%;background:rgba(232,57,28,0.15);animation:run-ping 2s ease-out infinite;"></div><div style="width:14px;height:14px;border-radius:50%;background:#E8391C;border:2.5px solid white;box-shadow:0 2px 8px rgba(232,57,28,0.4);position:relative;z-index:1;"></div></div>`;
      userMarkerRef.current = new maplibregl.Marker({ element: markerEl, anchor: 'center' }).setLngLat([77.2090, 28.6139]);
      watchIdRef.current = navigator.geolocation.watchPosition(
        pos => {
          const lngLat: [number, number] = [pos.coords.longitude, pos.coords.latitude];
          userLngLatRef.current = lngLat;
          if (userMarkerRef.current) {
            userMarkerRef.current.setLngLat(lngLat);
            if (!userMarkerRef.current.getElement().parentElement) userMarkerRef.current.addTo(map);
          }
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
    const ro = new ResizeObserver(() => { mapRef.current?.resize(); });
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

  const changeMapStyle = useCallback((styleId: MapStyleId) => {
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
  }, [mapStyle]);

  const openRoutePicker = async () => {
    setShowRoutePicker(true);
    haptic('light');
    setSavedRoutes(await getSavedRoutes());
  };

  const handleFindNearby = async () => {
    if (!gps.location) return;
    setNearbyLoading(true);
    try { setNearbyRoutes(await findRoutesNearby(gps.location.lng, gps.location.lat, 5000)); }
    catch (e) { console.warn(e); }
    finally { setNearbyLoading(false); }
  };

  const handleStart = () => {
    if (gps.status !== 'ready' || !gps.location) return;
    haptic('medium');
    navigate('/active-run', { state: { activityType, startLocation: gps.location, ghostRoute: selectedRoute?.gpsPoints } });
  };

  const gpsReady = gps.status === 'ready';
  const dot      = gpsColor(gps.status, gps.accuracy);
  const gpsTxt   = gpsLabel(gps.status, gps.accuracy);

  return (
    <div className="fixed inset-0" style={{ background: T.bg, height: '100dvh', fontFamily: T.font }}>
      <style>{`
        @keyframes run-ping {
          0%   { transform: scale(0.8); opacity: 0.6; }
          70%  { transform: scale(2.4); opacity: 0; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes start-pulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(232,57,28,0.30); }
          50%      { box-shadow: 0 0 0 10px rgba(232,57,28,0); }
        }
        @keyframes gps-pulse {
          0%,100% { opacity: 1; }
          50%     { opacity: 0.3; }
        }
      `}</style>

      {/* ── MAP ──────────────────────────────────────────────────────── */}
      <motion.div className="relative" style={{ height: mapH }}>
        <div ref={mapContainer} className="absolute inset-0 w-full h-full" />

        {/* Floating header */}
        <div className="absolute left-4 right-4 z-10 flex items-center gap-2.5"
          style={{ top: 'max(14px, env(safe-area-inset-top))' }}>
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => navigate('/home')}
            style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', border: `0.5px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ChevronLeft style={{ width: 18, height: 18, color: T.black }} strokeWidth={1.5} />
          </motion.button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', border: `0.5px solid ${T.border}`, borderRadius: 20, padding: '7px 14px' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flexShrink: 0, animation: gps.status === 'searching' ? 'gps-pulse 1.2s ease-in-out infinite' : 'none' }} />
            <span style={{ fontWeight: 400, fontSize: 12, color: T.black }}>{gpsTxt}</span>
          </div>

          <div style={{ flex: 1 }} />

          {(intelStats.enemy > 0 || intelStats.weak > 0) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', border: `0.5px solid ${T.border}`, borderRadius: 20, padding: '7px 12px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.red, flexShrink: 0 }} />
              <span style={{ fontWeight: 400, fontSize: 11, color: T.black }}>{intelStats.enemy} enemy · {intelStats.weak} weak</span>
            </div>
          )}
        </div>

        {/* Right controls */}
        <div className="absolute right-4 z-10 flex flex-col gap-2" style={{ top: '50%', transform: 'translateY(-50%)' }}>
          <motion.button whileTap={{ scale: 0.88 }} onClick={recenterMap}
            style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', border: `0.5px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Navigation style={{ width: 16, height: 16, color: isLocating ? T.red : T.black }} strokeWidth={1.5}
              className={isLocating ? 'animate-pulse' : ''} />
          </motion.button>
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => { setShowStylePicker(s => !s); haptic('light'); }}
            style={{ width: 40, height: 40, borderRadius: '50%', background: showStylePicker ? T.black : 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', border: `0.5px solid ${showStylePicker ? T.black : T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers style={{ width: 16, height: 16, color: showStylePicker ? '#fff' : T.black }} strokeWidth={1.5} />
          </motion.button>
        </div>

        {/* Style picker */}
        <AnimatePresence>
          {showStylePicker && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-20" onClick={() => setShowStylePicker(false)} />
              <motion.div initial={{ opacity: 0, scale: 0.92, x: 8 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.92, x: 8 }}
                transition={{ type: 'spring', damping: 24, stiffness: 300 }} className="absolute right-14 z-30"
                style={{ top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(16px)', border: `0.5px solid ${T.border}`, borderRadius: 16, padding: 12, width: 196 }}>
                <span style={{ fontWeight: 400, fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>Map Style</span>
                <div className="grid grid-cols-3 gap-2">
                  {MAP_STYLES.map(s => (
                    <button key={s.id} onClick={() => changeMapStyle(s.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 52, height: 52, borderRadius: 10, background: s.preview, border: mapStyle === s.id ? `1.5px solid ${T.black}` : `0.5px solid ${T.border}` }} />
                      <span style={{ fontWeight: 400, fontSize: 10, color: mapStyle === s.id ? T.black : T.muted }}>{s.label}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* GPS loader */}
        <AnimatePresence>
          {showGpsLoader && (
            <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}
              className="absolute inset-0 z-20 flex flex-col items-center justify-center"
              style={{ background: 'rgba(247,246,244,0.75)', backdropFilter: 'blur(4px)' }}>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                style={{ width: 36, height: 36, borderRadius: '50%', borderWidth: 2.5, borderStyle: 'solid', borderColor: T.border, borderTopColor: T.black, marginBottom: 10 }} />
              <span style={{ fontWeight: 400, fontSize: 13, color: T.black }}>Fetching GPS</span>
              <span style={{ fontWeight: 300, fontSize: 11, color: T.muted, marginTop: 3 }}>Finding your position</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── DRAGGABLE SHEET ──────────────────────────────────────────── */}
      <motion.div
        className="absolute left-0 right-0 bottom-0 flex flex-col"
        style={{
          height: sheetH, touchAction: 'none',
          background: T.bg,
          borderTop: `0.5px solid ${T.border}`,
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.06)',
        }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.08}
        onDrag={(_: unknown, info: PanInfo) => {
          const newH = Math.max(COLLAPSED_H, Math.min(EXPANDED_H, sheetH.get() - info.delta.y));
          sheetH.set(newH);
        }}
        onDragEnd={handleDragEnd}
      >
        {/* Drag handle — also tap-to-toggle */}
        <div className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing flex-shrink-0"
          onDoubleClick={() => snapSheet(isExpanded ? COLLAPSED_H : EXPANDED_H)}>
          <div style={{ width: 36, height: 3, borderRadius: 9, background: T.border }} />
        </div>

        {/* Stats strip */}
        <div className="flex items-stretch mx-4 mt-2 mb-3 flex-shrink-0"
          style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 14 }}>
          {[
            { label: 'DIST',  value: '0.00', unit: 'km'  },
            { label: 'TIME',  value: '0:00', unit: ''     },
            { label: 'PACE',  value: '0:00', unit: '/km'  },
            { label: 'ZONES', value: String(intelStats.enemy + intelStats.neutral), unit: '' },
          ].map((s, i) => (
            <div key={s.label} className="flex-1 flex flex-col items-center py-3"
              style={{ borderLeft: i > 0 ? `0.5px solid ${T.border}` : 'none' }}>
              <span style={{ fontWeight: 400, fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{s.label}</span>
              <span style={{ fontWeight: 300, fontSize: 22, color: T.black, lineHeight: 1.1, marginTop: 2 }}>
                {s.value}{s.unit && <span style={{ fontWeight: 400, fontSize: 10, color: T.muted }}> {s.unit}</span>}
              </span>
            </div>
          ))}
        </div>

        {/* Activity + Route — compact row card */}
        {(() => {
          const def = ACTIVITIES.find(a => a.id === activityType)!;
          const Icon = def.iconEl;
          return (
            <div className="mx-4 mb-3 flex items-center flex-shrink-0"
              style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
              {/* Activity */}
              <motion.button whileTap={{ scale: 0.97 }}
                onClick={() => { setShowActivityPicker(true); haptic('light'); }}
                className="flex items-center gap-2.5"
                style={{ flex: 1, padding: '10px 12px', borderRight: `0.5px solid ${T.border}` }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: def.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon style={{ width: 15, height: 15, color: def.color }} strokeWidth={1.5} />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p style={{ fontWeight: 400, fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Activity</p>
                  <p style={{ fontWeight: 500, fontSize: 13, color: T.black, marginTop: 1 }}>{def.label}</p>
                </div>
                <ChevronLeft style={{ width: 13, height: 13, color: T.muted, transform: 'rotate(180deg)', flexShrink: 0 }} strokeWidth={1.5} />
              </motion.button>
              {/* Route */}
              <motion.button whileTap={{ scale: 0.97 }} onClick={openRoutePicker}
                className="flex items-center gap-2.5"
                style={{ flex: 1, padding: '10px 12px' }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: selectedRoute ? T.black : T.bg, border: `0.5px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Route style={{ width: 15, height: 15, color: selectedRoute ? '#fff' : T.muted }} strokeWidth={1.5} />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p style={{ fontWeight: 400, fontSize: 9, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Route</p>
                  <p style={{ fontWeight: 500, fontSize: 13, color: T.black, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedRoute ? selectedRoute.name : 'None'}
                  </p>
                </div>
                <ChevronLeft style={{ width: 13, height: 13, color: T.muted, transform: 'rotate(180deg)', flexShrink: 0 }} strokeWidth={1.5} />
              </motion.button>
            </div>
          );
        })()}

        {/* Expanded: territory intel chips */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.16 }}
              className="flex gap-2 px-4 mb-3 flex-shrink-0"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 9, background: '#FDE8E4', border: `0.5px solid rgba(232,57,28,0.15)` }}>
                <span style={{ fontWeight: 400, fontSize: 11, color: T.red }}>{intelStats.enemy} Enemy</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 9, background: T.surface, border: `0.5px solid ${T.border}` }}>
                <span style={{ fontWeight: 400, fontSize: 11, color: T.muted }}>{intelStats.neutral} Free</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 9, background: '#FFFBEB', border: `0.5px solid rgba(245,158,11,0.15)` }}>
                <span style={{ fontWeight: 400, fontSize: 11, color: '#B45309' }}>{intelStats.weak} Weak</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Start button — always pinned at bottom */}
        <div className="px-4 mt-auto flex-shrink-0" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
          <motion.button whileTap={gpsReady ? { scale: 0.97 } : {}} onClick={handleStart}
            className="w-full flex items-center justify-center gap-3"
            style={{ background: gpsReady ? T.black : '#D1D5DB', borderRadius: 16, padding: '14px 20px', opacity: gpsReady ? 1 : 0.65, cursor: gpsReady ? 'pointer' : 'default' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: gpsReady ? T.red : '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: gpsReady ? 'start-pulse 2s ease-in-out infinite' : 'none', flexShrink: 0 }}>
              <svg width="11" height="13" viewBox="0 0 11 13" fill="white"><path d="M0.5 0.5L10.5 6.5L0.5 12.5V0.5Z" /></svg>
            </div>
            <span style={{ fontWeight: 500, fontSize: 14, color: '#fff', letterSpacing: '0.06em' }}>
              {gpsReady ? 'START RUN' : 'WAITING FOR GPS'}
            </span>
          </motion.button>
        </div>
      </motion.div>

      {/* ── ACTIVITY PICKER MODAL ──────────────────────────────────── */}
      <AnimatePresence>
        {showActivityPicker && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40" style={{ background: 'rgba(0,0,0,0.25)' }} onClick={() => setShowActivityPicker(false)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="absolute bottom-0 left-0 right-0 z-50"
              style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
              <ActivityPickerSheet value={activityType} onChange={v => { setActivityType(v); setShowActivityPicker(false); }} onClose={() => setShowActivityPicker(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── ROUTE PICKER MODAL ────────────────────────────────────── */}
      <AnimatePresence>
        {showRoutePicker && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-40" style={{ background: 'rgba(0,0,0,0.25)' }} onClick={() => setShowRoutePicker(false)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="absolute bottom-0 left-0 right-0 z-50"
              style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
              <div style={{ background: T.surface, fontFamily: T.font }} className="rounded-t-3xl px-5 pt-4 pb-8 max-h-[75vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 style={{ fontWeight: 500, fontSize: 17, color: T.black }}>Routes</h3>
                    <p style={{ fontWeight: 400, fontSize: 12, color: T.muted, marginTop: 2 }}>Choose a route to follow</p>
                  </div>
                  <motion.button whileTap={{ scale: 0.88 }} onClick={() => setShowRoutePicker(false)}
                    style={{ width: 32, height: 32, borderRadius: '50%', background: T.bg, border: `0.5px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X style={{ width: 15, height: 15, color: T.muted }} strokeWidth={1.5} />
                  </motion.button>
                </div>

                {selectedRoute && (
                  <motion.button whileTap={{ scale: 0.98 }} onClick={() => { setSelectedRoute(null); haptic('light'); }}
                    className="w-full mb-4 flex items-center gap-3"
                    style={{ background: '#FDE8E4', border: `0.5px solid rgba(232,57,28,0.12)`, borderRadius: 14, padding: '10px 14px' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: T.red, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <X style={{ width: 14, height: 14, color: '#fff' }} strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 text-left">
                      <p style={{ fontWeight: 400, fontSize: 12, color: T.red }}>Clear: {selectedRoute.name}</p>
                      <p style={{ fontWeight: 300, fontSize: 11, color: T.red, opacity: 0.7, marginTop: 1 }}>Tap to remove route</p>
                    </div>
                  </motion.button>
                )}

                <div className="mb-5">
                  <p style={{ fontWeight: 400, fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>My Routes</p>
                  {savedRoutes.length === 0
                    ? <p style={{ fontWeight: 300, fontSize: 12, color: T.muted, paddingTop: 8 }}>No saved routes yet. Finish a run to save one.</p>
                    : <div className="space-y-2">
                        {savedRoutes.map(r => (
                          <motion.button key={r.id} whileTap={{ scale: 0.98 }}
                            onClick={() => { setSelectedRoute({ name: `${r.emoji} ${r.name}`, gpsPoints: r.gpsPoints }); setShowRoutePicker(false); haptic('medium'); }}
                            className="w-full flex items-center gap-3"
                            style={{ background: T.bg, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: '10px 14px' }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: T.surface, border: `0.5px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{r.emoji}</div>
                            <div className="flex-1 text-left min-w-0">
                              <p style={{ fontWeight: 400, fontSize: 13, color: T.black }} className="truncate">{r.name}</p>
                              <p style={{ fontWeight: 300, fontSize: 11, color: T.muted, marginTop: 1 }}>{(r.distanceM / 1000).toFixed(2)} km{r.durationSec ? ` · ${Math.floor(r.durationSec / 60)} min` : ''}</p>
                            </div>
                            <Route style={{ width: 14, height: 14, color: T.border, flexShrink: 0 }} strokeWidth={1.5} />
                          </motion.button>
                        ))}
                      </div>
                  }
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p style={{ fontWeight: 400, fontSize: 10, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Nearby</p>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={handleFindNearby} disabled={nearbyLoading || !gpsReady}
                      style={{ fontWeight: 400, fontSize: 12, color: nearbyLoading || !gpsReady ? T.muted : T.black }}>
                      {nearbyLoading ? 'Searching...' : 'Find Routes'}
                    </motion.button>
                  </div>
                  {nearbyRoutes.length === 0
                    ? <p style={{ fontWeight: 300, fontSize: 12, color: T.muted, paddingTop: 8 }}>{nearbyLoading ? 'Searching nearby...' : 'Tap "Find Routes" to discover routes near you.'}</p>
                    : <div className="space-y-2">
                        {nearbyRoutes.map(r => (
                          <motion.button key={r.id} whileTap={{ scale: 0.98 }}
                            onClick={() => { setSelectedRoute({ name: `${r.emoji} ${r.name}`, gpsPoints: r.gpsPoints }); setShowRoutePicker(false); haptic('medium'); }}
                            className="w-full flex items-center gap-3"
                            style={{ background: T.bg, border: `0.5px solid ${T.border}`, borderRadius: 14, padding: '10px 14px' }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#EFF6FF', border: `0.5px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{r.emoji}</div>
                            <div className="flex-1 text-left min-w-0">
                              <p style={{ fontWeight: 400, fontSize: 13, color: T.black }} className="truncate">{r.name}</p>
                              <p style={{ fontWeight: 300, fontSize: 11, color: T.muted, marginTop: 1 }}>{(r.distanceM / 1000).toFixed(2)} km · {r.username} · {(r.distM / 1000).toFixed(1)} km away</p>
                            </div>
                            <MapPin style={{ width: 14, height: 14, color: T.border, flexShrink: 0 }} strokeWidth={1.5} />
                          </motion.button>
                        ))}
                      </div>
                  }
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
