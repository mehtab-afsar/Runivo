import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Crosshair } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getAllTerritories, StoredTerritory, getPlayer } from '@shared/services/store';
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
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const [territories, setTerritories] = useState<StoredTerritory[]>([]);
  const [selectedTerritory, setSelectedTerritory] = useState<TerritoryDetail | null>(null);
  const [stats, setStats] = useState({ owned: 0, enemy: 0, neutral: 0, totalDefense: 0 });
  const [activeFilter, setActiveFilter] = useState<MapFilter>('all');
  const [mapStyle, setMapStyle] = useState<MapStyle>('standard');
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

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
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
        <style>
          @keyframes pulse-ring {
            0% { transform: scale(0.5); opacity: 1; }
            100% { transform: scale(1.8); opacity: 0; }
          }
        </style>
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

  return (
    <div className="fixed inset-0 bg-[#FAFAFA]" style={{ width: '100vw', height: '100dvh', minHeight: '100vh' }}>
      <div ref={mapContainer} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }} />

      {/* Top Stats Bar */}
      <div className="absolute left-4 right-4 z-20" style={{ top: 'max(12px, env(safe-area-inset-top))' }}>
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl p-3 flex items-center justify-around shadow-md border border-gray-100">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-teal-500" />
            <span className="text-stat text-sm font-bold text-gray-900">{stats.owned}</span>
            <span className="text-[10px] text-gray-400">owned</span>
          </div>
          <div className="w-px h-5 bg-gray-200" />
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-pink-500" />
            <span className="text-stat text-sm font-bold text-gray-900">{stats.enemy}</span>
            <span className="text-[10px] text-gray-400">enemy</span>
          </div>
          <div className="w-px h-5 bg-gray-200" />
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
            <span className="text-stat text-sm font-bold text-gray-900">{stats.neutral}</span>
            <span className="text-[10px] text-gray-400">free</span>
          </div>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="absolute left-4 right-4 z-20" style={{ top: 'max(68px, calc(env(safe-area-inset-top) + 56px))' }}>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {filters.map(f => (
            <button
              key={f.id}
              onClick={() => { setActiveFilter(f.id); haptic('light'); }}
              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all ${
                activeFilter === f.id
                  ? 'bg-teal-50 text-teal-600 border border-teal-200'
                  : 'bg-white/90 backdrop-blur text-gray-500 border border-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Right Side Controls */}
      <div className="absolute right-4 z-20 flex flex-col gap-2" style={{ top: 'max(120px, calc(env(safe-area-inset-top) + 108px))' }}>
        {/* My Location */}
        <button
          onClick={recenterMap}
          className={`w-10 h-10 rounded-full bg-white shadow-md border border-gray-100 flex items-center justify-center active:scale-90 transition ${
            isLocating ? 'animate-pulse' : ''
          }`}
        >
          <Crosshair className={`w-[18px] h-[18px] ${isLocating ? 'text-teal-500' : 'text-gray-500'}`} strokeWidth={2} />
        </button>

        {/* Map Style Toggle */}
        <button
          onClick={() => { setShowStylePicker(!showStylePicker); haptic('light'); }}
          className={`w-10 h-10 rounded-full bg-white shadow-md border border-gray-100 flex items-center justify-center active:scale-90 transition ${
            showStylePicker ? 'ring-2 ring-teal-400' : ''
          }`}
        >
          <Layers className="w-[18px] h-[18px] text-gray-500" strokeWidth={2} />
        </button>
      </div>

      {/* Map Style Picker */}
      <AnimatePresence>
        {showStylePicker && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-25"
              onClick={() => setShowStylePicker(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -8 }}
              transition={{ type: 'spring', damping: 22, stiffness: 300 }}
              className="absolute right-4 z-30 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 w-[200px]"
              style={{ top: 'max(176px, calc(env(safe-area-inset-top) + 164px))' }}
            >
              <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold block mb-2 px-1">
                Map Type
              </span>
              <div className="grid grid-cols-3 gap-2">
                {MAP_STYLES.map(style => (
                  <button
                    key={style.id}
                    onClick={() => changeMapStyle(style.id)}
                    className="flex flex-col items-center gap-1"
                  >
                    <div className={`w-14 h-14 rounded-xl border-2 transition-all ${
                      mapStyle === style.id
                        ? 'border-teal-500 shadow-sm'
                        : 'border-gray-200'
                    }`} style={{ backgroundColor: style.preview }} />
                    <span className={`text-[10px] font-medium ${
                      mapStyle === style.id ? 'text-teal-600' : 'text-gray-500'
                    }`}>
                      {style.label}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Territory Detail Bottom Sheet */}
      <AnimatePresence>
        {selectedTerritory && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-30"
              onClick={() => setSelectedTerritory(null)}
            />
            <motion.div
              initial={{ y: 300, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 300, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute bottom-16 left-0 right-0 z-40"
            >
              <div className="bg-white rounded-t-3xl border-t border-gray-200 shadow-xl p-6">
                <div className="flex justify-center mb-4 -mt-2">
                  <div className="w-8 h-1 rounded-full bg-gray-200" />
                </div>

                <div className="flex items-start justify-between mb-5">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold uppercase tracking-wider ${tierColors[selectedTerritory.tier] || 'text-gray-400'}`}>
                        {selectedTerritory.tier}
                      </span>
                      <span className="text-xs text-gray-300">.</span>
                      <span className="text-xs text-gray-400 font-mono">
                        {selectedTerritory.hexId.slice(0, 12)}...
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {selectedTerritory.status === 'owned'
                        ? 'Your Territory'
                        : selectedTerritory.status === 'enemy'
                        ? `${selectedTerritory.ownerName}'s Zone`
                        : 'Unclaimed Zone'}
                    </h3>
                  </div>
                  <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                    selectedTerritory.status === 'owned'
                      ? 'bg-teal-50 text-teal-600'
                      : selectedTerritory.status === 'enemy'
                      ? 'bg-pink-50 text-pink-600'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {selectedTerritory.status.toUpperCase()}
                  </div>
                </div>

                <div className="mb-5">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-400">Defense Strength</span>
                    <span className="text-stat text-sm font-bold text-gray-900">{selectedTerritory.defense}/100</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        selectedTerritory.defense > 70
                          ? 'bg-green-400'
                          : selectedTerritory.defense > 30
                          ? 'bg-yellow-400'
                          : 'bg-red-400'
                      }`}
                      style={{ width: `${selectedTerritory.defense}%` }}
                    />
                  </div>
                </div>

                {selectedTerritory.status === 'enemy' && (
                  <button
                    onClick={() => { setSelectedTerritory(null); navigate('/run'); haptic('medium'); }}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-pink-500 to-pink-400
                               text-sm font-bold text-white active:scale-[0.97] transition
                               shadow-[0_4px_16px_rgba(220,38,127,0.2)]"
                  >
                    Attack This Territory
                  </button>
                )}
                {selectedTerritory.status === 'owned' && (
                  <button
                    onClick={() => { setSelectedTerritory(null); navigate('/run'); haptic('medium'); }}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-500 to-teal-600
                               text-sm font-bold text-white active:scale-[0.97] transition
                               shadow-[0_4px_16px_rgba(0,180,198,0.2)]"
                  >
                    Fortify - Run to Strengthen
                  </button>
                )}
                {selectedTerritory.status === 'neutral' && (
                  <button
                    onClick={() => { setSelectedTerritory(null); navigate('/run'); haptic('medium'); }}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-500 to-teal-600
                               text-sm font-bold text-white active:scale-[0.97] transition
                               shadow-[0_4px_16px_rgba(0,180,198,0.2)]"
                  >
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
