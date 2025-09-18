import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { TerritoryMap } from '@/components/maps/TerritoryMap';
import { useGeolocation } from '@/hooks/useGeolocation';
import { generateMockTerritories } from '@/data/mockData';
import { useGameState } from '@/hooks/useGameState';
import type { Territory } from '@/types';

export const MapHome: React.FC = () => {
  const navigate = useNavigate();
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [selectedTerritory, setSelectedTerritory] = useState<Territory | null>(null);
  const [showTerritoryCard, setShowTerritoryCard] = useState(false);

  const { playerStats, startTerritoryAction, canPerformAction } = useGameState();

  const { location, requestPermission } = useGeolocation({
    watch: true,
    enableHighAccuracy: true,
  });

  useEffect(() => {
    // Initialize territories around user location
    const mockTerritories = generateMockTerritories(100);
    setTerritories(mockTerritories);
  }, []);

  useEffect(() => {
    if (!location) {
      requestPermission();
    }
  }, [location, requestPermission]);

  const handleTerritoryClick = (territory: Territory) => {
    setSelectedTerritory(territory);
    setShowTerritoryCard(true);
  };

  const handleStartRun = () => {
    navigate('/run');
  };

  const handleTerritoryManagement = () => {
    navigate('/territory');
  };

  const getTerritoryStatusColor = (status: Territory['status']) => {
    switch (status) {
      case 'owned': return 'border-stealth-lime bg-stealth-lime/10';
      case 'enemy': return 'border-stealth-error bg-stealth-error/10';
      case 'neutral': return 'border-stealth-gray bg-stealth-gray/10';
    }
  };

  const getTerritoryActionText = (territory: Territory) => {
    switch (territory.status) {
      case 'owned': return 'Fortify Territory';
      case 'enemy': return 'Plan Attack';
      case 'neutral': return 'Claim Territory';
    }
  };

  const handleTerritoryAction = async (territory: Territory) => {
    const actionType = territory.status === 'owned' ? 'fortify' :
                      territory.status === 'enemy' ? 'attack' : 'claim';

    const success = await startTerritoryAction(actionType, territory.id);

    if (success) {
      setShowTerritoryCard(false);
      navigate('/active-run');
    } else {
      // Handle insufficient energy case
      alert('Not enough energy! Upgrade to premium for unlimited energy.');
    }
  };

  return (
    <div className="relative h-screen overflow-hidden bg-runner-black">
      {/* Status Bar (Dark) */}
      <div className="absolute top-0 left-0 right-0 z-50 bg-runner-black/95 backdrop-blur-lg border-b border-runner-border">
        <div className="safe-top pt-2 pb-2 px-4">
          <div className="flex justify-between items-center">
            <div className="text-xs text-runner-text-muted">
              {new Date().toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-runner-success animate-pulse"></div>
              <span className="text-xs text-runner-text-muted">GPS Ready</span>
            </div>
          </div>
        </div>
      </div>

      {/* Territory Stats Bar */}
      <div className="absolute top-12 left-0 right-0 z-40 bg-runner-dark/90 backdrop-blur-lg border-b border-runner-border">
        <div className="px-4 py-3">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-lg font-bold text-runner-lime">{playerStats.territories.owned}</div>
              <div className="text-xs text-runner-text-muted uppercase tracking-wide">Your Land</div>
            </div>
            <div className="text-center border-x border-runner-border">
              <div className="text-lg font-bold text-runner-text">#{playerStats.level}</div>
              <div className="text-xs text-runner-text-muted uppercase tracking-wide">Rank</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-runner-gold">3🔥</div>
              <div className="text-xs text-runner-text-muted uppercase tracking-wide">Streak</div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Map */}
      <div
        className="absolute left-0 right-0 z-10"
        style={{ top: '100px', bottom: '180px' }}
      >
        <TerritoryMap
          territories={territories}
          currentLocation={location || undefined}
          center={location || { lat: 28.6139, lng: 77.2090 }}
          zoom={15}
          className="w-full h-full"
          onTerritoryClick={handleTerritoryClick}
        />

        {/* Map Overlays */}
        <div className="absolute top-4 right-4 z-20">
          <div className="bg-runner-black/80 backdrop-blur-lg rounded-lg px-3 py-2 border border-runner-border">
            <div className="text-xs text-runner-text-muted mb-1">Territory Value</div>
            <div className="text-sm font-bold text-runner-lime">2.4km²</div>
          </div>
        </div>

        {/* Live Activity Indicator */}
        <div className="absolute bottom-4 left-4 z-20">
          <div className="bg-runner-black/80 backdrop-blur-lg rounded-full px-4 py-2 border border-runner-border">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-runner-lime animate-pulse"></div>
              <span className="text-xs text-runner-text font-medium">3 runners nearby</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Overlay */}
      <div className="absolute bottom-20 left-4 right-4 z-30">
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => navigate('/run')}
            className="bg-runner-lime/20 hover:bg-runner-lime/30 border border-runner-lime/40 rounded-lg p-3 transition-all duration-200 hover:scale-105"
          >
            <div className="text-center">
              <div className="text-runner-lime text-sm font-bold mb-1">🎯</div>
              <div className="text-xs text-runner-text font-medium">EXPLORE</div>
            </div>
          </button>

          <button
            onClick={() => navigate('/territory')}
            className="bg-runner-gold/20 hover:bg-runner-gold/30 border border-runner-gold/40 rounded-lg p-3 transition-all duration-200 hover:scale-105"
          >
            <div className="text-center">
              <div className="text-runner-gold text-sm font-bold mb-1">🛡️</div>
              <div className="text-xs text-runner-text font-medium">DEFEND</div>
            </div>
          </button>

          <button
            onClick={() => navigate('/compete')}
            className="bg-runner-danger/20 hover:bg-runner-danger/30 border border-runner-danger/40 rounded-lg p-3 transition-all duration-200 hover:scale-105"
          >
            <div className="text-center">
              <div className="text-runner-danger text-sm font-bold mb-1">⚔️</div>
              <div className="text-xs text-runner-text font-medium">HUNT</div>
            </div>
          </button>
        </div>
      </div>

      {/* Pulsing RUN Button */}
      <div className="absolute bottom-6 left-6 right-6 z-50">
        <button
          onClick={handleStartRun}
          className="w-full h-14 bg-runner-lime hover:bg-runner-lime/90 text-runner-black font-bold text-lg tracking-wider rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg"
          style={{
            boxShadow: '0 0 30px rgba(202, 255, 0, 0.3)',
            animation: 'pulse 2s infinite'
          }}
        >
          <div className="flex items-center justify-center gap-2">
            <span>🏃‍♂️</span>
            <span>START RUN</span>
            <span>🏃‍♂️</span>
          </div>
        </button>
      </div>

      {/* Territory Detail Card */}
      {showTerritoryCard && selectedTerritory && (
        <div className="absolute inset-0 bg-stealth-black/50 backdrop-blur-sm z-30 flex items-end">
          <div className="w-full bg-gradient-to-t from-stealth-card to-stealth-surface rounded-t-3xl p-6 animate-slide-up border-t border-stealth-border/30">
            {/* Card Header */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-h3 font-bold text-stealth-white">
                  {selectedTerritory.status === 'owned' ? 'Your Territory' :
                   selectedTerritory.status === 'enemy' ? 'Enemy Territory' : 'Unclaimed Territory'}
                </h3>
                <p className="text-stealth-gray font-medium">Territory #{selectedTerritory.id}</p>
              </div>
              <button
                onClick={() => setShowTerritoryCard(false)}
                className="w-8 h-8 bg-stealth-surface/50 rounded-full flex items-center justify-center text-stealth-gray hover:text-stealth-white"
              >
                ✕
              </button>
            </div>

            {/* Territory Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center">
                <div className="text-metric text-stealth-white">
                  {(selectedTerritory.areaSquareMeters / 1000).toFixed(1)}k
                </div>
                <div className="text-caption text-stealth-gray font-semibold">sq meters</div>
              </div>
              <div className="text-center">
                <div className="text-metric text-stealth-lime">2.1</div>
                <div className="text-caption text-stealth-gray font-semibold">km to claim</div>
              </div>
              <div className="text-center">
                <div className="text-metric text-stealth-warning">Medium</div>
                <div className="text-caption text-stealth-gray font-semibold">difficulty</div>
              </div>
            </div>

            {/* Owner Info */}
            {selectedTerritory.ownerId && (
              <div className={`p-4 rounded-2xl mb-6 ${getTerritoryStatusColor(selectedTerritory.status)}`}>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-body font-semibold text-stealth-white">
                      {selectedTerritory.status === 'owned' ? 'You' : 'TerritoryKing'}
                    </div>
                    <div className="text-caption text-stealth-gray">
                      Claimed {selectedTerritory.claimedAt?.toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-stealth-lime">Defense: High</div>
                    <div className="text-xs text-stealth-gray">Last defended: 2h ago</div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
              <Button
                onClick={() => handleTerritoryAction(selectedTerritory)}
                className="flex-1 btn-primary-stealth"
                disabled={!canPerformAction({
                  id: 'temp',
                  type: selectedTerritory.status === 'owned' ? 'fortify' :
                        selectedTerritory.status === 'enemy' ? 'attack' : 'claim',
                  playerId: playerStats.id,
                  territoryId: selectedTerritory.id,
                  requirements: { energyCost: 10, distance: 1.0 },
                  rewards: { xp: 50, coins: 25 },
                  startTime: new Date(),
                  duration: 6,
                  status: 'pending'
                })}
              >
                <span className="mr-2">🎯</span>
                {getTerritoryActionText(selectedTerritory)}
                {!canPerformAction({
                  id: 'temp',
                  type: selectedTerritory.status === 'owned' ? 'fortify' :
                        selectedTerritory.status === 'enemy' ? 'attack' : 'claim',
                  playerId: playerStats.id,
                  territoryId: selectedTerritory.id,
                  requirements: { energyCost: 10, distance: 1.0 },
                  rewards: { xp: 50, coins: 25 },
                  startTime: new Date(),
                  duration: 6,
                  status: 'pending'
                }) && ' (⚡ Low Energy)'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowTerritoryCard(false);
                  navigate('/territory');
                }}
                className="px-6"
              >
                Details
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};