import React from 'react';
import { useGameState } from '@/hooks/useGameState';
import { Button } from '@/components/ui/button';
import { CastleIcon, SwordIcon, TargetIcon, EnergyIcon } from '@/components/ui/icons';
import type { Territory as GameTerritory } from '@/types/game';

interface TerritoryCardProps {
  territory: GameTerritory;
  onClose: () => void;
  onAction: (territory: GameTerritory, actionType: 'claim' | 'attack' | 'defend' | 'fortify') => void;
}

export const TerritoryCard: React.FC<TerritoryCardProps> = ({ territory, onClose, onAction }) => {
  const { playerStats, canPerformAction, calculateTerritoryRequirements } = useGameState();

  const requirements = calculateTerritoryRequirements(territory);

  const getActionType = () => {
    switch (territory.state) {
      case 'owned': return 'fortify';
      case 'enemy': return 'attack';
      case 'contested': return 'attack';
      default: return 'claim';
    }
  };

  const getActionText = () => {
    switch (territory.state) {
      case 'owned': return 'Fortify Territory';
      case 'enemy': return 'Attack Territory';
      case 'contested': return 'Join Battle';
      default: return 'Claim Territory';
    }
  };

  const getActionIcon = () => {
    switch (territory.state) {
      case 'owned': return <CastleIcon size={16} color="currentColor" />;
      case 'enemy': return <SwordIcon size={16} color="currentColor" />;
      case 'contested': return <EnergyIcon size={16} color="currentColor" />;
      default: return <TargetIcon size={16} color="currentColor" />;
    }
  };

  const getStatusColor = () => {
    switch (territory.state) {
      case 'owned': return '#00D46A';
      case 'enemy': return '#FF4747';
      case 'contested': return '#FFB800';
      case 'allied': return '#4FC3F7';
      default: return 'var(--text-secondary)';
    }
  };

  const actionType = getActionType();
  const canPerform = canPerformAction({
    id: 'temp',
    type: actionType,
    playerId: playerStats.id,
    territoryId: territory.id,
    requirements,
    rewards: { xp: 50, coins: 25 },
    startTime: new Date(),
    duration: 6,
    status: 'pending'
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}
    >
      <div
        className="w-full glass-card rounded-t-3xl p-6 animate-slide-up"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border-light)',
          maxHeight: '80vh',
          overflowY: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-h3 font-bold" style={{ color: 'var(--text-primary)' }}>
              {territory.state === 'owned' ? 'Your Territory' :
               territory.state === 'enemy' ? 'Enemy Territory' :
               territory.state === 'contested' ? 'Contested Territory' : 'Unclaimed Territory'}
            </h3>
            <p style={{ color: 'var(--text-secondary)' }}>
              Territory #{territory.hexId}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              color: 'var(--text-secondary)'
            }}
          >
            ✕
          </button>
        </div>

        {/* Status Badge */}
        <div className="mb-6">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold"
            style={{
              background: `${getStatusColor()}20`,
              color: getStatusColor(),
              border: `1px solid ${getStatusColor()}40`
            }}
          >
            <div
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ background: getStatusColor() }}
            />
            {territory.state.charAt(0).toUpperCase() + territory.state.slice(1)}
          </div>
        </div>

        {/* Territory Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold" style={{ color: 'var(--accent-primary)' }}>
              {territory.defenseStrength}
            </div>
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Defense
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold" style={{ color: '#FFB800' }}>
              {requirements.distance.toFixed(1)}km
            </div>
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Distance
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold" style={{ color: '#4FC3F7' }}>
              <div className="flex items-center justify-center gap-1">
                <EnergyIcon size={16} color="#4FC3F7" />
                {requirements.energyCost}
              </div>
            </div>
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Energy Cost
            </div>
          </div>
        </div>

        {/* Owner Info */}
        {territory.owner && (
          <div
            className="p-4 rounded-2xl mb-6"
            style={{
              background: `${getStatusColor()}10`,
              border: `1px solid ${getStatusColor()}30`
            }}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                  style={{
                    background: getStatusColor(),
                    color: '#000000'
                  }}
                >
                  {territory.owner.avatar}
                </div>
                <div>
                  <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {territory.owner.name}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Level {territory.owner.level}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold" style={{ color: getStatusColor() }}>
                  Claimed
                </div>
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {territory.history.claimedAt.toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Requirements */}
        <div
          className="p-4 rounded-2xl mb-6"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}
        >
          <h4 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            Mission Requirements
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-secondary)' }}>Distance to run:</span>
              <span style={{ color: 'var(--text-primary)' }}>{requirements.distance.toFixed(1)}km</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-secondary)' }}>Energy required:</span>
              <div className="flex items-center gap-1" style={{ color: 'var(--text-primary)' }}>
                <EnergyIcon size={14} color="var(--text-primary)" />
                {requirements.energyCost}
              </div>
            </div>
            {requirements.minPace && (
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>Min pace required:</span>
                <span style={{ color: 'var(--accent-primary)' }}>{requirements.minPace}/km</span>
              </div>
            )}
          </div>
        </div>

        {/* Rewards Preview */}
        <div
          className="p-4 rounded-2xl mb-6"
          style={{
            background: 'rgba(255, 71, 71, 0.1)',
            border: '1px solid rgba(255, 71, 71, 0.3)'
          }}
        >
          <h4 className="font-semibold mb-3" style={{ color: 'var(--accent-primary)' }}>
            Mission Rewards
          </h4>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="font-bold" style={{ color: 'var(--accent-primary)' }}>
                  +{actionType === 'attack' ? 75 : actionType === 'claim' ? 50 : 25}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>XP</div>
              </div>
              <div className="text-center">
                <div className="font-bold" style={{ color: '#FFB800' }}>
                  +{actionType === 'attack' ? 40 : actionType === 'claim' ? 25 : 15}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Coins</div>
              </div>
              {actionType === 'attack' && (
                <div className="text-center">
                  <div className="font-bold" style={{ color: '#4FC3F7' }}>+5</div>
                  <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Gems</div>
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Plus distance bonus</div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={() => onAction(territory, actionType)}
            disabled={!canPerform}
            className="flex-1 py-3 rounded-2xl font-semibold"
            style={{
              background: canPerform ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.1)',
              color: canPerform ? '#000000' : 'var(--text-secondary)'
            }}
          >
            <span className="mr-2 flex items-center">{getActionIcon()}</span>
            {getActionText()}
            {!canPerform && playerStats.subscription.tier === 'free' && (
              <span className="flex items-center gap-1 ml-2">
                (<EnergyIcon size={12} color="currentColor" /> Low Energy)
              </span>
            )}
          </Button>
          <Button
            onClick={onClose}
            className="px-6 py-3 rounded-2xl font-semibold"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              color: 'var(--text-primary)'
            }}
          >
            Cancel
          </Button>
        </div>

        {/* Premium Upgrade Hint */}
        {!canPerform && playerStats.subscription.tier === 'free' && (
          <div
            className="mt-4 p-3 rounded-2xl text-center"
            style={{
              background: 'rgba(255, 71, 71, 0.1)',
              border: '1px solid rgba(255, 71, 71, 0.3)'
            }}
          >
            <div className="text-sm" style={{ color: 'var(--accent-primary)' }}>
              💡 Upgrade to Premium for unlimited energy and exclusive features
            </div>
          </div>
        )}
      </div>
    </div>
  );
};