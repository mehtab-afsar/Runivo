import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { TerritoryMap } from '@/components/maps/TerritoryMap'
import { formatTime, formatPace, generateMockTerritories } from '@/data/mockData'
import { useGameState } from '@/hooks/useGameState'
import { Clock, Zap, MapPin, Flame, Award, ArrowLeft } from 'lucide-react'
import type { LiveRunData, Location } from '@/types'

export const RunSummary: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const { playerStats } = useGameState()

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
    <div className="min-h-screen bg-black pb-20">
      {/* Header with Back Button */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-black/50 border-b border-white/10">
        <div className="container mx-auto px-5 py-4 flex items-center gap-4">
          <button
            onClick={handleBackToDashboard}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="text-white" size={24} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">
              {getActionTitle()}
            </h1>
            <p className="text-sm text-gray-400">
              {getActionDescription()}
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-5 py-6 space-y-5">
        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Distance */}
          <div className="glass-card p-5 rounded-2xl">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="text-primary" size={18} />
              <span className="text-xs text-gray-400 uppercase tracking-wide">Distance</span>
            </div>
            <div className="text-3xl font-bold text-white">
              {runData.distance.toFixed(1)}
              <span className="text-lg text-gray-400 ml-1">km</span>
            </div>
          </div>

          {/* Duration */}
          <div className="glass-card p-5 rounded-2xl">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="text-primary" size={18} />
              <span className="text-xs text-gray-400 uppercase tracking-wide">Time</span>
            </div>
            <div className="text-3xl font-bold text-white">
              {formatTime(runData.duration)}
            </div>
          </div>

          {/* Pace */}
          <div className="glass-card p-5 rounded-2xl">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="text-primary" size={18} />
              <span className="text-xs text-gray-400 uppercase tracking-wide">Pace</span>
            </div>
            <div className="text-3xl font-bold text-white">
              {formatPace(runData.pace)}
              <span className="text-lg text-gray-400 ml-1">/km</span>
            </div>
          </div>

          {/* Calories */}
          <div className="glass-card p-5 rounded-2xl">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="text-primary" size={18} />
              <span className="text-xs text-gray-400 uppercase tracking-wide">Calories</span>
            </div>
            <div className="text-3xl font-bold text-white">
              {calories}
            </div>
          </div>
        </div>

        {/* Route Map */}
        <div className="glass-card p-4 rounded-2xl">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <MapPin size={16} className="text-primary" />
            Your Route
          </h3>
          <div className="h-[280px] rounded-xl overflow-hidden">
            <TerritoryMap
              territories={territories}
              runRoute={runData.route || []}
              center={runData.currentLocation}
              zoom={15}
              className="h-full"
            />
          </div>
        </div>

        {/* Rewards Section */}
        {runData.success && (
          <div className="glass-card p-5 rounded-2xl border border-primary/30">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Award size={16} className="text-primary" />
              Mission Rewards
            </h3>
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-2">
                  <span className="text-xl">⚡</span>
                </div>
                <div className="text-lg font-bold text-primary">+{rewards.xp}</div>
                <div className="text-xs text-gray-400">XP</div>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-2">
                  <span className="text-xl">🪙</span>
                </div>
                <div className="text-lg font-bold text-yellow-500">+{rewards.coins}</div>
                <div className="text-xs text-gray-400">Coins</div>
              </div>
              {rewards.gems > 0 && (
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-2">
                    <span className="text-xl">💎</span>
                  </div>
                  <div className="text-lg font-bold text-blue-400">+{rewards.gems}</div>
                  <div className="text-xs text-gray-400">Gems</div>
                </div>
              )}
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-2">
                  <span className="text-xl">🏪</span>
                </div>
                <div className="text-lg font-bold text-primary">+{rewards.brandPoints}</div>
                <div className="text-xs text-gray-400">Points</div>
              </div>
            </div>
          </div>
        )}

        {/* Territory Info */}
        <div className="glass-card p-5 rounded-2xl">
          <h3 className="text-sm font-semibold text-white mb-4">
            {runData.actionType === 'attack' ? 'Territory Conquered' :
             runData.actionType === 'claim' ? 'Territory Claimed' :
             runData.actionType === 'defend' ? 'Territory Defended' : 'Territory Activity'}
          </h3>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-white">
                {runData.success ? (runData.territoriesClaimed || 1) : 0}
              </div>
              <div className="text-xs text-gray-400">
                {runData.actionType === 'defend' ? 'Defended' : 'Territories'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-white">
                {runData.success ? Math.round(runData.territoriesClaimed * 2800 + Math.random() * 500) : 0}
              </div>
              <div className="text-xs text-gray-400">m² Area</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">
                {playerStats.territories.owned}
              </div>
              <div className="text-xs text-gray-400">Total Owned</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
