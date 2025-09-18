import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TerritoryMap } from '@/components/maps/TerritoryMap';
import { generateMockTerritories, mockRoutes } from '@/data/mockData';
import type { Route } from '@/types';

interface TerritoryAnalysis {
  totalTerritories: number;
  ownedTerritories: number;
  enemyTerritories: number;
  neutralTerritories: number;
  strategicValue: 'high' | 'medium' | 'low';
  recommendedAction: 'attack' | 'defend' | 'expand';
}

export const RoutePlanner: React.FC = () => {
  const navigate = useNavigate();
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [viewMode, setViewMode] = useState<'routes' | 'territories' | 'strategic'>('routes');

  const territories = useMemo(() => generateMockTerritories(50), []);

  const analyzeRoute = (route: Route): TerritoryAnalysis => {
    // Simulate territory analysis along the route
    const routeTerritories = territories.filter(territory => {
      return route.points.some(point => {
        const distance = Math.sqrt(
          Math.pow(point.lat - territory.polygon[0]?.lat || 0, 2) +
          Math.pow(point.lng - territory.polygon[0]?.lng || 0, 2)
        );
        return distance < 0.01; // Within proximity
      });
    });

    const owned = routeTerritories.filter(t => t.status === 'owned').length;
    const enemy = routeTerritories.filter(t => t.status === 'enemy').length;
    const neutral = routeTerritories.filter(t => t.status === 'neutral').length;

    let strategicValue: 'high' | 'medium' | 'low' = 'low';
    let recommendedAction: 'attack' | 'defend' | 'expand' = 'expand';

    if (enemy > owned) {
      strategicValue = 'high';
      recommendedAction = 'attack';
    } else if (neutral > owned + enemy) {
      strategicValue = 'medium';
      recommendedAction = 'expand';
    } else {
      strategicValue = owned > 5 ? 'medium' : 'low';
      recommendedAction = 'defend';
    }

    return {
      totalTerritories: routeTerritories.length,
      ownedTerritories: owned,
      enemyTerritories: enemy,
      neutralTerritories: neutral,
      strategicValue,
      recommendedAction,
    };
  };

  const handleStartRun = () => {
    navigate('/active-run');
  };

  const getStrategicColor = (value: 'high' | 'medium' | 'low') => {
    switch (value) {
      case 'high': return 'text-stealth-error';
      case 'medium': return 'text-stealth-warning';
      case 'low': return 'text-stealth-success';
    }
  };

  const getActionColor = (action: 'attack' | 'defend' | 'expand') => {
    switch (action) {
      case 'attack': return 'text-stealth-error';
      case 'defend': return 'text-stealth-warning';
      case 'expand': return 'text-stealth-success';
    }
  };

  return (
    <div className="container mx-auto px-5 py-16 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-h1">Strategic Planning</h1>
        <p className="text-body text-stealth-gray">Plan your next territorial conquest</p>
      </div>

      {/* View Mode Toggle */}
      <div className="flex bg-stealth-card rounded-full p-1">
        {[
          { key: 'routes', label: 'Routes' },
          { key: 'territories', label: 'Territories' },
          { key: 'strategic', label: 'Strategic' },
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

      {/* Territory Map */}
      <Card>
        <CardHeader>
          <CardTitle>Territory Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] rounded-2xl overflow-hidden">
            <TerritoryMap
              territories={territories}
              runRoute={selectedRoute?.points}
              zoom={14}
              className="h-full"
            />
          </div>
        </CardContent>
      </Card>

      {/* Route Selection */}
      {viewMode === 'routes' && (
        <Card>
          <CardHeader>
            <CardTitle>Available Routes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mockRoutes.map((route) => {
              const analysis = analyzeRoute(route);
              const isSelected = selectedRoute?.id === route.id;

              return (
                <div
                  key={route.id}
                  className={`route-option ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedRoute(route)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{route.emoji}</span>
                        <div>
                          <div className="text-body-lg">{route.name}</div>
                          <div className="text-caption text-stealth-gray">
                            {route.distance} • {analysis.totalTerritories} territories
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-4 text-xs">
                        <div className="flex gap-1">
                          <span className="text-stealth-lime">●</span>
                          <span>{analysis.ownedTerritories} owned</span>
                        </div>
                        <div className="flex gap-1">
                          <span className="text-stealth-error">●</span>
                          <span>{analysis.enemyTerritories} enemy</span>
                        </div>
                        <div className="flex gap-1">
                          <span className="text-stealth-gray">●</span>
                          <span>{analysis.neutralTerritories} neutral</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={`text-xs font-medium ${getStrategicColor(analysis.strategicValue)}`}>
                        {analysis.strategicValue.toUpperCase()} PRIORITY
                      </div>
                      <div className={`text-xs ${getActionColor(analysis.recommendedAction)}`}>
                        {analysis.recommendedAction.toUpperCase()}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Territory Analysis */}
      {viewMode === 'territories' && selectedRoute && (
        <Card>
          <CardHeader>
            <CardTitle>Territory Analysis - {selectedRoute.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(() => {
                const analysis = analyzeRoute(selectedRoute);
                return (
                  <>
                    <div className="stats-grid">
                      <div className="metric-card">
                        <div className="text-metric text-stealth-lime">{analysis.ownedTerritories}</div>
                        <div className="text-caption text-stealth-gray">Your Territories</div>
                      </div>
                      <div className="metric-card">
                        <div className="text-metric text-stealth-error">{analysis.enemyTerritories}</div>
                        <div className="text-caption text-stealth-gray">Enemy Territories</div>
                      </div>
                      <div className="metric-card">
                        <div className="text-metric text-stealth-white">{analysis.neutralTerritories}</div>
                        <div className="text-caption text-stealth-gray">Unclaimed</div>
                      </div>
                      <div className="metric-card">
                        <div className={`text-metric ${getStrategicColor(analysis.strategicValue)}`}>
                          {analysis.strategicValue.toUpperCase()}
                        </div>
                        <div className="text-caption text-stealth-gray">Priority Level</div>
                      </div>
                    </div>

                    <div className="bg-stealth-surface rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          analysis.recommendedAction === 'attack' ? 'bg-stealth-error' :
                          analysis.recommendedAction === 'defend' ? 'bg-stealth-warning' :
                          'bg-stealth-success'
                        }`}></div>
                        <div>
                          <div className="text-body font-medium">
                            Recommended Action: {analysis.recommendedAction.charAt(0).toUpperCase() + analysis.recommendedAction.slice(1)}
                          </div>
                          <div className="text-caption text-stealth-gray">
                            {analysis.recommendedAction === 'attack' && 'High enemy presence - aggressive expansion needed'}
                            {analysis.recommendedAction === 'defend' && 'Protect your current territories from rivals'}
                            {analysis.recommendedAction === 'expand' && 'Good opportunity for territorial growth'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Strategic Recommendations */}
      {viewMode === 'strategic' && (
        <Card>
          <CardHeader>
            <CardTitle>Strategic Intelligence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-stealth-surface rounded-xl p-4">
              <div className="text-body-lg font-medium mb-2">🎯 High Priority Targets</div>
              <div className="text-body text-stealth-gray">
                Focus on the Riverside Trail - 7 enemy territories detected with weak defenses
              </div>
            </div>

            <div className="bg-stealth-surface rounded-xl p-4">
              <div className="text-body-lg font-medium mb-2">🛡️ Defensive Positions</div>
              <div className="text-body text-stealth-gray">
                City Center Loop requires reinforcement - rival activity increased by 40%
              </div>
            </div>

            <div className="bg-stealth-surface rounded-xl p-4">
              <div className="text-body-lg font-medium mb-2">📈 Expansion Opportunities</div>
              <div className="text-body text-stealth-gray">
                Park Circuit shows 12 unclaimed territories - perfect for growth
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      {selectedRoute && (
        <div className="space-y-4">
          <Button className="w-full" onClick={handleStartRun}>
            <span>🏃‍♂️</span>
            Execute Route: {selectedRoute.name}
          </Button>

          <Button
            variant="secondary"
            className="w-full"
            onClick={() => navigate('/dashboard')}
          >
            ← Back to Dashboard
          </Button>
        </div>
      )}
    </div>
  );
};