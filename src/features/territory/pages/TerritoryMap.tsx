import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Crosshair } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getAllTerritories, StoredTerritory, getPlayer } from '@shared/services/store';
import { useTheme } from '@shared/hooks/useTheme';
import { addTerritoryOverlay } from '@features/territory/services/territoryLayer';
import { haptic } from '@shared/lib/haptics';

interface TerritoryDetail {
  hexId: string;
  status: string;
  ownerName: string | null;
  defense: number;
  tier: string;
}

type MapFilter = 'all' | 'mine' | 'enemy' | 'weak' | 'neutral';

type MapStyle = 'standard' | 'satellite' | 'dark' | 'terrain' | 'light';

interface MapStyleDef {
  id: MapStyle;
  label: string;
  preview: string;
  styleUrl?: string;
  rasterTiles?: string[];
  sourceMaxZoom?: number;
}

const MAP_STYLES: MapStyleDef[] = [
  { id: 'standard', label: 'Standard', preview: '#E8F5E9', styleUrl: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json' },
  { id: 'dark',     label: 'Dark',     preview: '#263238', styleUrl: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json' },
  { id: 'light',    label: 'Light',    preview: '#FAFAFA', styleUrl: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json' },
  {
    id: 'terrain', label: 'Terrain', preview: '#C8E6C9', sourceMaxZoom: 17,
    rasterTiles: ['https://a.tile.opentopomap.org/{z}/{x}/{y}.png', 'https://b.tile.opentopomap.org/{z}/{x}/{y}.png', 'https://c.tile.opentopomap.org/{z}/{x}/{y}.png'],
  },
  {
    id: 'satellite', label: 'Satellite', preview: '#1B5E20', sourceMaxZoom: 18,
    rasterTiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
  },
];

function buildRasterStyle(tiles: string[], sourceMaxZoom = 19): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {
      'raster-tiles': { type: 'raster', tiles, tileSize: 256, attribution: '&copy; OpenStreetMap / Esri', maxzoom: sourceMaxZoom },
    },
    layers: [{ id: 'raster-layer', type: 'raster', source: 'raster-tiles', minzoom: 0, maxzoom: 22 }],
  };
}

export default function TerritoryMap() {
  const navigate = useNavigate();
  const { dark } = useTheme();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const [territories, setTerritories] = useState<StoredTerritory[]>([]);
  const [selectedTerritory, setSelectedTerritory] = useState<TerritoryDetail | null>(null);
  const [stats, setStats] = useState({ owned: 0, enemy: 0, neutral: 0, totalDefense: 0 });
  const [activeFilter, setActiveFilter] = useState<MapFilter>('all');
  const [mapStyle, setMapStyle] = useState<MapStyle>(() => dark ? 'dark' : 'standard');
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const userLngLatRef = useRef<[number, number] | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const player = await getPlayer();
    const allTerritories = await getAllTerritories();
    setTerritories(allTerritories);

    if (player) {
      const owned = allTerritories.filter(t => t.ownerId === player.id);
      const enemy = allTerritories.filter(t => t.ownerId && t.ownerId !== player.id);
      const neutral = allTerritories.filter(t => !t.ownerId);
      setStats({
        owned: owned.length,
        enemy: enemy.length,
        neutral: neutral.length,
        totalDefense: owned.reduce((sum, t) => sum + t.defense, 0),
      });
    }
  };

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const initialStyle = MAP_STYLES.find(s => s.id === (dark ? 'dark' : 'standard'))!;
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: initialStyle.styleUrl!,
      center: [77.2090, 28.6139],
      zoom: 14,
      attributionControl: false,
    });

    map.on('load', () => {
      mapRef.current = map;
      setTimeout(() => map.resize(), 0);

      // Create user location marker
      const markerEl = document.createElement('div');
      markerEl.innerHTML = `
        <div style="position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;inset:0;border-radius:50%;background:rgba(0,180,198,0.15);animation:pulse-ring 2s ease-out infinite;"></div>
          <div style="width:14px;height:14px;border-radius:50%;background:#00B4C6;border:3px solid white;box-shadow:0 2px 8px rgba(0,180,198,0.4);position:relative;z-index:1;"></div>
        </div>
      `;
      const marker = new maplibregl.Marker({ element: markerEl, anchor: 'center' })
        .setLngLat([77.2090, 28.6139]);
      userMarkerRef.current = marker;

      // Watch user position
      watchIdRef.current = navigator.geolocation.watchPosition(
        pos => {
          const lngLat: [number, number] = [pos.coords.longitude, pos.coords.latitude];
          userLngLatRef.current = lngLat;
          if (userMarkerRef.current) {
            userMarkerRef.current.setLngLat(lngLat);
            if (!userMarkerRef.current.getElement().parentElement) {
              userMarkerRef.current.addTo(map);
            }
          }
          // Fly to user on first position
          if (!map.getBounds().contains(lngLat)) {
            map.flyTo({ center: lngLat, zoom: 15 });
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 10000 }
      );
    });

    const ro = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.resize();
    });
    ro.observe(mapContainer.current);

    return () => {
      ro.disconnect();
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || territories.length === 0) return;

    (async () => {
      const player = await getPlayer();
      if (player && mapRef.current) {
        addTerritoryOverlay(mapRef.current, territories, { playerId: player.id, showLabels: true });
      }
    })();
  }, [territories]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as TerritoryDetail;
      setSelectedTerritory(detail);
      haptic('light');
    };
    window.addEventListener('territory-click', handler);
    return () => window.removeEventListener('territory-click', handler);
  }, []);

  const recenterMap = () => {
    haptic('light');
    // Use cached location from watchPosition if available
    if (userLngLatRef.current && mapRef.current) {
      mapRef.current.flyTo({ center: userLngLatRef.current, zoom: 15, duration: 800 });
      return;
    }
    // Fallback to getCurrentPosition
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lngLat: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        userLngLatRef.current = lngLat;
        mapRef.current?.flyTo({ center: lngLat, zoom: 15, duration: 800 });
        // Update marker too
        if (userMarkerRef.current && mapRef.current) {
          userMarkerRef.current.setLngLat(lngLat);
          if (!userMarkerRef.current.getElement().parentElement) {
            userMarkerRef.current.addTo(mapRef.current);
          }
        }
        setIsLocating(false);
      },
      () => setIsLocating(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const changeMapStyle = (style: MapStyle) => {
    if (!mapRef.current || style === mapStyle) return;
    setMapStyle(style);
    setShowStylePicker(false);
    haptic('light');

    const styleDef = MAP_STYLES.find(s => s.id === style) || MAP_STYLES[0];
    const currentCenter = mapRef.current.getCenter();
    const currentZoom = mapRef.current.getZoom();
    const currentPitch = mapRef.current.getPitch();
    const currentBearing = mapRef.current.getBearing();

    const newStyle = styleDef.rasterTiles
      ? buildRasterStyle(styleDef.rasterTiles, styleDef.sourceMaxZoom)
      : styleDef.styleUrl!;

    mapRef.current.setStyle(newStyle);
    mapRef.current.once('style.load', () => {
      mapRef.current?.jumpTo({ center: currentCenter, zoom: currentZoom, pitch: currentPitch, bearing: currentBearing });
      // Re-add territory overlay
      (async () => {
        const player = await getPlayer();
        if (player && mapRef.current) {
          addTerritoryOverlay(mapRef.current, territories, { playerId: player.id, showLabels: true });
        }
      })();
      // Re-add user marker
      if (userMarkerRef.current && userLngLatRef.current && mapRef.current) {
        userMarkerRef.current.setLngLat(userLngLatRef.current);
        if (!userMarkerRef.current.getElement().parentElement) {
          userMarkerRef.current.addTo(mapRef.current);
        }
      }
    });
  };

  // Sync map style when dark mode toggles
  useEffect(() => {
    changeMapStyle(dark ? 'dark' : 'standard');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark]);

  const filters: { id: MapFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'mine', label: 'Mine' },
    { id: 'enemy', label: 'Enemy' },
    { id: 'weak', label: 'Weak' },
    { id: 'neutral', label: 'Free' },
  ];

  const tierColors: Record<string, string> = {
    common: 'text-gray-400',
    uncommon: 'text-emerald-500',
    rare: 'text-blue-500',
    epic: 'text-purple-500',
    legendary: 'text-amber-500',
  };

  const card  = dark ? 'bg-black/60 border-white/10' : 'bg-white/90 border-black/[0.06]';
  const text  = dark ? 'text-white'   : 'text-gray-900';
  const muted = dark ? 'text-white/40' : 'text-gray-400';
  const div   = dark ? 'bg-white/10'  : 'bg-gray-200';
  const pill  = dark
    ? 'bg-white/10 border-white/10 text-white/60'
    : 'bg-white/80 border-gray-200 text-gray-500';
  const pillActive = dark
    ? 'bg-teal-500/20 border-teal-400/40 text-teal-300'
    : 'bg-teal-50 border-teal-200 text-teal-600';
  const btn   = dark
    ? 'bg-black/50 border-white/10 text-white/70'
    : 'bg-white border-gray-100 text-gray-600';
  const sheet = dark ? 'bg-[#111] border-white/10' : 'bg-white border-gray-200';

  return (
    <div className="fixed inset-0" style={{ width: '100vw', height: '100dvh', minHeight: '100vh' }}>
      <div ref={mapContainer} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      {/* ── Header: stats + back ─────────────────────────────────── */}
      <div className="absolute left-3 right-3 z-20" style={{ top: 'max(10px, env(safe-area-inset-top))' }}>
        <div className={`backdrop-blur-2xl rounded-2xl border px-4 py-2.5 flex items-center gap-3 shadow-lg ${card}`}>
          {/* Back */}
          <button
            onClick={() => navigate(-1)}
            className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${dark ? 'bg-white/10 text-white/60' : 'bg-gray-100 text-gray-500'}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          {/* Title */}
          <span className={`text-[13px] font-bold tracking-tight flex-1 ${text}`}>Territory Map</span>

          {/* Stats */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-teal-400" />
              <span className={`text-[11px] font-semibold ${text}`}>{stats.owned}</span>
              <span className={`text-[10px] ${muted}`}>owned</span>
            </div>
            <div className={`w-px h-3.5 ${div}`} />
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-pink-400" />
              <span className={`text-[11px] font-semibold ${text}`}>{stats.enemy}</span>
              <span className={`text-[10px] ${muted}`}>enemy</span>
            </div>
            <div className={`w-px h-3.5 ${div}`} />
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${dark ? 'bg-white/25' : 'bg-gray-300'}`} />
              <span className={`text-[11px] font-semibold ${text}`}>{stats.neutral}</span>
              <span className={`text-[10px] ${muted}`}>free</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filter pills ─────────────────────────────────────────── */}
      <div className="absolute left-3 right-3 z-20" style={{ top: 'max(66px, calc(env(safe-area-inset-top) + 56px))' }}>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {filters.map(f => (
            <button
              key={f.id}
              onClick={() => { setActiveFilter(f.id); haptic('light'); }}
              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap border backdrop-blur-xl transition-all ${
                activeFilter === f.id ? pillActive : pill
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Right controls ───────────────────────────────────────── */}
      <div className="absolute right-3 z-20 flex flex-col gap-2" style={{ top: 'max(118px, calc(env(safe-area-inset-top) + 108px))' }}>
        <button
          onClick={recenterMap}
          className={`w-10 h-10 rounded-full border backdrop-blur-xl flex items-center justify-center shadow-md active:scale-90 transition ${btn} ${isLocating ? 'animate-pulse' : ''}`}
        >
          <Crosshair className={`w-[17px] h-[17px] ${isLocating ? 'text-teal-400' : ''}`} strokeWidth={2} />
        </button>
        <button
          onClick={() => { setShowStylePicker(!showStylePicker); haptic('light'); }}
          className={`w-10 h-10 rounded-full border backdrop-blur-xl flex items-center justify-center shadow-md active:scale-90 transition ${btn} ${showStylePicker ? 'ring-2 ring-teal-400' : ''}`}
        >
          <Layers className="w-[17px] h-[17px]" strokeWidth={2} />
        </button>
      </div>

      {/* ── Map style picker ─────────────────────────────────────── */}
      <AnimatePresence>
        {showStylePicker && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-25" onClick={() => setShowStylePicker(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: -6 }}
              transition={{ type: 'spring', damping: 22, stiffness: 300 }}
              className={`absolute right-3 z-30 rounded-2xl shadow-2xl border backdrop-blur-2xl p-3 w-[196px] ${dark ? 'bg-[#1a1a1a]/90 border-white/10' : 'bg-white/95 border-gray-100'}`}
              style={{ top: 'max(174px, calc(env(safe-area-inset-top) + 164px))' }}
            >
              <span className={`text-[10px] uppercase tracking-widest font-semibold block mb-2.5 px-0.5 ${muted}`}>
                Map Style
              </span>
              <div className="grid grid-cols-3 gap-2">
                {MAP_STYLES.map(s => (
                  <button key={s.id} onClick={() => changeMapStyle(s.id)} className="flex flex-col items-center gap-1.5">
                    <div
                      className={`w-14 h-10 rounded-xl border-2 transition-all ${mapStyle === s.id ? 'border-teal-400 shadow-sm shadow-teal-400/20' : dark ? 'border-white/10' : 'border-gray-200'}`}
                      style={{ backgroundColor: s.preview }}
                    />
                    <span className={`text-[10px] font-medium ${mapStyle === s.id ? 'text-teal-400' : muted}`}>{s.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Territory detail sheet ───────────────────────────────── */}
      <AnimatePresence>
        {selectedTerritory && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.4 }} exit={{ opacity: 0 }}
              className={`absolute inset-0 z-30 ${dark ? 'bg-black' : 'bg-black'}`}
              onClick={() => setSelectedTerritory(null)} />
            <motion.div
              initial={{ y: 280, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 280, opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="absolute bottom-0 left-0 right-0 z-40"
            >
              <div className={`rounded-t-3xl border-t shadow-2xl p-6 pb-safe ${sheet}`}>
                <div className="flex justify-center mb-5 -mt-1">
                  <div className={`w-9 h-1 rounded-full ${dark ? 'bg-white/15' : 'bg-gray-200'}`} />
                </div>

                <div className="flex items-start justify-between mb-5">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${tierColors[selectedTerritory.tier] || muted}`}>
                        {selectedTerritory.tier}
                      </span>
                      <span className={`text-[10px] ${muted}`}>·</span>
                      <span className={`text-[10px] font-mono ${muted}`}>{selectedTerritory.hexId.slice(0, 10)}…</span>
                    </div>
                    <h3 className={`text-[17px] font-bold tracking-tight ${text}`}>
                      {selectedTerritory.status === 'owned'
                        ? 'Your Territory'
                        : selectedTerritory.status === 'enemy'
                        ? `${selectedTerritory.ownerName}'s Zone`
                        : 'Unclaimed Zone'}
                    </h3>
                  </div>
                  <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide ${
                    selectedTerritory.status === 'owned'
                      ? dark ? 'bg-teal-500/20 text-teal-300' : 'bg-teal-50 text-teal-600'
                      : selectedTerritory.status === 'enemy'
                      ? dark ? 'bg-pink-500/20 text-pink-300' : 'bg-pink-50 text-pink-500'
                      : dark ? 'bg-white/10 text-white/50' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {selectedTerritory.status.toUpperCase()}
                  </div>
                </div>

                <div className="mb-5">
                  <div className="flex justify-between items-center mb-2">
                    <span className={`text-[11px] ${muted}`}>Defense</span>
                    <span className={`text-stat text-[12px] font-bold ${text}`}>{selectedTerritory.defense}/100</span>
                  </div>
                  <div className={`h-1.5 rounded-full overflow-hidden ${dark ? 'bg-white/10' : 'bg-gray-100'}`}>
                    <div
                      className={`h-full rounded-full transition-all ${
                        selectedTerritory.defense > 70 ? 'bg-emerald-400'
                        : selectedTerritory.defense > 30 ? 'bg-amber-400'
                        : 'bg-red-400'
                      }`}
                      style={{ width: `${selectedTerritory.defense}%` }}
                    />
                  </div>
                </div>

                {selectedTerritory.status === 'enemy' && (
                  <button onClick={() => { setSelectedTerritory(null); navigate('/run'); haptic('medium'); }}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-sm font-bold text-white active:scale-[0.97] transition shadow-[0_4px_20px_rgba(236,72,153,0.3)]">
                    Attack This Territory
                  </button>
                )}
                {selectedTerritory.status === 'owned' && (
                  <button onClick={() => { setSelectedTerritory(null); navigate('/run'); haptic('medium'); }}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-500 to-teal-600 text-sm font-bold text-white active:scale-[0.97] transition shadow-[0_4px_20px_rgba(20,184,166,0.3)]">
                    Fortify — Run to Strengthen
                  </button>
                )}
                {selectedTerritory.status === 'neutral' && (
                  <button onClick={() => { setSelectedTerritory(null); navigate('/run'); haptic('medium'); }}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-500 to-teal-600 text-sm font-bold text-white active:scale-[0.97] transition shadow-[0_4px_20px_rgba(20,184,166,0.3)]">
                    Claim This Territory
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
