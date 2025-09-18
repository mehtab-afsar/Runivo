import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { TerritoryMap } from '@/components/maps/TerritoryMap'
import { useRunTracker } from '@/hooks/useRunTracker'
import { useGameState } from '@/hooks/useGameState'
import { generateMockTerritories, formatTime, formatPace } from '@/data/mockData'
import { MapPinIcon, TargetIcon, ShieldIcon, CastleIcon, SwordIcon } from '@/components/ui/icons'
import type { Territory } from '@/types'

export const ActiveRun: React.FC = () => {
  const navigate = useNavigate()
  const [territories] = useState<Territory[]>(() => generateMockTerritories(50))
  const [showPermissionDialog, setShowPermissionDialog] = useState(false)
  const [currentAction, setCurrentAction] = useState<any>(null)

  const { activeActions, completeAction, playerStats } = useGameState()

  const {
    runData,
    isRunning,
    isPaused,
    route,
    territoriesClaimed,
    startRun,
    pauseRun,
    resumeRun,
    stopRun,
    claimTerritory,
    currentLocation,
  } = useRunTracker()

  useEffect(() => {
    // Get current active action from game state
    const action = activeActions.find(a => a.status === 'pending' || a.status === 'in-progress')
    if (action) {
      setCurrentAction(action)
      if (!isRunning && !showPermissionDialog) {
        handleStartRun()
      }
    } else {
      // No active action, redirect to map
      navigate('/home')
    }
  }, [activeActions])

  useEffect(() => {
    if (isRunning && currentLocation) {
      claimTerritory(territories)
    }
  }, [currentLocation, isRunning, claimTerritory, territories])

  const handleStartRun = async () => {
    try {
      await startRun()
      setShowPermissionDialog(false)
    } catch (error) {
      setShowPermissionDialog(true)
      console.error('Failed to start run:', error)
    }
  }

  const handlePauseRun = () => {
    if (isPaused) {
      resumeRun()
    } else {
      pauseRun()
    }
  }

  const handleStopRun = async () => {
    const success = (runData?.distance || 0) >= (currentAction?.requirements.distance || 1.0)

    if (currentAction) {
      completeAction(currentAction.id, success)
    }

    stopRun()

    // Navigate to summary with run data
    navigate('/run-summary/1', {
      state: {
        runData: {
          ...runData,
          route,
          territoriesClaimed: territoriesClaimed.length,
          actionType: currentAction?.type,
          success,
          finalStats: {
            distance: runData?.distance || 0,
            duration: runData?.duration || 0,
            pace: runData?.pace || 0,
            territories: territoriesClaimed.length
          }
        }
      }
    })
  }

  if (showPermissionDialog) {
    return (
      <div className="min-h-screen bg-stealth-black flex items-center justify-center p-5">
        <div className="bg-stealth-card rounded-2xl p-6 text-center max-w-sm">
          <div className="mb-4">
            <MapPinIcon size={48} color="var(--accent-primary)" />
          </div>
          <div className="text-h3 mb-2">Location Access Required</div>
          <div className="text-body text-stealth-gray mb-6">
            Runivo needs access to your location to track your run and claim territories.
          </div>
          <Button onClick={handleStartRun} className="w-full">
            Enable Location Access
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate('/dashboard')}
            className="w-full mt-2"
          >
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stealth-black via-stealth-surface to-stealth-black relative">
      {/* Full screen territory map */}
      <div className="absolute inset-0">
        <TerritoryMap
          territories={territories}
          currentLocation={currentLocation || undefined}
          runRoute={route}
          center={currentLocation || { lat: 28.6139, lng: 77.2090 }}
          zoom={16}
          className="h-full"
        />
      </div>

      {/* Premium Live Stats Overlay */}
      <div className="live-stats-overlay animate-slide-up">
        <div className="grid grid-cols-3 gap-6">
          <div className="text-center group">
            <div className="text-metric font-extrabold text-stealth-white group-hover:text-stealth-lime transition-colors duration-300">
              {runData?.distance.toFixed(1) || '0.0'}
            </div>
            <div className="text-unit text-stealth-gray font-semibold uppercase tracking-wide">kilometers</div>
            {currentAction && (
              <div className="text-xs mt-1" style={{ color: 'var(--accent-primary)' }}>
                Target: {currentAction.requirements.distance.toFixed(1)}km
              </div>
            )}
          </div>
          <div className="text-center group">
            <div className="text-metric font-extrabold text-stealth-white group-hover:text-stealth-lime transition-colors duration-300">
              {runData ? formatTime(runData.duration) : '00:00'}
            </div>
            <div className="text-unit text-stealth-gray font-semibold uppercase tracking-wide">elapsed</div>
          </div>
          <div className="text-center group">
            <div className="text-metric font-extrabold text-stealth-warning group-hover:text-stealth-lime transition-colors duration-300">
              {runData?.pace ? formatPace(runData.pace) : '0:00'}
            </div>
            <div className="text-unit text-stealth-gray font-semibold uppercase tracking-wide">pace /km</div>
          </div>
        </div>
      </div>

      {/* Premium Territory Counter */}
      <div className="territory-counter animate-float">
        <div className="flex items-center gap-2">
          <div>
            {currentAction?.type === 'claim' && <TargetIcon size={20} color="var(--accent-primary)" />}
            {currentAction?.type === 'attack' && <SwordIcon size={20} color="var(--accent-primary)" />}
            {currentAction?.type === 'defend' && <ShieldIcon size={20} color="var(--accent-primary)" />}
            {(!currentAction?.type || currentAction?.type === 'other') && <CastleIcon size={20} color="var(--accent-primary)" />}
          </div>
          <div>
            <div className="font-bold text-lg">{territoriesClaimed.length}</div>
            <div className="text-xs opacity-90">
              {currentAction?.type === 'claim' ? 'claiming' :
               currentAction?.type === 'attack' ? 'attacking' :
               currentAction?.type === 'defend' ? 'defending' : 'fortifying'}
            </div>
          </div>
        </div>
      </div>

      {/* Premium Status Indicators */}
      <div className="fixed top-6 left-4 z-[1001] animate-slide-in">
        <div className="status-indicator">
          <div className={`status-dot ${currentLocation ? 'status-dot-success' : 'status-dot-error'}`}></div>
          <span className="font-semibold">{currentLocation ? 'GPS Locked' : 'Searching GPS'}</span>
        </div>
      </div>

      <div className="fixed top-6 right-4 z-[1001] animate-slide-in">
        <div className="status-indicator">
          <div className={`status-dot ${isRunning ? (isPaused ? 'status-dot-warning' : 'status-dot-success') : 'status-dot-error'}`}></div>
          <span className="font-semibold">
            {isRunning ? (isPaused ? 'PAUSED' : 'ACTIVE') : 'STANDBY'}
          </span>
        </div>
      </div>

      {/* Premium Run Controls */}
      <div className="fixed bottom-28 left-4 right-4 flex gap-4 z-[1000] animate-slide-up">
        <Button
          variant="secondary"
          className="flex-1 btn-secondary-stealth py-4 group"
          onClick={handlePauseRun}
          disabled={!isRunning}
        >
          <div className="flex items-center justify-center gap-2">
            <span className="text-xl group-hover:scale-110 transition-transform duration-300">
              {isPaused ? '▶️' : '⏸️'}
            </span>
            <span className="font-bold">{isPaused ? 'Resume' : 'Pause'}</span>
          </div>
        </Button>
        <Button
          variant="destructive"
          className="flex-1 btn-danger-stealth py-4 group"
          onClick={handleStopRun}
          disabled={!isRunning && !isPaused}
        >
          <div className="flex items-center justify-center gap-2">
            <span className="text-xl group-hover:scale-110 transition-transform duration-300">⏹️</span>
            <span className="font-bold">Complete {currentAction?.type || 'Run'}</span>
          </div>
        </Button>
      </div>
    </div>
  )
}
