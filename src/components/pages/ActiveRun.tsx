import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Play, Pause, Square, MapPin, Crosshair, ChevronDown, Target, Layers, Maximize2, Route, Wifi, Battery, PersonStanding, Bike, Mountain, Waves, Snowflake, Map as MapIcon, Bus, Navigation } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MapLibreMap } from '@/components/map/MapLibreMap'

interface RoutePoint {
  lat: number
  lng: number
  timestamp: number
}

interface ActivityType {
  id: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  color: string
}

interface MapLayerType {
  id: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  description: string
  layer: string
}

export const ActiveRun = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { activityType: initialActivityType, startLocation } = location.state || {}

  // State
  const [isRunning, setIsRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [activityType, setActivityType] = useState<string>(initialActivityType || 'run')
  const [showActivityModal, setShowActivityModal] = useState(false)
  const [showLayerModal, setShowLayerModal] = useState(false)
  const [distance, setDistance] = useState(0)
  const [duration, setDuration] = useState(0)
  const [pace, setPace] = useState(0)
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(startLocation || null)
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(startLocation || null)
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([])
  const [gpsStatus, setGpsStatus] = useState<'searching' | 'found' | 'error'>('searching')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [selectedLayer, setSelectedLayer] = useState<string>('standard')
  const [is3DEnabled, setIs3DEnabled] = useState(false)

  // Refs
  const watchId = useRef<number | null>(null)
  const intervalId = useRef<NodeJS.Timeout | null>(null)
  const startTime = useRef<number>(0)
  const lastPosition = useRef<{ lat: number; lng: number } | null>(null)

  const activityTypes: ActivityType[] = [
    { id: 'run', label: 'Run', icon: PersonStanding, color: 'bg-blue-500' },
    { id: 'walk', label: 'Walk', icon: PersonStanding, color: 'bg-green-500' },
    { id: 'cycle', label: 'Cycle', icon: Bike, color: 'bg-purple-500' },
    { id: 'hike', label: 'Hike', icon: Mountain, color: 'bg-orange-500' },
    { id: 'swim', label: 'Swim', icon: Waves, color: 'bg-cyan-500' },
    { id: 'ski', label: 'Ski', icon: Snowflake, color: 'bg-indigo-500' }
  ]

  const mapLayers: MapLayerType[] = [
    { id: 'standard', label: 'Standard', icon: MapIcon, description: 'Default clean map', layer: 'mapnik' },
    { id: 'cycle', label: 'Cycle', icon: Bike, description: 'Optimized for cycling', layer: 'cyclemap' },
    { id: 'transport', label: 'Transport', icon: Bus, description: 'Shows public transport', layer: 'transportmap' },
    { id: 'terrain', label: 'Terrain', icon: Mountain, description: 'Topographic view', layer: 'mapnik' }
  ]

  // Format time helper
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  // Format distance helper
  const formatDistance = (meters: number) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`
    }
    return `${meters.toFixed(0)} m`
  }

  // Calculate distance between two points
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000 // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }

  // Start GPS tracking
  const startGPSTracking = () => {
    if (navigator.geolocation) {
      watchId.current = navigator.geolocation.watchPosition(
        (position) => {
          const newPosition = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            timestamp: Date.now()
          }

          setCurrentLocation(newPosition)
          setRoutePoints(prev => [...prev, newPosition])
          setGpsStatus('found')

          // Calculate distance if we have a previous position
          if (lastPosition.current && isRunning && !isPaused) {
            const distanceToAdd = calculateDistance(
              lastPosition.current.lat,
              lastPosition.current.lng,
              newPosition.lat,
              newPosition.lng
            )

            setDistance(prev => prev + distanceToAdd)
          }

          lastPosition.current = newPosition
        },
        (error) => {
          console.error('GPS Tracking Error:', error)
          if (error.code === 3) {
            console.log('GPS timeout, continuing with last known position')
          } else {
            setGpsStatus('error')
          }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
      )
    }
  }

  // Stop GPS tracking
  const stopGPSTracking = () => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
    }
  }

  // Start timer
  const startTimer = () => {
    startTime.current = Date.now() - (duration * 1000)
    intervalId.current = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTime.current) / 1000))
    }, 1000)
  }

  // Stop timer
  const stopTimer = () => {
    if (intervalId.current) {
      clearInterval(intervalId.current)
      intervalId.current = null
    }
  }

  // Calculate pace
  useEffect(() => {
    if (distance > 0 && duration > 0) {
      const paceInMinPerKm = (duration / 60) / (distance / 1000)
      setPace(paceInMinPerKm)
    }
  }, [distance, duration])

  // Start run
  const handleStart = () => {
    setIsRunning(true)
    setIsPaused(false)
    startGPSTracking()
    startTimer()
    lastPosition.current = currentLocation
    setShowActivityModal(false)
  }

  // Toggle fullscreen
  const handleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  // Handle back button
  const handleBack = () => {
    if (isRunning) {
      const confirm = window.confirm('Are you sure you want to exit? Your run will be lost.')
      if (!confirm) return
    }
    navigate(-1)
  }

  // Get current map layer
  const getCurrentLayer = () => {
    return mapLayers.find(layer => layer.id === selectedLayer) || mapLayers[0]
  }

  // Pause run
  const handlePause = () => {
    setIsPaused(true)
    stopTimer()
  }

  // Resume run
  const handleResume = () => {
    setIsPaused(false)
    startTimer()
  }

  // Finish run
  const handleFinish = () => {
    setIsRunning(false)
    setIsPaused(false)
    stopTimer()
    stopGPSTracking()

    navigate('/run-summary/1', {
      state: {
        runData: {
          activityType,
          distance,
          duration,
          pace,
          routePoints
        }
      }
    })
  }

  // Reset run
  const handleReset = () => {
    setDistance(0)
    setDuration(0)
    setPace(0)
    setRoutePoints([])
    lastPosition.current = null
  }

  // Initialize GPS on mount
  useEffect(() => {
    if (navigator.geolocation && startLocation) {
      setMapCenter(startLocation)
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const initialLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          }
          setCurrentLocation(initialLocation)
          setMapCenter(initialLocation)
          setGpsStatus('found')
        },
        (error) => {
          console.error('Initial GPS Error:', error)
          setGpsStatus('error')
          alert('Unable to get GPS location. Please enable location services and try again.')
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    }

    return () => {
      stopTimer()
      stopGPSTracking()
    }
  }, [])

  // Function to recenter map on current location
  const handleRecenter = () => {
    if (currentLocation) {
      setMapCenter({ ...currentLocation })
    }
  }

  const getCurrentActivity = () => {
    return activityTypes.find(type => type.id === activityType) || activityTypes[0]
  }

  const getGPSStatusColor = () => {
    switch (gpsStatus) {
      case 'found': return 'bg-green-400'
      case 'searching': return 'bg-yellow-400 animate-pulse'
      case 'error': return 'bg-red-400'
      default: return 'bg-gray-400'
    }
  }

  // Get current time
  const getCurrentTime = () => {
    const now = new Date()
    return `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`
  }

  // Format pace for display
  const formatPace = (paceValue: number) => {
    if (paceValue === 0) return '0:00'
    const minutes = Math.floor(paceValue)
    const seconds = Math.floor((paceValue % 1) * 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="fixed inset-0 bg-black z-[100]">
      {/* Map Background */}
      <div className="absolute inset-0">
        {mapCenter ? (
          <MapLibreMap
            center={[mapCenter.lng, mapCenter.lat]}
            zoom={16}
            is3DEnabled={is3DEnabled}
            selectedLayer={selectedLayer}
            userLocation={currentLocation}
            routePoints={routePoints}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
            <div className="text-white/60 text-center">
              <div className="animate-pulse mb-2">📍</div>
              <div className="text-sm">Getting your location...</div>
            </div>
          </div>
        )}
      </div>

      {/* Status Bar - Top */}
      <div className="absolute top-0 left-0 right-0 h-12 flex items-center justify-between px-4 z-20 bg-gradient-to-b from-black/60 to-transparent">
        <span className="text-white text-sm font-light">{getCurrentTime()}</span>
        <div className="flex items-center gap-2">
          <Wifi size={16} className="text-white" />
          <Battery size={16} className="text-white" />
        </div>
      </div>

      {/* Back Button - Top Left */}
      <button
        onClick={handleBack}
        className="absolute top-12 left-4 z-20 w-10 h-10 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center hover:bg-black/80 transition-colors"
      >
        <ChevronDown size={24} className="text-white" />
      </button>

      {/* Map Controls - Right Side */}
      <div className="absolute top-1/3 right-4 z-20 flex flex-col gap-2">
        <button
          onClick={() => setShowLayerModal(true)}
          className="w-10 h-10 rounded-lg bg-black/60 backdrop-blur-md flex items-center justify-center hover:bg-black/80 transition-colors"
          title="Map layers"
        >
          <Layers size={20} className="text-white" />
        </button>
        <button
          onClick={() => setIs3DEnabled(!is3DEnabled)}
          className={cn(
            "w-10 h-10 rounded-lg backdrop-blur-md flex items-center justify-center transition-colors text-white text-xs font-bold",
            is3DEnabled
              ? "bg-primary/80 hover:bg-primary"
              : "bg-black/60 hover:bg-black/80"
          )}
          title={is3DEnabled ? "Disable 3D" : "Enable 3D"}
        >
          3D
        </button>
        <button
          onClick={handleRecenter}
          className="w-10 h-10 rounded-lg bg-black/60 backdrop-blur-md flex items-center justify-center hover:bg-black/80 transition-colors"
          title="Center on my location"
        >
          <Crosshair size={20} className="text-white" />
        </button>
      </div>

      {/* Fullscreen Toggle - Bottom Right */}
      <button
        onClick={handleFullscreen}
        className="absolute bottom-32 right-4 z-20 w-10 h-10 rounded-lg bg-black/60 backdrop-blur-md flex items-center justify-center hover:bg-black/80 transition-colors"
        title="Toggle fullscreen"
      >
        <Maximize2 size={20} className="text-white" />
      </button>

      {/* Bottom Activity Panel */}
      <div className="absolute bottom-0 left-0 right-0 z-30 pointer-events-auto pb-safe">
        <div className="mx-3 mb-3">
          {/* Activity Header Card */}
          <div className="liquid-blur-card rounded-2xl px-4 py-2 mb-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {(() => {
                const Icon = getCurrentActivity().icon
                return <Icon size={24} className="text-white" />
              })()}
              <span className="text-white text-base font-light">{getCurrentActivity().label}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className={cn('w-2 h-2 rounded-full', getGPSStatusColor())} />
            </div>
          </div>

          {/* Stats Grid Card */}
          <div className="liquid-blur-card rounded-2xl px-4 py-3 mb-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="text-white text-lg font-light tracking-wide">{formatTime(duration)}</div>
                <div className="text-white/50 text-[10px] font-light uppercase tracking-wider mt-1">Time</div>
              </div>
              <div className="text-center">
                <div className="text-white text-2xl font-light tracking-wide">{formatPace(pace)}</div>
                <div className="text-white/50 text-[10px] font-light uppercase tracking-wider mt-1">Avg. Pace</div>
              </div>
              <div className="text-center">
                <div className="text-white text-lg font-light tracking-wide">{(distance / 1000).toFixed(2)}</div>
                <div className="text-white/50 text-[10px] font-light uppercase tracking-wider mt-1">Distance</div>
              </div>
            </div>
          </div>

          {/* Action Buttons Card */}
          <div className="liquid-blur-card rounded-2xl px-3 py-3">
            {!isRunning ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setShowActivityModal(true)}
                  className="flex flex-col items-center justify-center py-4 rounded-xl transition-all duration-200 backdrop-blur-sm border border-white/10 bg-white/10 hover:bg-white/20 hover:scale-105 active:scale-95"
                >
                  {(() => {
                    const Icon = getCurrentActivity().icon
                    return <Icon size={32} className="text-white mb-1.5" />
                  })()}
                  <span className="text-white/80 text-[10px] font-light">Change Sport</span>
                </button>

                <button
                  onClick={handleStart}
                  disabled={gpsStatus === 'error'}
                  className="flex flex-col items-center justify-center py-4 bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-white/10 disabled:to-white/5 disabled:cursor-not-allowed rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg"
                >
                  <Play size={26} fill="white" className="text-white mb-1.5" />
                  <span className="text-white text-[10px] font-medium tracking-wide">START</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={isPaused ? handleResume : handlePause}
                    className={cn(
                      'flex flex-col items-center justify-center py-4 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg',
                      isPaused
                        ? 'bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700'
                        : 'bg-gradient-to-br from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600'
                    )}
                  >
                    {isPaused ? (
                      <Play size={26} fill="white" className="text-white mb-1.5" />
                    ) : (
                      <Pause size={26} className="text-white mb-1.5" />
                    )}
                    <span className="text-white text-[10px] font-medium tracking-wide">
                      {isPaused ? 'RESUME' : 'PAUSE'}
                    </span>
                  </button>

                  <button
                    onClick={handleFinish}
                    className="flex flex-col items-center justify-center py-4 bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg"
                  >
                    <Square size={26} className="text-white mb-1.5" />
                    <span className="text-white text-[10px] font-medium tracking-wide">FINISH</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Activity Selector Modal - Circular */}
      {showActivityModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center animate-in fade-in duration-200"
          onClick={() => setShowActivityModal(false)}
        >
          <div
            className="relative w-[400px] h-[400px] animate-in zoom-in duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Circular Guide Ring */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-64 rounded-full border-2 border-dashed border-white/20 animate-spin-slow"></div>
            </div>

            {/* Center Circle */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-36 h-36 rounded-full liquid-blur-card flex flex-col items-center justify-center shadow-2xl ring-2 ring-white/20 animate-in zoom-in duration-300 delay-100">
                {(() => {
                  const Icon = getCurrentActivity().icon
                  return <Icon size={48} className="text-white mb-2" strokeWidth={1.5} />
                })()}
                <span className="text-white text-base font-light">{getCurrentActivity().label}</span>
                <span className="text-white/50 text-[10px] mt-1">Select Below</span>
              </div>
            </div>

            {/* Circular Activity Options */}
            {activityTypes.map((type, index) => {
              const angle = (index * 360) / activityTypes.length - 90 // Start from top
              const radius = 130
              const x = Math.cos((angle * Math.PI) / 180) * radius
              const y = Math.sin((angle * Math.PI) / 180) * radius
              const Icon = type.icon

              return (
                <button
                  key={type.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    setActivityType(type.id)
                    setShowActivityModal(false)
                  }}
                  className={cn(
                    'absolute w-24 h-24 rounded-full flex flex-col items-center justify-center transition-all duration-300 z-10',
                    'backdrop-blur-lg border-2 shadow-xl animate-in zoom-in cursor-pointer',
                    activityType === type.id
                      ? `${type.color} border-white/50 scale-110 shadow-2xl ring-4 ring-white/30`
                      : 'bg-white/15 border-white/30 hover:bg-white/25 hover:scale-110 hover:border-white/50 active:scale-95'
                  )}
                  style={{
                    left: `calc(50% + ${x}px - 48px)`,
                    top: `calc(50% + ${y}px - 48px)`,
                    animationDelay: `${index * 50}ms`,
                  }}
                >
                  <Icon size={36} className="text-white mb-1 pointer-events-none" strokeWidth={1.5} />
                  <span className="text-white text-[9px] font-medium uppercase tracking-wider pointer-events-none">{type.label}</span>
                </button>
              )
            })}

            {/* Close hint */}
            <div className="absolute -bottom-16 left-0 right-0 text-center animate-in fade-in duration-300 delay-300 pointer-events-none">
              <span className="text-white/60 text-sm font-light">Tap outside or select a sport</span>
            </div>
          </div>
        </div>
      )}

      {/* Map Layer Selector Modal */}
      {showLayerModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center animate-in fade-in duration-200"
          onClick={() => setShowLayerModal(false)}
        >
          <div
            className="w-full max-w-md mx-4 liquid-blur-card rounded-2xl p-6 animate-in zoom-in duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white text-xl font-light">Map Layers</h3>
              <button
                onClick={() => setShowLayerModal(false)}
                className="text-white/60 hover:text-white transition-colors"
              >
                <ChevronDown size={24} />
              </button>
            </div>

            {/* Layer Options Grid */}
            <div className="space-y-3">
              {mapLayers.map((layer) => {
                const Icon = layer.icon
                const isSelected = selectedLayer === layer.id

                return (
                  <button
                    key={layer.id}
                    onClick={() => {
                      setSelectedLayer(layer.id)
                      setShowLayerModal(false)
                    }}
                    className={cn(
                      'w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-200',
                      'backdrop-blur-sm border-2',
                      isSelected
                        ? 'bg-primary/20 border-primary/50 scale-[1.02]'
                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 active:scale-95'
                    )}
                  >
                    {/* Icon */}
                    <div className={cn(
                      'w-12 h-12 rounded-lg flex items-center justify-center',
                      isSelected ? 'bg-primary/30' : 'bg-white/10'
                    )}>
                      <Icon size={24} className="text-white" strokeWidth={1.5} />
                    </div>

                    {/* Label & Description */}
                    <div className="flex-1 text-left">
                      <div className="text-white font-light text-base">{layer.label}</div>
                      <div className="text-white/50 text-xs font-light">{layer.description}</div>
                    </div>

                    {/* Selected Indicator */}
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-white"></div>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Footer Note */}
            <div className="mt-6 text-center">
              <span className="text-white/40 text-xs font-light">
                Switch between map styles for better visibility
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
