// Core Types
export interface Location {
  lat: number;
  lng: number;
}

export interface Territory {
  id: string;
  polygon: Location[];
  ownerId: string | null;
  claimedAt: Date | null;
  areaSquareMeters: number;
  status: 'owned' | 'enemy' | 'neutral';
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

export interface RunActivity {
  id: string;
  runnerId: string;
  status: 'active' | 'paused' | 'completed';
  startTime: Date;
  endTime?: Date;
  distanceMeters: number;
  route: Location[];
  territoriesClaimed: string[];
  calories?: number;
  averagePace?: number;
}

export interface RunStats {
  distance: number; // in km
  duration: number; // in seconds
  pace: number; // in minutes per km
  calories: number;
  territoriesClaimed: number;
}

export interface TerritoryStats {
  owned: number;
  rival: number;
  unclaimed: number;
  totalAreaOwned: number; // in square meters
}

export interface RunnerProfile {
  id: string;
  name: string;
  totalDistance: number; // in km
  totalTerritories: number;
  currentTerritoryOwned: number; // in square meters
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

// UI Component Props
export interface MetricCardProps {
  value: string | number;
  unit: string;
  label: string;
  color?: 'default' | 'accent' | 'error' | 'success';
  className?: string;
}

export interface StatusIndicatorProps {
  status: 'success' | 'warning' | 'error';
  label: string;
  className?: string;
}

export interface RouteOptionProps {
  route: Route;
  isSelected: boolean;
  onSelect: (routeId: string) => void;
}

export interface WeatherWidgetProps {
  weather: WeatherData;
  className?: string;
}

export interface TerritoryMapProps {
  territories: Territory[];
  currentLocation?: Location;
  className?: string;
  onTerritoryClick?: (territory: Territory) => void;
}

export interface LiveStatsOverlayProps {
  stats: LiveRunData;
  className?: string;
}

export interface RunControlsProps {
  isActive: boolean;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  className?: string;
}

// Navigation Types
export type PageRoute = 'dashboard' | 'active-run' | 'run-summary';

export interface NavigationItem {
  id: PageRoute;
  label: string;
  icon: string;
  path: string;
}

// API Response Types (for future backend integration)
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Hook Return Types
export interface UseRunTrackerReturn {
  runData: LiveRunData | null;
  startRun: (routeId: string) => void;
  pauseRun: () => void;
  resumeRun: () => void;
  stopRun: () => void;
  isLoading: boolean;
  error: string | null;
}

export interface UseTerritoryReturn {
  territories: Territory[];
  stats: TerritoryStats;
  claimTerritory: (location: Location) => void;
  isLoading: boolean;
  error: string | null;
}

export interface UseLocationReturn {
  location: Location | null;
  isLoading: boolean;
  error: string | null;
  requestPermission: () => Promise<boolean>;
}

// Event Types
export interface TerritoryClaimedEvent {
  territoryId: string;
  location: Location;
  timestamp: Date;
}

export interface RunCompletedEvent {
  runId: string;
  stats: RunStats;
  territoriesClaimed: Territory[];
  timestamp: Date;
}

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
