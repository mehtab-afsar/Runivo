import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TerritoryMap } from '@/components/maps/TerritoryMap';
import { MetricCard } from '@/components/cards/MetricCard';
import { generateMockTerritories, CURRENT_LOCATION } from '@/data/mockData';
import type { Territory, Location } from '@/types';

interface AreaAnalysis {
  totalTerritories: number;
  neutralTerritories: number;
  averageDistance: number;
  difficulty: 'easy' | 'medium' | 'hard';
  recommendedTime: string;
  strategicValue: number;
}

interface ExplorationZone {
  id: string;
  name: string;
  center: Location;
  radius: number;
  emoji: string;
  description: string;
  territories: Territory[];
  analysis: AreaAnalysis;
}

export const TerritoryExplorer: React.FC = () => {
  const navigate = useNavigate();
  const [selectedZone, setSelectedZone] = useState<ExplorationZone | null>(null);
  const [viewMode, setViewMode] = useState<'overview' | 'detailed'>('overview');

  const allTerritories = useMemo(() => generateMockTerritories(80), []);

  const explorationZones: ExplorationZone[] = useMemo(() => {
    const zones = [
      {
        id: 'north-district',
        name: 'Northern District',
        center: { lat: CURRENT_LOCATION.lat + 0.02, lng: CURRENT_LOCATION.lng + 0.01 },
        radius: 0.015,
        emoji: '🏔️',
        description: 'Mountainous area with challenging terrain but rich unclaimed territories',
      },
      {
        id: 'east-riverside',
        name: 'Eastern Riverside',
        center: { lat: CURRENT_LOCATION.lat + 0.01, lng: CURRENT_LOCATION.lng + 0.025 },
        radius: 0.02,
        emoji: '🌊',
        description: 'Scenic river route with moderate competition',
      },
      {
        id: 'south-industrial',
        name: 'Southern Industrial',
        center: { lat: CURRENT_LOCATION.lat - 0.015, lng: CURRENT_LOCATION.lng + 0.005 },
        radius: 0.012,
        emoji: '🏭',
        description: 'Urban industrial zone with strategic positioning',
      },
      {
        id: 'west-parklands',
        name: 'Western Parklands',
        center: { lat: CURRENT_LOCATION.lat + 0.005, lng: CURRENT_LOCATION.lng - 0.02 },
        radius: 0.018,
        emoji: '🌳',
        description: 'Green spaces perfect for expansion with low competition',
      },
      {
        id: 'central-business',
        name: 'Central Business',
        center: { lat: CURRENT_LOCATION.lat - 0.005, lng: CURRENT_LOCATION.lng - 0.005 },
        radius: 0.01,
        emoji: '🏢',
        description: 'High-value commercial district with intense rivalry',
      },
    ];

    return zones.map(zone => {
      // Find territories in this zone
      const zoneTerritories = allTerritories.filter(territory => {
        const distance = Math.sqrt(
          Math.pow(territory.polygon[0]?.lat - zone.center.lat, 2) +
          Math.pow(territory.polygon[0]?.lng - zone.center.lng, 2)
        );
        return distance <= zone.radius;
      });

      const neutralCount = zoneTerritories.filter(t => t.status === 'neutral').length;
      const avgDistance = Math.sqrt(
        Math.pow(zone.center.lat - CURRENT_LOCATION.lat, 2) +
        Math.pow(zone.center.lng - CURRENT_LOCATION.lng, 2)
      ) * 111; // Convert to approximate km

      let difficulty: 'easy' | 'medium' | 'hard' = 'easy';
      if (zoneTerritories.filter(t => t.status === 'enemy').length > 5) difficulty = 'hard';
      else if (neutralCount < zoneTerritories.length * 0.6) difficulty = 'medium';

      const analysis: AreaAnalysis = {
        totalTerritories: zoneTerritories.length,
        neutralTerritories: neutralCount,
        averageDistance: avgDistance,
        difficulty,
        recommendedTime: avgDistance < 2 ? '30-45 min' : avgDistance < 4 ? '45-60 min' : '60+ min',
        strategicValue: Math.round((neutralCount * 2 + zoneTerritories.length) / avgDistance),
      };

      return {
        ...zone,
        territories: zoneTerritories,
        analysis,
      };
    });
  }, [allTerritories]);

  const getDifficultyColor = (difficulty: 'easy' | 'medium' | 'hard') => {
    switch (difficulty) {
      case 'easy': return 'text-stealth-success';
      case 'medium': return 'text-stealth-warning';
      case 'hard': return 'text-stealth-error';
    }
  };

  const handleExploreZone = (zone: ExplorationZone) => {
    navigate('/active-run', {
      state: {
        explorationTarget: zone,
        targetLocation: zone.center
      }
    });
  };

  const sortedZones = [...explorationZones].sort((a, b) => b.analysis.strategicValue - a.analysis.strategicValue);

  return (
    <div className="container mx-auto px-5 py-16 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-h1">Territory Explorer</h1>
        <p className="text-body text-stealth-gray">Discover new areas for territorial expansion</p>
      </div>

      {/* View Toggle */}
      <div className="flex bg-stealth-card rounded-full p-1">
        {[
          { key: 'overview', label: 'Zone Overview' },
          { key: 'detailed', label: 'Detailed Analysis' },
        ].map((mode) => (
          <button
            key={mode.key}
            onClick={() => setViewMode(mode.key as any)}
            className={`flex-1 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              viewMode === mode.key
                ? 'bg-stealth-lime text-stealth-black'
                : 'text-stealth-gray hover:text-stealth-white'
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {/* Map Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Exploration Map</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] rounded-2xl overflow-hidden">
            <TerritoryMap
              territories={selectedZone ? selectedZone.territories : allTerritories}
              center={selectedZone ? selectedZone.center : CURRENT_LOCATION}
              zoom={selectedZone ? 15 : 13}
              className="h-full"
            />
          </div>
        </CardContent>
      </Card>

      {/* Zone Overview */}
      {viewMode === 'overview' && (
        <div className="grid gap-4">
          <div className="flex justify-between items-center">
            <h2 className="text-h2">Exploration Zones</h2>
            <div className="text-caption text-stealth-gray">Sorted by strategic value</div>
          </div>

          {sortedZones.map((zone) => (
            <Card
              key={zone.id}
              className={`cursor-pointer transition-all hover:border-stealth-lime/50 ${
                selectedZone?.id === zone.id ? 'border-stealth-lime' : ''
              }`}
              onClick={() => setSelectedZone(zone)}
            >
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex gap-4">
                    <div className="text-2xl">{zone.emoji}</div>
                    <div>
                      <div className="text-body-lg font-medium">{zone.name}</div>
                      <div className="text-body text-stealth-gray mb-2">{zone.description}</div>

                      <div className="flex gap-4 text-xs">
                        <div className="flex gap-1">
                          <span className="text-stealth-white">●</span>
                          <span>{zone.analysis.totalTerritories} territories</span>
                        </div>
                        <div className="flex gap-1">
                          <span className="text-stealth-success">●</span>
                          <span>{zone.analysis.neutralTerritories} unclaimed</span>
                        </div>
                        <div className="flex gap-1">
                          <span className="text-stealth-gray">📍</span>
                          <span>{zone.analysis.averageDistance.toFixed(1)}km away</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={`text-xs font-medium ${getDifficultyColor(zone.analysis.difficulty)}`}>
                      {zone.analysis.difficulty.toUpperCase()}
                    </div>
                    <div className="text-xs text-stealth-gray">{zone.analysis.recommendedTime}</div>
                    <div className="text-sm text-stealth-lime font-bold">
                      Value: {zone.analysis.strategicValue}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detailed Analysis */}
      {viewMode === 'detailed' && selectedZone && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>{selectedZone.emoji}</span>
                {selectedZone.name} - Detailed Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="stats-grid">
                <MetricCard
                  value={selectedZone.analysis.totalTerritories}
                  unit=""
                  label="Total Territories"
                />
                <MetricCard
                  value={selectedZone.analysis.neutralTerritories}
                  unit=""
                  label="Unclaimed"
                  color="success"
                />
                <MetricCard
                  value={selectedZone.analysis.averageDistance.toFixed(1)}
                  unit="km"
                  label="Distance"
                />
                <MetricCard
                  value={selectedZone.analysis.strategicValue}
                  unit=""
                  label="Strategic Value"
                  color="accent"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-stealth-surface rounded-xl p-4">
                  <div className="text-body-lg font-medium mb-2">Difficulty Assessment</div>
                  <div className={`text-sm ${getDifficultyColor(selectedZone.analysis.difficulty)}`}>
                    {selectedZone.analysis.difficulty.toUpperCase()} DIFFICULTY
                  </div>
                  <div className="text-caption text-stealth-gray mt-1">
                    {selectedZone.analysis.difficulty === 'easy' && 'Perfect for beginners - low competition'}
                    {selectedZone.analysis.difficulty === 'medium' && 'Moderate challenge - some rival presence'}
                    {selectedZone.analysis.difficulty === 'hard' && 'High risk, high reward - heavy competition'}
                  </div>
                </div>

                <div className="bg-stealth-surface rounded-xl p-4">
                  <div className="text-body-lg font-medium mb-2">Recommended Route</div>
                  <div className="text-sm text-stealth-lime">{selectedZone.analysis.recommendedTime}</div>
                  <div className="text-caption text-stealth-gray mt-1">
                    Estimated time for complete exploration
                  </div>
                </div>
              </div>

              <div className="bg-stealth-surface rounded-xl p-4">
                <div className="text-body-lg font-medium mb-2">Strategic Insights</div>
                <div className="text-body text-stealth-gray">
                  This zone offers {selectedZone.analysis.neutralTerritories} unclaimed territories with
                  {selectedZone.analysis.strategicValue > 15 ? ' high' : selectedZone.analysis.strategicValue > 8 ? ' medium' : ' low'} strategic value.
                  {selectedZone.analysis.difficulty === 'easy' && ' Ideal for rapid expansion with minimal risk.'}
                  {selectedZone.analysis.difficulty === 'medium' && ' Balanced opportunity requiring tactical approach.'}
                  {selectedZone.analysis.difficulty === 'hard' && ' High-stakes zone requiring careful planning and strong performance.'}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Button
              className="flex-1"
              onClick={() => handleExploreZone(selectedZone)}
            >
              <span>🎯</span>
              Start Exploration Run
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate('/route-planner', { state: { targetZone: selectedZone } })}
            >
              Plan Strategic Route
            </Button>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {!selectedZone && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Exploration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <Button
                variant="secondary"
                className="justify-start"
                onClick={() => setSelectedZone(sortedZones[0])}
              >
                🎯 Explore Highest Value Zone
              </Button>
              <Button
                variant="secondary"
                className="justify-start"
                onClick={() => setSelectedZone(sortedZones.find(z => z.analysis.difficulty === 'easy') || sortedZones[0])}
              >
                🟢 Find Easiest Expansion
              </Button>
              <Button
                variant="secondary"
                className="justify-start"
                onClick={() => navigate('/dashboard')}
              >
                ← Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};