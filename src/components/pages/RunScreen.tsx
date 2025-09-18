import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockWeather } from '@/data/mockData';
import { TargetIcon, ShieldIcon, MapIcon, SwordIcon, RunningIcon, ActivityIcon, RocketIcon } from '@/components/ui/icons';

interface RunType {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedTime: string;
  territoriesAvailable: number;
}

export const RunScreen: React.FC = () => {
  const navigate = useNavigate();
  const [selectedRunType, setSelectedRunType] = useState<string>('claim-territory');

  const runTypes: RunType[] = [
    {
      id: 'claim-territory',
      title: 'CLAIM TERRITORY',
      description: 'Expand your empire - Suggested: North Park (2.5km), Potential: +3 territories',
      icon: 'target',
      color: 'runner-lime',
      difficulty: 'medium',
      estimatedTime: '25-35 min',
      territoriesAvailable: 8
    },
    {
      id: 'defend-territories',
      title: 'DEFEND TERRITORIES',
      description: 'Strengthen your holdings - At Risk: 2 territories, Suggested route: 4.2km',
      icon: 'shield',
      color: 'runner-gold',
      difficulty: 'easy',
      estimatedTime: '15-25 min',
      territoriesAvailable: 5
    },
    {
      id: 'explore',
      title: 'EXPLORE',
      description: 'Discover new areas - Uncharted zones nearby, Bonus XP for new routes',
      icon: 'map',
      color: 'runner-info',
      difficulty: 'easy',
      estimatedTime: '20-30 min',
      territoriesAvailable: 12
    },
    {
      id: 'attack-run',
      title: 'ATTACK RUN',
      description: 'Target enemy territory - Weakest nearby: Central Bridge, Required: 3.5km minimum',
      icon: 'sword',
      color: 'runner-danger',
      difficulty: 'hard',
      estimatedTime: '30-45 min',
      territoriesAvailable: 15
    },
    {
      id: 'free-run',
      title: 'FREE RUN',
      description: 'Just run, no objectives - Track stats only, Peaceful mode',
      icon: 'running',
      color: 'runner-text-muted',
      difficulty: 'easy',
      estimatedTime: '15-60 min',
      territoriesAvailable: 0
    }
  ];

  const handleStartRun = () => {
    navigate('/active-run', {
      state: {
        runType: selectedRunType,
        targetTerritories: runTypes.find(t => t.id === selectedRunType)?.territoriesAvailable || 0
      }
    });
  };


  return (
    <div className="min-h-screen bg-runner-black">
      {/* Territory Runner Header */}
      <div className="safe-top pt-6 pb-4 px-6 border-b border-runner-border">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-runner-text mb-1">
            Choose Mission
          </h1>
          <p className="text-sm text-runner-text-muted">
            Select your territory objective
          </p>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6 pb-24">

        {/* Current Conditions */}
        <div className="bg-runner-card border border-runner-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-runner-warning/20 border border-runner-warning/40 flex items-center justify-center">
                <span className="text-lg">☀️</span>
              </div>
              <div>
                <div className="text-lg font-bold text-runner-text">
                  {mockWeather.temperature}°C
                </div>
                <div className="text-xs text-runner-text-muted">
                  Perfect conditions
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="bg-runner-success/20 border border-runner-success/40 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-runner-success animate-pulse"></div>
                  <span className="font-bold text-xs text-runner-success">OPTIMAL</span>
                </div>
              </div>
              <div className="text-xs text-runner-text-subtle mt-1">
                Wind {mockWeather.windSpeed}km/h • {mockWeather.humidity}% humidity
              </div>
            </div>
          </div>
        </div>

        {/* Mission Selection */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-runner-text">
            Available Missions
          </h2>
          <div className="space-y-3">
            {runTypes.map((runType) => {
              const getDifficultyColor = (diff: string) => {
                switch(diff) {
                  case 'easy': return 'runner-success';
                  case 'medium': return 'runner-warning';
                  case 'hard': return 'runner-danger';
                  default: return 'runner-text-muted';
                }
              };

              return (
                <div
                  key={runType.id}
                  onClick={() => setSelectedRunType(runType.id)}
                  className={`bg-runner-card border rounded-lg p-4 cursor-pointer transition-all duration-200 hover:border-runner-border-light ${
                    selectedRunType === runType.id
                      ? 'border-runner-lime bg-runner-lime/5'
                      : 'border-runner-border'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-runner-dark border border-runner-border flex items-center justify-center">
                      {runType.icon === 'target' && <TargetIcon size={20} color="#CAFF00" />}
                      {runType.icon === 'shield' && <ShieldIcon size={20} color="#FFD700" />}
                      {runType.icon === 'map' && <MapIcon size={20} color="#00AAFF" />}
                      {runType.icon === 'sword' && <SwordIcon size={20} color="#FF4444" />}
                      {runType.icon === 'running' && <RunningIcon size={20} color="rgba(255, 255, 255, 0.6)" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-base font-bold text-runner-text">
                          {runType.title}
                        </h3>
                        <span className={`text-xs font-bold px-2 py-1 rounded bg-${getDifficultyColor(runType.difficulty)}/20 text-${getDifficultyColor(runType.difficulty)}`}>
                          {runType.difficulty.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-runner-text-muted mb-3">
                        {runType.description}
                      </p>
                      <div className="flex items-center gap-6 text-xs text-runner-text-subtle">
                        <div className="flex items-center gap-1">
                          <ActivityIcon size={14} color="rgba(255, 255, 255, 0.4)" />
                          <span>{runType.estimatedTime}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <TargetIcon size={14} color="rgba(255, 255, 255, 0.4)" />
                          <span>{runType.territoriesAvailable} territories</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <div className={`w-5 h-5 rounded-full border-2 transition-all duration-200 ${
                        selectedRunType === runType.id
                          ? 'border-runner-lime bg-runner-lime'
                          : 'border-runner-text-subtle'
                      }`}>
                        {selectedRunType === runType.id && (
                          <div className="w-full h-full rounded-full flex items-center justify-center">
                            <div className="w-2 h-2 bg-runner-black rounded-full"></div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>


        {/* Start Mission Button */}
        <div className="space-y-4">
          <button
            onClick={handleStartRun}
            disabled={!selectedRunType}
            className="w-full h-14 bg-runner-lime hover:bg-runner-lime/90 text-runner-black font-bold text-lg tracking-wider rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg"
            style={{
              boxShadow: '0 0 30px rgba(202, 255, 0, 0.3)'
            }}
          >
            <div className="flex items-center justify-center gap-3">
              <RocketIcon size={20} color="currentColor" />
              <span>START MISSION</span>
            </div>
          </button>

          <div className="flex items-center justify-center gap-4 text-xs text-runner-text-subtle">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-runner-success"></div>
              <span>GPS Ready</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-runner-warning"></div>
              <span>Battery 85%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-runner-lime animate-pulse"></div>
              <span>Ready to Run</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};