import React, { useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Circle, Polyline, useMap, useMapEvents } from 'react-leaflet';
import { LatLngExpression } from 'leaflet';
import type { Territory, Location } from '@/types';
import { getTerritoryColor } from '@/data/mockData';
import 'leaflet/dist/leaflet.css';

interface TerritoryMapProps {
  territories: Territory[];
  currentLocation?: Location;
  runRoute?: Location[];
  center?: Location;
  zoom?: number;
  className?: string;
  onTerritoryClick?: (territory: Territory) => void;
}

// Component to update map view when location changes
const MapUpdater: React.FC<{ center: Location; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();

  useEffect(() => {
    try {
      // Add a small delay to ensure map is fully initialized
      const timeout = setTimeout(() => {
        if (map && map.setView && typeof map.invalidateSize === 'function') {
          map.setView([center.lat, center.lng], zoom);
          map.invalidateSize();
        }
      }, 100);

      return () => clearTimeout(timeout);
    } catch (error) {
      console.warn('Map update error:', error);
    }
  }, [map, center, zoom]);

  return null;
};

// Component to handle map initialization
const MapInitializer: React.FC = () => {
  const map = useMapEvents({
    load: () => {
      // Map is fully loaded, invalidate size to fix positioning
      setTimeout(() => {
        map.invalidateSize();
      }, 50);
    },
  });

  return null;
};

export const TerritoryMap: React.FC<TerritoryMapProps> = ({
  territories,
  currentLocation,
  runRoute = [],
  center = { lat: 28.6139, lng: 77.2090 },
  zoom = 15,
  className = '',
  onTerritoryClick,
}) => {
  const mapCenter = useMemo(() => {
    return currentLocation || center;
  }, [currentLocation, center]);

  const territoryPolygons = useMemo(() => {
    return territories.map(territory => {
      const { color, fillColor } = getTerritoryColor(territory.status);
      const positions: LatLngExpression[] = territory.polygon.map(point => [point.lat, point.lng]);

      return (
        <Polygon
          key={territory.id}
          positions={positions}
          pathOptions={{
            color,
            fillColor,
            fillOpacity: 0.3,
            weight: 2,
            opacity: 0.8,
          }}
          eventHandlers={{
            click: () => onTerritoryClick?.(territory),
          }}
        />
      );
    });
  }, [territories, onTerritoryClick]);

  const runRoutePolyline = useMemo(() => {
    if (runRoute.length < 2) return null;

    const positions: LatLngExpression[] = runRoute.map(point => [point.lat, point.lng]);

    return (
      <Polyline
        positions={positions}
        pathOptions={{
          color: '#CAFF00',
          weight: 4,
          opacity: 0.8,
        }}
      />
    );
  }, [runRoute]);

  return (
    <div className={`w-full h-full ${className}`} style={{ minHeight: '400px' }}>
      <MapContainer
        center={[mapCenter.lat, mapCenter.lng]}
        zoom={zoom}
        style={{ height: '100%', width: '100%', minHeight: '400px' }}
        zoomControl={true}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        <MapInitializer />
        <MapUpdater center={mapCenter} zoom={zoom} />

        {territoryPolygons}
        {runRoutePolyline}

        {currentLocation && (
          <Circle
            center={[currentLocation.lat, currentLocation.lng]}
            radius={10}
            pathOptions={{
              color: '#CAFF00',
              fillColor: '#CAFF00',
              fillOpacity: 0.8,
              weight: 3,
            }}
          />
        )}

        {currentLocation && (
          <Circle
            center={[currentLocation.lat, currentLocation.lng]}
            radius={50}
            pathOptions={{
              color: '#CAFF00',
              fillColor: 'transparent',
              fillOpacity: 0,
              weight: 1,
              opacity: 0.3,
              dashArray: '5, 10',
            }}
          />
        )}
      </MapContainer>
    </div>
  );
};