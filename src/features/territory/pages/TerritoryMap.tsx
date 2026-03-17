import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Crosshair, ChevronLeft, Shield, Swords, Flag } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getAllTerritories, StoredTerritory, getPlayer } from '@shared/services/store';
import { addTerritoryOverlay } from '@features/territory/services/territoryLayer';
import { haptic } from '@shared/lib/haptics';

// ─── Tokens (shared with Dashboard) ─────────────────────────────────────────
const T = {
  bg:          '#F7F6F4',
  surface:     '#FFFFFF',
  border:      '#E0DFDD',
  black:       '#0A0A0A',
  text2:       '#7A7A7A',
  text3:       '#ADADAD',
  mid:         '#EBEBEB',
  red:         '#E8391C',
  redLight:    '#FFF1EE',
  green:       '#1A7A4A',
  greenLight:  '#EEF8F3',
  amber:       '#B87A00',
  amberLight:  '#FFF9EE',
  amberBorder: '#E8C97A',
};
const F = "'Barlow', 'DM Sans', sans-serif";

// ─── Types ────────────────────────────────────────────────────────────────────
interface TerritoryDetail {
  hexId: string; status: string; ownerName: string | null; defense: number; tier: string;
}
type MapFilter = 'all' | 'mine' | 'enemy' | 'weak' | 'neutral';
type MapStyle  = 'standard' | 'satellite' | 'dark' | 'terrain' | 'light';
interface MapStyleDef {
  id: MapStyle; label: string; preview: string;
  styleUrl?: string; rasterTiles?: string[]; sourceMaxZoom?: number;
}

