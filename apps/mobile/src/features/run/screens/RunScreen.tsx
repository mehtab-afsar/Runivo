import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSettings } from '@shared/services/store';
import { postRunSync } from '@shared/services/sync';
import { useTheme, type AppColors } from '@theme';

import { useRunSetup } from '../hooks/useRunSetup';
import { useBeatPacer } from '../hooks/useBeatPacer';
import { findInterruptedRunCheckpoint, clearInterruptedRunCheckpoint } from '../hooks/useActiveRun';
import RunMapView    from '../components/RunMapView';
import RunSetupSheet from '../components/RunSetupSheet';
import ActivityModal from '../components/ActivityModal';
import RouteModal    from '../components/RouteModal';

function gpsColor(status: string, acc: number | null): string {
  if (status === 'error') return '#EF4444';
  if (status === 'searching' || acc === null) return '#D1D5DB';
  if (acc < 20) return '#22C55E';
  return acc < 50 ? '#F59E0B' : '#F87171';
}
function gpsLabel(status: string, acc: number | null): string {
  if (status === 'error') return 'GPS Error';
  if (status === 'searching' || acc === null) return 'Locating...';
  if (acc < 20) return 'GPS Strong';
  return acc < 50 ? 'GPS OK' : 'GPS Weak';
}

export default function RunScreen() {
  const C = useTheme();
  const s = useMemo(() => mkStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const TERRAIN_GL = JSON.stringify({ version: 8, sources: { 'raster-tiles': { type: 'raster', tiles: ['https://tile.opentopomap.org/{z}/{x}/{y}.png'], tileSize: 256 } }, layers: [{ id: 'simple-tiles', type: 'raster', source: 'raster-tiles' }] });
  const SATELLITE_GL = JSON.stringify({ version: 8, sources: { 'raster-tiles': { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256 } }, layers: [{ id: 'simple-tiles', type: 'raster', source: 'raster-tiles' }] });
  const MAP_STYLE_URLS: Record<string, string> = {
    Standard:  'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    Dark:      'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    Light:     'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    Terrain:   TERRAIN_GL,
    Satellite: SATELLITE_GL,
  };
  const [mapStyle, setMapStyle] = React.useState(MAP_STYLE_URLS.Standard);

  useEffect(() => {
    getSettings().then(st => {
      if (st.mapStyle && MAP_STYLE_URLS[st.mapStyle]) {
        setMapStyle(MAP_STYLE_URLS[st.mapStyle]);
      }
    });
  }, []);

  // Crash recovery: if a previous run was interrupted (app killed mid-run), the GPS
  // checkpoint still exists in AsyncStorage. Offer to sync it so the run isn't lost.
  useEffect(() => {
    findInterruptedRunCheckpoint().then(cp => {
      if (!cp || cp.points.length < 2) {
        if (cp) clearInterruptedRunCheckpoint();
        return;
      }
      const km = (cp.points.length * 3 / 1000).toFixed(1); // rough estimate
      Alert.alert(
        'Interrupted Run Found',
        `A run was interrupted before it could be saved (~${km} km of GPS data). Would you like to recover it?`,
        [
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => clearInterruptedRunCheckpoint(),
          },
          {
            text: 'Recover',
            onPress: async () => {
              await postRunSync();
              clearInterruptedRunCheckpoint();
            },
          },
        ],
      );
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const {
    activityType, setActivityType, gps, intel,
    savedRoutes, nearbyRoutes, nearbyLoading,
    selectedRoute, setSelectedRoute,
    showActivityModal, setShowActivityModal,
    showRouteModal, setShowRouteModal,
    sheetAnim, panResponder,
    openRouteModal, findNearby, startRun,
  } = useRunSetup();
  const pacer = useBeatPacer();

  return (
    <View style={s.root}>
      <RunMapView
        lat={gps.lat}
        lng={gps.lng}
        gpsStatus={gps.status}
        mapStyle={mapStyle}
        onMapStyleChange={setMapStyle}
        sheetAnim={sheetAnim}
        topInset={insets.top}
        intelEnemy={intel.enemy}
        intelWeak={intel.weak}
        gpsColor={gpsColor(gps.status, gps.accuracy)}
        gpsLabel={gpsLabel(gps.status, gps.accuracy)}
      />
      <RunSetupSheet
        sheetAnim={sheetAnim}
        panHandlers={panResponder.panHandlers}
        activityType={activityType}
        selectedRouteName={selectedRoute?.name ?? null}
        intelEnemy={intel.enemy}
        intelNeutral={intel.neutral}
        intelWeak={intel.weak}
        gpsReady={gps.status === 'ready'}
        bottomInset={insets.bottom}
        pacerEnabled={pacer.enabled}
        pacerBpm={pacer.bpm}
        pacerPace={pacer.pace}
        pacerPaceOptions={pacer.paceOptions}
        onPacerToggle={() => pacer.setEnabled(!pacer.enabled)}
        onPacerPaceEdit={pacer.setPace}
        onActivityPress={() => setShowActivityModal(true)}
        onRoutePress={openRouteModal}
        onStartPress={startRun}
      />
      <ActivityModal
        visible={showActivityModal}
        selected={activityType}
        bottomInset={insets.bottom}
        onSelect={type => { setActivityType(type); setShowActivityModal(false); }}
        onClose={() => setShowActivityModal(false)}
      />
      <RouteModal
        visible={showRouteModal}
        savedRoutes={savedRoutes}
        nearbyRoutes={nearbyRoutes}
        nearbyLoading={nearbyLoading}
        gpsReady={gps.status === 'ready'}
        selectedRouteName={selectedRoute?.name ?? null}
        bottomInset={insets.bottom}
        onSelectRoute={(name, pts) => setSelectedRoute({ name, gpsPoints: pts })}
        onClearRoute={() => setSelectedRoute(null)}
        onFindNearby={findNearby}
        onClose={() => setShowRouteModal(false)}
      />
    </View>
  );
}

function mkStyles(C: AppColors) {
  return StyleSheet.create({ root: { flex: 1, backgroundColor: C.bg } });
}
