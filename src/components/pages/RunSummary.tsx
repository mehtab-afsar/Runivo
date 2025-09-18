import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MetricCard } from '@/components/cards/MetricCard'
import { TerritoryMap } from '@/components/maps/TerritoryMap'
import { GameHUD } from '@/components/game/GameHUD'
import { formatTime, formatPace, generateMockTerritories } from '@/data/mockData'
import { useGameState } from '@/hooks/useGameState'
import type { LiveRunData, Location } from '@/types'

export const RunSummary: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const { playerStats } = useGameState()
  const [showRewards, setShowRewards] = useState(true)
  const [rewardsAnimating, setRewardsAnimating] = useState(false)

  // Get run data from navigation state or use defaults
  const runData: LiveRunData & { route?: Location[]; finalStats?: any; actionType?: string; success?: boolean } = location.state?.runData || {
    distance: 2.1,
    duration: 754, // 12:34 in seconds
    pace: 5.97, // 5:58 per km
    territoriesClaimed: 3,
    currentLocation: { lat: 28.6139, lng: 77.2090 },
    isActive: false,
    isPaused: false,
    route: [],
    actionType: 'claim',
    success: true,
    finalStats: {
      distance: 2.1,
      duration: 754,
      pace: 5.97,
      territories: 3
    }
  }

  const territories = generateMockTerritories(50)
  const calories = Math.round(runData.distance * 88) // Rough calculation: ~88 calories per km

  const handleBackToDashboard = () => {
    navigate('/home')
  }

  const calculateRewards = () => {
    if (!runData.success) return { xp: 0, coins: 0, gems: 0, brandPoints: 0 }

    const baseRewards = {
      xp: runData.actionType === 'attack' ? 75 : runData.actionType === 'claim' ? 50 : 25,
      coins: runData.actionType === 'attack' ? 40 : runData.actionType === 'claim' ? 25 : 15,
      gems: runData.actionType === 'attack' ? 5 : 0,
      brandPoints: Math.floor(runData.distance * 10)
    }

    // Distance bonus
    const distanceBonus = Math.floor(runData.distance * 5)
    baseRewards.xp += distanceBonus
    baseRewards.coins += distanceBonus

    return baseRewards
  }

  const rewards = calculateRewards()

  useEffect(() => {
    if (showRewards) {
      setRewardsAnimating(true)
      const timer = setTimeout(() => {
        setRewardsAnimating(false)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [showRewards])

  const getActionTitle = () => {
    if (!runData.success) return `${runData.actionType || 'Action'} Failed`
    switch (runData.actionType) {
      case 'claim': return 'Territory Claimed! 🎯'
      case 'attack': return 'Territory Conquered! ⚔️'
      case 'defend': return 'Territory Defended! 🛡️'
      case 'fortify': return 'Territory Fortified! 🏰'
      default: return 'Run Complete! 🎉'
    }
  }

  const getActionDescription = () => {
    if (!runData.success) return 'Mission objective not completed. Try again!'
    switch (runData.actionType) {
      case 'claim': return 'Successfully claimed new territory'
      case 'attack': return 'Enemy territory has fallen to your forces'
      case 'defend': return 'Territory successfully defended from attack'
      case 'fortify': return 'Territory defenses have been strengthened'
      default: return 'Great job on your run'
    }
  }

  return (
    <div className="container mx-auto px-5 py-16 space-y-6">
      {/* Game HUD */}
      <div className="mb-6">
        <GameHUD />
      </div>

      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-h1" style={{ color: runData.success ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
          {getActionTitle()}
        </h1>
        <p className="text-body" style={{ color: 'var(--text-secondary)' }}>
          {getActionDescription()}
        </p>
      </div>

      {/* Rewards Section */}
      {runData.success && showRewards && (
        <div
          className="glass-card p-6 rounded-3xl mb-6"
          style={{
            background: 'rgba(255, 71, 71, 0.1)',
            borderColor: 'var(--accent-primary)',
            animation: rewardsAnimating ? 'pulseGlow 1s ease-in-out 3' : 'none'
          }}
        >
          <div className="text-center mb-4">
            <h2 className="text-h2 font-bold" style={{ color: 'var(--accent-primary)' }}>
              Mission Rewards
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-3xl mb-2">⚡</div>
              <div className="font-bold text-lg" style={{ color: 'var(--accent-primary)' }}>
                +{rewards.xp}
              </div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                XP
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">🪙</div>
              <div className="font-bold text-lg" style={{ color: '#FFB800' }}>
                +{rewards.coins}
              </div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Coins
              </div>
            </div>
            {rewards.gems > 0 && (
              <div className="text-center">
                <div className="text-3xl mb-2">💎</div>
                <div className="font-bold text-lg" style={{ color: '#4FC3F7' }}>
                  +{rewards.gems}
                </div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Gems
                </div>
              </div>
            )}
            <div className="text-center">
              <div className="text-3xl mb-2">🏪</div>
              <div className="font-bold text-lg" style={{ color: 'var(--accent-primary)' }}>
                +{rewards.brandPoints}
              </div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Brand Points
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowRewards(false)}
            className="w-full mt-4 py-2 rounded-2xl font-semibold"
            style={{
              background: 'var(--accent-primary)',
              color: '#000000'
            }}
          >
            Collect Rewards
          </button>
        </div>
      )}

      {/* Route Map */}
      <Card>
        <CardHeader>
          <CardTitle>Your Route</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] rounded-2xl overflow-hidden">
            <TerritoryMap
              territories={territories}
              runRoute={runData.route || []}
              center={runData.currentLocation}
              zoom={15}
              className="h-full"
            />
          </div>
        </CardContent>
      </Card>

      {/* Performance Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="stats-grid">
            <MetricCard
              value={runData.distance.toFixed(1)}
              unit="km"
              label="distance"
            />
            <MetricCard
              value={formatTime(runData.duration)}
              unit=""
              label="duration"
            />
            <MetricCard
              value={formatPace(runData.pace)}
              unit="/km"
              label="pace"
            />
            <MetricCard
              value={calories}
              unit=""
              label="calories"
            />
          </div>
        </CardContent>
      </Card>

      {/* Territory Metrics */}
      <div
        className="glass-card p-6 rounded-3xl"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border-light)'
        }}
      >
        <h3 className="text-h3 font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
          {runData.actionType === 'attack' ? 'Territory Conquered' :
           runData.actionType === 'claim' ? 'Territory Claimed' :
           runData.actionType === 'defend' ? 'Territory Defended' : 'Territory Activity'}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl mb-2" style={{ color: 'var(--accent-primary)' }}>
              {runData.success ? (runData.territoriesClaimed || 1) : 0}
            </div>
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {runData.actionType === 'defend' ? 'defended' : 'territories'}
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl mb-2" style={{ color: 'var(--accent-primary)' }}>
              {runData.success ? Math.round(runData.territoriesClaimed * 2800 + Math.random() * 500) : 0}
            </div>
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              m² area
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-between items-center">
          <div>
            <div className="text-body" style={{ color: 'var(--text-primary)' }}>
              Total Territory Owned
            </div>
            <div className="text-caption" style={{ color: 'var(--text-secondary)' }}>
              Updated after this run
            </div>
          </div>
          <div className="text-h2" style={{ color: 'var(--accent-primary)' }}>
            {playerStats.territories.owned}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-4">
        <Button className="w-full">
          <span>📱</span>
          Share Achievement
        </Button>
        
        <Button
          variant="secondary"
          className="w-full btn-secondary"
          onClick={handleBackToDashboard}
        >
          ← Back to Map
        </Button>
      </div>
    </div>
  )
}
