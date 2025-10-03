import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

interface MapLibreMapProps {
  center: [number, number] // [lng, lat]
  zoom?: number
  pitch?: number
  bearing?: number
  is3DEnabled?: boolean
  selectedLayer: string
  userLocation?: { lat: number; lng: number } | null
  routePoints?: Array<{ lat: number; lng: number; timestamp: number }>
  onMapLoad?: (map: maplibregl.Map) => void
}

export const MapLibreMap = ({
  center,
  zoom = 16,
  pitch = 0,
  bearing = 0,
  is3DEnabled = false,
  selectedLayer,
  userLocation,
  routePoints = [],
  onMapLoad
}: MapLibreMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const userMarker = useRef<maplibregl.Marker | null>(null)
  const [isMapLoaded, setIsMapLoaded] = useState(false)

  // Get tile URLs based on selected layer (all free, no API keys required)
  const getTileUrls = (layer: string): string[] => {
    switch (layer) {
      case 'cycle':
        // CyclOSM - Free cycling map
        return [
          'https://a.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
          'https://b.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
          'https://c.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png'
        ]
      case 'transport':
        // OpenPTMap overlay on top of OSM for public transport
        return [
          'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
        ]
      case 'terrain':
        // OpenTopoMap - Free topographic map
        return [
          'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
          'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
          'https://c.tile.opentopomap.org/{z}/{x}/{y}.png'
        ]
      case 'standard':
      default:
        // Standard OpenStreetMap
        return [
          'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
        ]
    }
  }

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: getTileUrls(selectedLayer),
            tileSize: 256,
            attribution: '&copy; OpenStreetMap Contributors',
            scheme: 'xyz'
          },
          'terrain-source': {
            type: 'raster-dem',
            tiles: [
              'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
            ],
            minzoom: 0,
            maxzoom: 15,
            tileSize: 256,
            encoding: 'terrarium'
          }
        },
        layers: [
          {
            id: 'osm-tiles-layer',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19
          }
        ],
        terrain: is3DEnabled ? {
          source: 'terrain-source',
          exaggeration: 1.5
        } : undefined
      },
      center: center,
      zoom: zoom,
      pitch: pitch,
      bearing: bearing,
      maxPitch: 85,
      attributionControl: false
    })

    map.current.on('load', () => {
      setIsMapLoaded(true)
      if (onMapLoad && map.current) {
        onMapLoad(map.current)
      }
    })

    // Add error handler
    map.current.on('error', (e) => {
      console.error('MapLibre error:', e)
    })

    // Add source data handler
    map.current.on('sourcedata', (e) => {
      if (e.sourceId === 'terrain-source' && e.isSourceLoaded) {
        console.log('Terrain source loaded')
      }
    })

    // Add navigation controls
    map.current.addControl(new maplibregl.NavigationControl({
      visualizePitch: true
    }), 'top-right')

    return () => {
      if (userMarker.current) {
        userMarker.current.remove()
      }
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])

  // Update map layer when selectedLayer changes
  useEffect(() => {
    if (!map.current || !isMapLoaded) return

    const source = map.current.getSource('osm-tiles') as maplibregl.RasterTileSource
    if (source) {
      console.log('Switching to layer:', selectedLayer)

      // Save current terrain state
      const currentTerrain = map.current.getTerrain()

      // Remove old source and layer
      map.current.removeLayer('osm-tiles-layer')
      map.current.removeSource('osm-tiles')

      // Add new source and layer with unique cache-busting scheme
      map.current.addSource('osm-tiles', {
        type: 'raster',
        tiles: getTileUrls(selectedLayer),
        tileSize: 256,
        attribution: '&copy; OpenStreetMap Contributors',
        scheme: 'xyz'
      })

      // Add layer before route layer if it exists, otherwise add normally
      const beforeLayerId = map.current.getLayer('route-line') ? 'route-line' : undefined

      map.current.addLayer({
        id: 'osm-tiles-layer',
        type: 'raster',
        source: 'osm-tiles',
        minzoom: 0,
        maxzoom: 19
      }, beforeLayerId)

      // Re-apply terrain if it was enabled
      if (currentTerrain) {
        console.log('Re-applying terrain after layer switch')
        setTimeout(() => {
          if (map.current) {
            map.current.setTerrain(currentTerrain)
          }
        }, 100)
      }

      // Force map refresh
      map.current.triggerRepaint()
    }
  }, [selectedLayer, isMapLoaded])

  // Update 3D terrain
  useEffect(() => {
    if (!map.current || !isMapLoaded) return

    try {
      if (is3DEnabled) {
        console.log('Enabling 3D terrain...')

        // Check if terrain source exists
        const terrainSource = map.current.getSource('terrain-source')
        if (!terrainSource) {
          console.error('Terrain source not found!')
          return
        }

        map.current.setTerrain({
          source: 'terrain-source',
          exaggeration: 1.5
        })
        map.current.easeTo({ pitch: 60, duration: 1000 })
        console.log('3D terrain enabled successfully')
      } else {
        console.log('Disabling 3D terrain...')
        map.current.setTerrain(null)
        map.current.easeTo({ pitch: 0, duration: 1000 })
      }
    } catch (error) {
      console.error('Error toggling 3D terrain:', error)
    }
  }, [is3DEnabled, isMapLoaded])

  // Update center
  useEffect(() => {
    if (!map.current || !isMapLoaded) return
    map.current.setCenter(center)
  }, [center[0], center[1], isMapLoaded])

  // Update user location marker
  useEffect(() => {
    if (!map.current || !isMapLoaded || !userLocation) return

    if (!userMarker.current) {
      // Create custom marker element
      const el = document.createElement('div')
      el.className = 'user-location-marker'
      el.style.width = '20px'
      el.style.height = '20px'
      el.style.borderRadius = '50%'
      el.style.backgroundColor = '#4285F4'
      el.style.border = '3px solid white'
      el.style.boxShadow = '0 0 10px rgba(0,0,0,0.3)'

      userMarker.current = new maplibregl.Marker({ element: el })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map.current)
    } else {
      userMarker.current.setLngLat([userLocation.lng, userLocation.lat])
    }
  }, [userLocation, isMapLoaded])

  // Draw route path
  useEffect(() => {
    if (!map.current || !isMapLoaded || routePoints.length < 2) return

    const coordinates = routePoints.map(point => [point.lng, point.lat])

    if (map.current.getSource('route')) {
      const source = map.current.getSource('route') as maplibregl.GeoJSONSource
      source.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: coordinates
        }
      })
    } else {
      map.current.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: coordinates
          }
        }
      })

      map.current.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#FF6B35',
          'line-width': 4,
          'line-opacity': 0.8
        }
      })
    }
  }, [routePoints, isMapLoaded])

  return (
    <div
      ref={mapContainer}
      className="w-full h-full"
      style={{ filter: 'brightness(0.7)' }}
    />
  )
}
