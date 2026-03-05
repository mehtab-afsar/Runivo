export * from './game';

// Core Types
export interface Location {
  lat: number;
  lng: number;
}

export interface Route {
  id: string;
  name: string;
  distance: string;
  territories: number;
  emoji: string;
  points: Location[];
}

export interface WeatherData {
  temperature: number;
  windSpeed: number;
  humidity: number;
  condition: 'sunny' | 'cloudy' | 'rainy' | 'stormy';
  status: 'perfect' | 'good' | 'poor';
}

export interface RunStats {
  distance: number;
  duration: number;
  pace: number;
  calories: number;
  territoriesClaimed: number;
}

export interface TerritoryStats {
  owned: number;
  rival: number;
  unclaimed: number;
  totalAreaOwned: number;
}

export interface RunnerProfile {
  id: string;
  name: string;
  totalDistance: number;
  totalTerritories: number;
  currentTerritoryOwned: number;
  personalBests: {
    longestRun: number;
    fastestPace: number;
    mostTerritories: number;
  };
}

export interface LiveRunData {
  distance: number;
  duration: number;
  pace: number;
  territoriesClaimed: number;
  currentLocation: Location;
  isActive: boolean;
  isPaused: boolean;
}

export interface MetricCardProps {
  value: string | number;
  unit: string;
  label: string;
  color?: 'default' | 'accent' | 'error' | 'success';
  className?: string;
}
