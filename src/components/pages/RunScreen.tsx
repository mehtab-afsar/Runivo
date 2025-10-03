import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, MapPin, ChevronDown, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ActivityType {
  id: string
  label: string
  icon: string
  color: string
}

export const RunScreen = () => {
  const navigate = useNavigate()
  const [hasGPSPermission, setHasGPSPermission] = useState<boolean | null>(null)
  const [isCheckingGPS, setIsCheckingGPS] = useState(true)
  const [activityType, setActivityType] = useState<string>('run')
  const [showActivityDropdown, setShowActivityDropdown] = useState(false)
  const [gpsStatus, setGpsStatus] = useState<'searching' | 'found' | 'error'>('searching')
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)

  const activityTypes: ActivityType[] = [
    { id: 'run', label: 'Run', icon: '🏃‍♂️', color: 'bg-blue-500' },
    { id: 'walk', label: 'Walk', icon: '🚶‍♂️', color: 'bg-green-500' },
    { id: 'cycle', label: 'Cycle', icon: '🚴‍♂️', color: 'bg-purple-500' },
    { id: 'hike', label: 'Hike', icon: '🥾', color: 'bg-orange-500' }
  ]

  useEffect(() => {
    checkGPSPermission()
  }, [])

  const checkGPSPermission = async () => {
    setIsCheckingGPS(true)
    try {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setCurrentLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            })
            setHasGPSPermission(true)
            setGpsStatus('found')
          },
          (error) => {
            console.error('GPS Error:', error)
            setHasGPSPermission(false)
            setGpsStatus('error')
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        )
      } else {
        setHasGPSPermission(false)
        setGpsStatus('error')
      }
    } catch (error) {
      setHasGPSPermission(false)
      setGpsStatus('error')
    } finally {
      setIsCheckingGPS(false)
    }
  }

  const requestGPSPermission = async () => {
    setGpsStatus('searching')
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000
        })
      })
      setCurrentLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude
      })
      setHasGPSPermission(true)
      setGpsStatus('found')
    } catch (error) {
      setHasGPSPermission(false)
      setGpsStatus('error')
      alert('Please enable location permissions in your browser settings to track your runs.')
    }
  }

  const handleStartActivity = () => {
    if (hasGPSPermission && currentLocation) {
      navigate('/active-run', { state: { activityType, startLocation: currentLocation } })
    } else {
      requestGPSPermission()
    }
  }

  const getCurrentActivity = () => {
    return activityTypes.find(type => type.id === activityType) || activityTypes[0]
  }

  const getGPSStatusColor = () => {
    switch (gpsStatus) {
      case 'found': return 'text-green-400'
      case 'searching': return 'text-yellow-400'
      case 'error': return 'text-red-400'
      default: return 'text-white/40'
    }
  }

  return (
    <div className="min-h-screen bg-black pb-24">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 liquid-blur-header">
        <div className="px-6 py-4">
          <h1 className="text-lg font-light text-white">Record Activity</h1>
        </div>
      </div>

      {/* Content */}
      <div className="pt-20 px-6 space-y-4">
        {/* GPS Status */}
        {isCheckingGPS ? (
          <div className="liquid-blur-card rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              <span className="text-sm font-light text-white/70">
                Checking GPS status...
              </span>
            </div>
          </div>
        ) : (
          <div className={cn(
            'liquid-blur-card rounded-xl p-4',
            hasGPSPermission ? 'border border-green-500/20' : 'border border-orange-500/20'
          )}>
            <div className="flex items-start gap-3">
              <MapPin
                size={20}
                className={hasGPSPermission ? 'text-green-500' : 'text-orange-500'}
              />
              <div className="flex-1">
                <div className="text-sm font-light text-white mb-1">
                  {hasGPSPermission ? 'GPS Ready' : 'GPS Permission Required'}
                </div>
                <p className="text-xs font-light text-white/60">
                  {hasGPSPermission
                    ? 'Location tracking is enabled and ready'
                    : 'We need location access to track your activity'}
                </p>
              </div>
              {!hasGPSPermission && (
                <button
                  onClick={requestGPSPermission}
                  className="text-xs font-light text-primary hover:underline"
                >
                  Enable
                </button>
              )}
            </div>
          </div>
        )}

        {/* Activity Type Selector */}
        <div className="space-y-2">
          <label className="text-sm font-light text-white/70 px-2">Activity Type</label>
          <div className="relative">
            <button
              onClick={() => setShowActivityDropdown(!showActivityDropdown)}
              className="w-full liquid-blur-card rounded-xl p-4 flex items-center justify-between hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center text-white',
                  getCurrentActivity().color
                )}>
                  <span className="text-lg">{getCurrentActivity().icon}</span>
                </div>
                <span className="font-light text-white">{getCurrentActivity().label}</span>
              </div>
              <ChevronDown className={cn(
                'w-5 h-5 text-white/40 transition-transform',
                showActivityDropdown && 'rotate-180'
              )} />
            </button>

            {/* Dropdown */}
            {showActivityDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 liquid-blur-card rounded-xl border border-white/10 overflow-hidden z-20">
                {activityTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => {
                      setActivityType(type.id)
                      setShowActivityDropdown(false)
                    }}
                    className="w-full p-4 flex items-center gap-3 hover:bg-white/10 transition-colors"
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center text-white',
                      type.color
                    )}>
                      <span>{type.icon}</span>
                    </div>
                    <span className="font-light text-white">{type.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stats Preview */}
        <div className="liquid-blur-card rounded-xl p-6">
          <h3 className="text-sm font-light text-white/70 mb-4">Today's Progress</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-light text-white">0.0</div>
              <div className="text-xs text-white/60 mt-1">km</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-light text-white">0</div>
              <div className="text-xs text-white/60 mt-1">activities</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-light text-white">0</div>
              <div className="text-xs text-white/60 mt-1">min</div>
            </div>
          </div>
        </div>

        {/* Start Button */}
        <button
          onClick={handleStartActivity}
          disabled={!hasGPSPermission}
          className={cn(
            'w-full py-4 bg-primary text-white rounded-xl font-light hover:bg-primary/90 transition-colors',
            'flex items-center justify-center gap-3',
            'disabled:bg-white/10 disabled:text-white/40 disabled:cursor-not-allowed'
          )}
        >
          <Play size={20} fill="currentColor" />
          <span>Start {getCurrentActivity().label}</span>
        </button>

        {/* GPS Status Indicator */}
        <div className="flex items-center justify-center gap-2 text-sm">
          <div className={cn(
            'w-2 h-2 rounded-full',
            gpsStatus === 'found' ? 'bg-green-400' :
            gpsStatus === 'searching' ? 'bg-yellow-400 animate-pulse' :
            'bg-red-400'
          )} />
          <span className={cn('font-light', getGPSStatusColor())}>
            {gpsStatus === 'found' ? 'GPS Ready' :
             gpsStatus === 'searching' ? 'Finding GPS...' :
             'GPS Error'}
          </span>
        </div>

        {!hasGPSPermission && (
          <div className="flex items-start gap-2 text-xs font-light text-white/60 px-2">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <p>
              GPS permission is required to track your activity. Click "Enable" above or check your browser settings.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
