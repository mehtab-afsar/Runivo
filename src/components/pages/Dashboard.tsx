import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MetricCard } from '@/components/cards/MetricCard'
import {
  mockWeather,
  mockTerritoryStats,
  mockLastRunStats,
  formatTime,
  formatPace
} from '@/data/mockData'
import { UserIcon, ActivityIcon, MapIcon, RunningIcon, CompetitionIcon, RocketIcon } from '@/components/ui/icons'

export const Dashboard: React.FC = () => {
  const navigate = useNavigate()
  const [selectedRoute, setSelectedRoute] = useState(0)

  const handleStartRun = () => {
    navigate('/active-run')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stealth-black via-stealth-surface to-stealth-black">
      <div className="container mx-auto px-4 py-8 space-y-8 animate-slide-up">
      {/* Premium Header */}
      <div className="flex justify-between items-start pt-8 pb-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <h1 className="text-h1 bg-gradient-to-r from-stealth-white to-stealth-lime bg-clip-text text-transparent">
              Good Morning
            </h1>
            <div className="w-2 h-2 bg-stealth-lime rounded-full animate-glow-pulse"></div>
          </div>
          <p className="text-body-lg text-stealth-gray font-medium">Ready to dominate new territory?</p>
          <div className="flex items-center gap-4 text-caption text-stealth-gray">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-stealth-success rounded-full"></div>
              <span>GPS Ready</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-stealth-warning rounded-full"></div>
              <span>Battery 85%</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/profile')}
            className="w-12 h-12 bg-gradient-to-br from-stealth-card to-stealth-surface rounded-2xl flex items-center justify-center text-stealth-gray hover:text-stealth-lime transition-all duration-300 hover:scale-105 backdrop-blur-sm border border-stealth-border/30"
          >
            <UserIcon size={20} color="var(--stealth-gray)" />
          </button>
          <NotificationBadge onClick={() => navigate('/notifications')} />
        </div>
      </div>

      {/* Premium Weather Card */}
      <div className="weather-widget group hover:scale-[1.02] transition-all duration-300">
        <div className="weather-icon group-hover:rotate-12 transition-transform duration-300">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="5" fill="#FFD700" stroke="#FFB800" strokeWidth="2" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <div className="flex-1">
          <div className="text-h2 font-bold">{mockWeather.temperature}°C</div>
          <div className="text-body text-stealth-gray font-medium">
            Wind {mockWeather.windSpeed}km/h • Humidity {mockWeather.humidity}%
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="status-indicator">
            <div className="status-dot status-dot-success"></div>
            <span className="font-semibold">Perfect conditions</span>
          </div>
          <div className="text-xs text-stealth-gray bg-stealth-surface/50 px-3 py-1 rounded-full">
            Ideal for territory conquest
          </div>
        </div>
      </div>

      {/* Premium Strategic Routes */}
      <div className="card-stealth">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-h2 font-bold">Strategic Routes</h2>
          <div className="text-caption text-stealth-gray bg-stealth-surface/50 px-3 py-1 rounded-full">
            Tap to preview
          </div>
        </div>
        <div className="space-y-4">
          {mockRoutes.map((route, index) => (
            <div
              key={route.id}
              className={`route-option group ${selectedRoute === index ? 'selected' : ''}`}
              onClick={() => setSelectedRoute(index)}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="text-3xl group-hover:scale-110 transition-transform duration-300">
                    {route.emoji}
                  </div>
                  <div>
                    <div className="text-body-lg font-semibold">{route.name}</div>
                    <div className="text-caption text-stealth-gray font-medium">
                      {route.distance} • <span className="text-stealth-lime">{route.territories} territories</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <div className="text-sm font-bold text-stealth-lime">High Value</div>
                  <div className="text-xs text-stealth-gray">Est. 25 min</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Premium Territory Stats */}
      <div className="card-stealth">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-h2 font-bold">Territory Control</h2>
          <div className="text-caption text-stealth-lime font-bold">
            #{3} in rankings
          </div>
        </div>
        <div className="stats-grid">
          <div className="metric-card group hover:scale-105 transition-all duration-300">
            <div className="text-metric text-stealth-lime">{mockTerritoryStats.owned}</div>
            <div className="text-unit text-stealth-gray font-semibold">My Zones</div>
            <div className="w-full h-1 bg-stealth-border rounded-full mt-3">
              <div className="w-3/4 h-full bg-gradient-to-r from-stealth-lime to-stealth-lime-hover rounded-full"></div>
            </div>
          </div>
          <div className="metric-card group hover:scale-105 transition-all duration-300">
            <div className="text-metric text-stealth-error">{mockTerritoryStats.rival}</div>
            <div className="text-unit text-stealth-gray font-semibold">Enemy Zones</div>
            <div className="w-full h-1 bg-stealth-border rounded-full mt-3">
              <div className="w-1/2 h-full bg-gradient-to-r from-stealth-error to-red-500 rounded-full"></div>
            </div>
          </div>
          <div className="metric-card group hover:scale-105 transition-all duration-300">
            <div className="text-metric text-stealth-white">{mockTerritoryStats.unclaimed}</div>
            <div className="text-unit text-stealth-gray font-semibold">Available</div>
            <div className="w-full h-1 bg-stealth-border rounded-full mt-3">
              <div className="w-full h-full bg-gradient-to-r from-stealth-gray to-stealth-white rounded-full"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Premium Performance Stats */}
      <div className="card-stealth">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-h2 font-bold">Last Performance</h2>
          <div className="text-caption text-stealth-success font-bold flex items-center gap-1">
            <ActivityIcon size={16} color="var(--stealth-success)" /> Personal best!
          </div>
        </div>
        <div className="stats-grid">
          <div className="metric-card group hover:scale-105 transition-all duration-300">
            <div className="text-metric text-stealth-white">{mockLastRunStats.distance}</div>
            <div className="text-unit text-stealth-gray font-semibold">km distance</div>
          </div>
          <div className="metric-card group hover:scale-105 transition-all duration-300">
            <div className="text-metric text-stealth-white">{formatTime(mockLastRunStats.duration)}</div>
            <div className="text-unit text-stealth-gray font-semibold">duration</div>
          </div>
          <div className="metric-card group hover:scale-105 transition-all duration-300">
            <div className="text-metric text-stealth-warning">{formatPace(mockLastRunStats.pace)}</div>
            <div className="text-unit text-stealth-gray font-semibold">avg pace</div>
          </div>
          <div className="metric-card group hover:scale-105 transition-all duration-300">
            <div className="text-metric text-stealth-lime">{mockLastRunStats.territoriesClaimed}</div>
            <div className="text-unit text-stealth-gray font-semibold">zones claimed</div>
          </div>
        </div>

        <div className="mt-8 p-4 bg-gradient-to-r from-stealth-surface/50 to-stealth-card/30 rounded-2xl border border-stealth-border/20">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-body-lg font-semibold">Total Territory Empire</div>
              <div className="text-caption text-stealth-gray font-medium">
                {(mockTerritoryStats.totalAreaOwned / 1000).toFixed(1)}k sq meters under your control
              </div>
            </div>
            <div className="text-right">
              <div className="text-h2 text-stealth-lime font-bold">
                {mockTerritoryStats.owned}
              </div>
              <div className="text-xs text-stealth-gray font-medium">territories</div>
            </div>
          </div>
        </div>
      </div>

      {/* Premium Action Center */}
      <div className="space-y-6">
        <Button
          onClick={handleStartRun}
          className="w-full btn-primary-stealth text-lg font-bold py-6 group relative overflow-hidden"
        >
          <div className="flex items-center justify-center gap-3 relative z-10">
            <RunningIcon size={24} className="group-hover:scale-110 transition-transform duration-300" color="var(--stealth-black)" />
            <span>Start Territory Run</span>
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-stealth-lime-hover to-stealth-lime opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        </Button>

        <div className="grid grid-cols-2 gap-4">
          <Button
            variant="secondary"
            onClick={() => navigate('/route-planner')}
            className="btn-secondary-stealth py-4 group"
          >
            <div className="flex flex-col items-center gap-2">
              <MapIcon size={20} className="group-hover:scale-110 transition-transform duration-300" color="var(--stealth-gray)" />
              <span className="font-semibold">Strategy</span>
            </div>
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate('/territory-explorer')}
            className="btn-secondary-stealth py-4 group"
          >
            <div className="flex flex-col items-center gap-2">
              <RocketIcon size={20} className="group-hover:scale-110 transition-transform duration-300" color="var(--stealth-gray)" />
              <span className="font-semibold">Explore</span>
            </div>
          </Button>
        </div>

        <Button
          variant="secondary"
          onClick={() => navigate('/community')}
          className="w-full btn-secondary-stealth py-5 group"
        >
          <div className="flex items-center justify-center gap-3">
            <CompetitionIcon size={20} className="group-hover:scale-110 transition-transform duration-300" color="var(--stealth-gray)" />
            <span className="font-semibold">Community Challenges</span>
          </div>
        </Button>
      </div>

      {/* Bottom Spacer */}
      <div className="h-24"></div>
    </div>
    </div>
  )
}
