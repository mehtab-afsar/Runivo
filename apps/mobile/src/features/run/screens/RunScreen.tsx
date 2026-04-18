/**
 * RunScreen — pre-run setup tab. ≤80 lines.
 * Fetches: GPS, intel, routes via useRunSetup.
 * Renders: RunMapView, RunSetupSheet, ActivityModal, RouteModal.
 */
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSettings } from '@shared/services/store';

import { useRunSetup } from '../hooks/useRunSetup';
import { useBeatPacer } from '../hooks/useBeatPacer';
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
  const insets = useSafeAreaInsets();
  const MAP_STYLE_URLS: Record<string, string> = {
    Standard:  'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    Dark:      'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    Light:     'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    Terrain:   'https://tile.opentopomap.org/{z}/{x}/{y}.png',
    Satellite: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  };
  const [mapStyle, setMapStyle] = React.useState(MAP_STYLE_URLS.Standard);

  useEffect(() => {
    getSettings().then(s => {
      if (s.mapStyle && MAP_STYLE_URLS[s.mapStyle]) {
        setMapStyle(MAP_STYLE_URLS[s.mapStyle]);
      }
    });
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
    <View style={ss.root}>
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

const ss = StyleSheet.create({ root: { flex: 1, backgroundColor: '#F7F6F4' } });