const MAP_STYLES: MapStyleDef[] = [
  { id: 'standard',  label: 'Standard',  preview: '#E8F5E9', styleUrl: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json' },
  { id: 'dark',      label: 'Dark',      preview: '#263238', styleUrl: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json' },
  { id: 'light',     label: 'Light',     preview: '#FAFAFA', styleUrl: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json' },
  { id: 'terrain',   label: 'Terrain',   preview: '#C8E6C9', sourceMaxZoom: 17,
    rasterTiles: ['https://a.tile.opentopomap.org/{z}/{x}/{y}.png','https://b.tile.opentopomap.org/{z}/{x}/{y}.png','https://c.tile.opentopomap.org/{z}/{x}/{y}.png'] },
  { id: 'satellite', label: 'Satellite', preview: '#1B5E20', sourceMaxZoom: 18,
    rasterTiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'] },
];

function buildRasterStyle(tiles: string[], sourceMaxZoom = 19): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: { 'raster-tiles': { type: 'raster', tiles, tileSize: 256, attribution: '&copy; OpenStreetMap / Esri', maxzoom: sourceMaxZoom } },
    layers: [{ id: 'raster-layer', type: 'raster', source: 'raster-tiles', minzoom: 0, maxzoom: 22 }],
  };
}

// ─── Defense bar colour ───────────────────────────────────────────────────────
function defenseColor(d: number) {
  if (d > 70) return T.green;
  if (d > 30) return T.amber;
  return T.red;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function TerritoryMap() {
  const navigate = useNavigate();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<maplibregl.Map | null>(null);

  const [territories,        setTerritories]        = useState<StoredTerritory[]>([]);
  const [selectedTerritory,  setSelectedTerritory]  = useState<TerritoryDetail | null>(null);
  const [stats,              setStats]              = useState({ owned: 0, enemy: 0, neutral: 0 });
  const [activeFilter,       setActiveFilter]       = useState<MapFilter>('all');
  const [mapStyle,           setMapStyle]           = useState<MapStyle>('standard');
  const [showStylePicker,    setShowStylePicker]    = useState(false);
  const [isLocating,         setIsLocating]         = useState(false);

  const userMarkerRef  = useRef<maplibregl.Marker | null>(null);
  const userLngLatRef  = useRef<[number, number] | null>(null);
  const watchIdRef     = useRef<number | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const player = await getPlayer();
    const all    = await getAllTerritories();
    setTerritories(all);
    if (player) {
      setStats({
        owned:   all.filter(t => t.ownerId === player.id).length,
        enemy:   all.filter(t => t.ownerId && t.ownerId !== player.id).length,
        neutral: all.filter(t => !t.ownerId).length,
      });
    }
  };

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLES[0].styleUrl!,
      center: [77.2090, 28.6139], zoom: 14,
      attributionControl: false,
    });
    map.on('load', () => {
      mapRef.current = map;
      setTimeout(() => map.resize(), 0);
      const el = document.createElement('div');
      el.innerHTML = `<div style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center"><div style="position:absolute;inset:0;border-radius:50%;background:rgba(232,57,28,0.15);animation:pulse-ring 2s ease-out infinite"></div><div style="width:14px;height:14px;border-radius:50%;background:#E8391C;border:3px solid white;box-shadow:0 2px 8px rgba(232,57,28,0.4);position:relative;z-index:1"></div></div>`;
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([77.2090, 28.6139]);
      userMarkerRef.current = marker;
      watchIdRef.current = navigator.geolocation.watchPosition(pos => {
        const lngLat: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        userLngLatRef.current = lngLat;
        if (userMarkerRef.current) {
          userMarkerRef.current.setLngLat(lngLat);
          if (!userMarkerRef.current.getElement().parentElement) userMarkerRef.current.addTo(map);
        }
        if (!map.getBounds().contains(lngLat)) map.flyTo({ center: lngLat, zoom: 15 });
      }, () => {}, { enableHighAccuracy: true, maximumAge: 10000 });
    });
    const ro = new ResizeObserver(() => { if (mapRef.current) mapRef.current.resize(); });
    ro.observe(mapContainer.current);
    return () => {
      ro.disconnect();
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      map.remove(); mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || territories.length === 0) return;
    (async () => {
      const player = await getPlayer();
      if (player && mapRef.current) addTerritoryOverlay(mapRef.current, territories, { playerId: player.id, showLabels: true });
    })();
  }, [territories]);

  useEffect(() => {
    const handler = (e: Event) => { setSelectedTerritory((e as CustomEvent).detail); haptic('light'); };
    window.addEventListener('territory-click', handler);
    return () => window.removeEventListener('territory-click', handler);
  }, []);

  const recenterMap = () => {
    haptic('light');
    if (userLngLatRef.current && mapRef.current) { mapRef.current.flyTo({ center: userLngLatRef.current, zoom: 15, duration: 800 }); return; }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(pos => {
      const lngLat: [number, number] = [pos.coords.longitude, pos.coords.latitude];
      userLngLatRef.current = lngLat;
      mapRef.current?.flyTo({ center: lngLat, zoom: 15, duration: 800 });
      if (userMarkerRef.current && mapRef.current) {
        userMarkerRef.current.setLngLat(lngLat);
        if (!userMarkerRef.current.getElement().parentElement) userMarkerRef.current.addTo(mapRef.current);
      }
      setIsLocating(false);
    }, () => setIsLocating(false), { enableHighAccuracy: true, timeout: 8000 });
  };

  const changeMapStyle = (style: MapStyle) => {
    if (!mapRef.current || style === mapStyle) return;
    setMapStyle(style); setShowStylePicker(false); haptic('light');
    const def = MAP_STYLES.find(s => s.id === style)!;
    const { center, zoom, pitch, bearing } = { center: mapRef.current.getCenter(), zoom: mapRef.current.getZoom(), pitch: mapRef.current.getPitch(), bearing: mapRef.current.getBearing() };
    mapRef.current.setStyle(def.rasterTiles ? buildRasterStyle(def.rasterTiles, def.sourceMaxZoom) : def.styleUrl!);
    mapRef.current.once('style.load', () => {
      mapRef.current?.jumpTo({ center, zoom, pitch, bearing });
      (async () => { const p = await getPlayer(); if (p && mapRef.current) addTerritoryOverlay(mapRef.current, territories, { playerId: p.id, showLabels: true }); })();
      if (userMarkerRef.current && userLngLatRef.current && mapRef.current) {
        userMarkerRef.current.setLngLat(userLngLatRef.current);
        if (!userMarkerRef.current.getElement().parentElement) userMarkerRef.current.addTo(mapRef.current);
      }
    });
  };

  const FILTERS: { id: MapFilter; label: string }[] = [
    { id: 'all', label: 'All' }, { id: 'mine', label: 'Mine' },
    { id: 'enemy', label: 'Enemy' }, { id: 'weak', label: 'Weak' }, { id: 'neutral', label: 'Free' },
  ];

  // Tier → accent colour mapping
  const TIER_COLORS: Record<string, string> = {
    common: T.text3, uncommon: T.green, rare: '#2563EB', epic: '#7C3AED', legendary: T.amber,
  };

  const statusLabel = (s: string) => s === 'owned' ? 'YOURS' : s === 'enemy' ? 'ENEMY' : 'NEUTRAL';
  const statusColor = (s: string) => s === 'owned' ? T.red : s === 'enemy' ? '#DC2626' : T.text3;
  const statusBg    = (s: string) => s === 'owned' ? T.redLight : s === 'enemy' ? '#FEF2F2' : T.mid;

  return (
    <div className="fixed inset-0" style={{ width: '100vw', height: '100dvh', minHeight: '100vh', fontFamily: F }}>
      {/* Map */}
      <div ref={mapContainer} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      {/* ── Header ── */}
      <div className="absolute left-3 right-3 z-20" style={{ top: 'max(12px,env(safe-area-inset-top))' }}>
        <div style={{
          background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)',
          borderRadius: 18, border: `0.5px solid ${T.border}`,
          padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        }}>
          <button
            onClick={() => navigate(-1)}
            style={{ width: 30, height: 30, borderRadius: '50%', background: T.bg, border: `0.5px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}
          >
            <ChevronLeft size={16} color={T.black} strokeWidth={1.5} />
          </button>

          <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: T.black, fontFamily: F }}>
            Territory
          </span>

          {/* Stats chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {[
              { dot: T.red,   value: stats.owned,   label: 'owned' },
              { dot: '#DC2626', value: stats.enemy, label: 'enemy' },
              { dot: T.text3, value: stats.neutral, label: 'free'  },
            ].map(({ dot, value, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: T.black, fontFamily: F }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Filter pills ── */}
      <div className="absolute left-3 right-3 z-20" style={{ top: 'max(70px,calc(env(safe-area-inset-top) + 58px))' }}>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {FILTERS.map(f => {
            const active = activeFilter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => { setActiveFilter(f.id); haptic('light'); }}
                style={{
                  flexShrink: 0, padding: '6px 14px', borderRadius: 20,
                  fontSize: 11, fontWeight: active ? 500 : 400,
                  fontFamily: F, letterSpacing: '0.04em',
                  background: active ? T.black : 'rgba(255,255,255,0.88)',
                  backdropFilter: 'blur(12px)',
                  border: `0.5px solid ${active ? T.black : T.border}`,
                  color: active ? '#FFFFFF' : T.text2,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Right controls ── */}
      <div className="absolute right-3 z-20 flex flex-col gap-2" style={{ top: 'max(128px,calc(env(safe-area-inset-top) + 116px))' }}>
        <button
          onClick={recenterMap}
          style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)',
            border: `0.5px solid ${T.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.07)', cursor: 'pointer',
          }}
          className={isLocating ? 'animate-pulse' : ''}
        >
          <Crosshair size={16} color={isLocating ? T.red : T.black} strokeWidth={1.5} />
        </button>
        <button
          onClick={() => { setShowStylePicker(v => !v); haptic('light'); }}
          style={{
            width: 40, height: 40, borderRadius: '50%',
            background: showStylePicker ? T.black : 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(12px)',
            border: `0.5px solid ${showStylePicker ? T.black : T.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.07)', cursor: 'pointer',
          }}
        >
          <Layers size={16} color={showStylePicker ? '#FFFFFF' : T.black} strokeWidth={1.5} />
        </button>
      </div>

      {/* ── Style picker popover ── */}
      <AnimatePresence>
        {showStylePicker && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-25" onClick={() => setShowStylePicker(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: -6 }}
              transition={{ type: 'spring', damping: 24, stiffness: 300 }}
              style={{
                position: 'absolute', right: 12, zIndex: 30,
                top: 'max(178px,calc(env(safe-area-inset-top) + 166px))',
                background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(20px)',
                border: `0.5px solid ${T.border}`, borderRadius: 18,
                padding: 14, width: 200,
                boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 400, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.text3, fontFamily: F, marginBottom: 10 }}>
                Map style
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {MAP_STYLES.map(s => {
                  const active = mapStyle === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => changeMapStyle(s.id)}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      <div style={{
                        width: 48, height: 34, borderRadius: 10,
                        background: s.preview,
                        border: `${active ? 1.5 : 0.5}px solid ${active ? T.black : T.border}`,
                        transition: 'border-color 0.15s',
                      }} />
                      <span style={{ fontSize: 9, fontWeight: active ? 500 : 400, color: active ? T.black : T.text3, fontFamily: F }}>
                        {s.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Territory detail sheet ── */}
      <AnimatePresence>
        {selectedTerritory && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 0.3 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-30 bg-black"
              onClick={() => setSelectedTerritory(null)}
            />
            <motion.div
              initial={{ y: 300, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 300, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 240 }}
              className="absolute bottom-0 left-0 right-0 z-40"
            >
              <div style={{
                background: T.surface, borderRadius: '24px 24px 0 0',
                borderTop: `0.5px solid ${T.border}`,
                padding: '20px 22px 36px',
                paddingBottom: 'max(36px,env(safe-area-inset-bottom))',
              }}>
                {/* Drag handle */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
                  <div style={{ width: 32, height: 3, borderRadius: 2, background: T.mid }} />
                </div>

                {/* Top row: tier + hex + status badge */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                      <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: TIER_COLORS[selectedTerritory.tier] ?? T.text3, fontFamily: F }}>
                        {selectedTerritory.tier}
                      </span>
                      <span style={{ fontSize: 9, color: T.text3, fontFamily: F }}>·</span>
                      <span style={{ fontSize: 9, color: T.text3, fontFamily: "'Courier New',monospace" }}>
                        {selectedTerritory.hexId.slice(0, 10)}…
                      </span>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 300, fontStyle: 'italic', letterSpacing: '-0.02em', color: T.black, fontFamily: F, lineHeight: 1 }}>
                      {selectedTerritory.status === 'owned'
                        ? 'Your territory'
                        : selectedTerritory.status === 'enemy'
                        ? `${selectedTerritory.ownerName ?? 'Enemy'}'s zone`
                        : 'Unclaimed zone'}
                    </div>
                  </div>
                  <div style={{
                    padding: '4px 10px', borderRadius: 20, flexShrink: 0,
                    background: statusBg(selectedTerritory.status),
                    fontSize: 9, fontWeight: 500, letterSpacing: '0.1em',
                    color: statusColor(selectedTerritory.status), fontFamily: F,
                  }}>
                    {statusLabel(selectedTerritory.status)}
                  </div>
                </div>

                {/* Defense bar */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 400, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.text3, fontFamily: F }}>
                      Defense
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 300, color: defenseColor(selectedTerritory.defense), fontFamily: F, letterSpacing: '-0.01em' }}>
                      {selectedTerritory.defense} / 100
                    </span>
                  </div>
                  <div style={{ height: 3, background: T.mid, borderRadius: 2, overflow: 'hidden' }}>
                    <motion.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: selectedTerritory.defense / 100 }}
                      transition={{ duration: 0.7, ease: 'easeOut' }}
                      style={{ height: '100%', transformOrigin: 'left', background: defenseColor(selectedTerritory.defense), borderRadius: 2 }}
                    />
                  </div>
                </div>

                {/* Action button */}
                {selectedTerritory.status === 'enemy' && (
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setSelectedTerritory(null); navigate('/run'); haptic('medium'); }}
                    style={{
                      width: '100%', padding: '16px 0', borderRadius: 14, border: 'none',
                      background: T.black, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}
                  >
                    <Swords size={15} color="#FFFFFF" strokeWidth={1.5} />
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#FFFFFF', fontFamily: F }}>Attack territory</span>
                  </motion.button>
                )}
                {selectedTerritory.status === 'owned' && (
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setSelectedTerritory(null); navigate('/run'); haptic('medium'); }}
                    style={{
                      width: '100%', padding: '16px 0', borderRadius: 14, border: 'none',
                      background: T.black, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}
                  >
                    <Shield size={15} color="#FFFFFF" strokeWidth={1.5} />
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#FFFFFF', fontFamily: F }}>Fortify — run to strengthen</span>
                  </motion.button>
                )}
                {selectedTerritory.status === 'neutral' && (
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setSelectedTerritory(null); navigate('/run'); haptic('medium'); }}
                    style={{
                      width: '100%', padding: '16px 0', borderRadius: 14, border: `0.5px solid ${T.black}`,
                      background: 'transparent', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}
                  >
                    <Flag size={15} color={T.black} strokeWidth={1.5} />
                    <span style={{ fontSize: 14, fontWeight: 500, color: T.black, fontFamily: F }}>Claim this territory</span>
                  </motion.button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
