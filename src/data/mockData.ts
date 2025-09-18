import type { 
  WeatherData, 
  Route, 
  Territory, 
  TerritoryStats, 
  RunStats, 
  RunnerProfile,
  Location 
} from '@/types';

// Current location (Delhi, India)
export const CURRENT_LOCATION: Location = {
  lat: 28.6139,
  lng: 77.2090
};

// Mock Weather Data
export const mockWeather: WeatherData = {
  temperature: 22,
  windSpeed: 8,
  humidity: 65,
  condition: 'sunny',
  status: 'perfect'
};

// Mock Routes
export const mockRoutes: Route[] = [
  {
    id: 'city-center-loop',
    name: 'City Center Loop',
    distance: '5.2km',
    territories: 12,
    emoji: '⚡',
    points: [
      CURRENT_LOCATION,
      { lat: CURRENT_LOCATION.lat + 0.01, lng: CURRENT_LOCATION.lng + 0.005 },
      { lat: CURRENT_LOCATION.lat + 0.015, lng: CURRENT_LOCATION.lng + 0.015 },
      { lat: CURRENT_LOCATION.lat + 0.005, lng: CURRENT_LOCATION.lng + 0.02 },
      { lat: CURRENT_LOCATION.lat - 0.005, lng: CURRENT_LOCATION.lng + 0.015 },
      CURRENT_LOCATION
    ]
  },
  {
    id: 'park-circuit',
    name: 'Park Circuit',
    distance: '3.8km',
    territories: 8,
    emoji: '🌳',
    points: [
      CURRENT_LOCATION,
      { lat: CURRENT_LOCATION.lat + 0.008, lng: CURRENT_LOCATION.lng + 0.003 },
      { lat: CURRENT_LOCATION.lat + 0.012, lng: CURRENT_LOCATION.lng + 0.008 },
      { lat: CURRENT_LOCATION.lat + 0.003, lng: CURRENT_LOCATION.lng + 0.012 },
      CURRENT_LOCATION
    ]
  },
  {
    id: 'riverside-trail',
    name: 'Riverside Trail',
    distance: '7.1km',
    territories: 18,
    emoji: '🌊',
    points: [
      CURRENT_LOCATION,
      { lat: CURRENT_LOCATION.lat + 0.02, lng: CURRENT_LOCATION.lng + 0.01 },
      { lat: CURRENT_LOCATION.lat + 0.025, lng: CURRENT_LOCATION.lng + 0.02 },
      { lat: CURRENT_LOCATION.lat + 0.015, lng: CURRENT_LOCATION.lng + 0.03 },
      { lat: CURRENT_LOCATION.lat - 0.005, lng: CURRENT_LOCATION.lng + 0.025 },
      { lat: CURRENT_LOCATION.lat - 0.01, lng: CURRENT_LOCATION.lng + 0.015 },
      CURRENT_LOCATION
    ]
  }
];

// Generate Mock Territories
export const generateMockTerritories = (count: number = 50): Territory[] => {
  const territories: Territory[] = [];
  
  for (let i = 0; i < count; i++) {
    const centerLat = CURRENT_LOCATION.lat + (Math.random() - 0.5) * 0.04;
    const centerLng = CURRENT_LOCATION.lng + (Math.random() - 0.5) * 0.04;
    
    // Create a small square territory
    const size = 0.001; // Approximately 100m x 100m
    const polygon: Location[] = [
      { lat: centerLat - size, lng: centerLng - size },
      { lat: centerLat + size, lng: centerLng - size },
      { lat: centerLat + size, lng: centerLng + size },
      { lat: centerLat - size, lng: centerLng + size }
    ];
    
    // Determine territory status
    const rand = Math.random();
    let status: Territory['status'];
    let ownerId: string | null = null;
    let claimedAt: Date | null = null;
    
    if (rand < 0.4) {
      status = 'owned';
      ownerId = 'current-user';
      claimedAt = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000); // Random date within last week
    } else if (rand < 0.6) {
      status = 'enemy';
      ownerId = `rival-${Math.floor(Math.random() * 5) + 1}`;
      claimedAt = new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000); // Random date within last 2 weeks
    } else {
      status = 'neutral';
    }
    
    territories.push({
      id: `territory-${i + 1}`,
      polygon,
      ownerId,
      claimedAt,
      areaSquareMeters: Math.floor(Math.random() * 5000) + 1000, // 1000-6000 sq meters
      status
    });
  }
  
  return territories;
};

// Mock Territory Stats
export const mockTerritoryStats: TerritoryStats = {
  owned: 45,
  rival: 23,
  unclaimed: 156,
  totalAreaOwned: 234000 // 234,000 square meters
};

// Mock Last Run Stats
export const mockLastRunStats: RunStats = {
  distance: 4.2,
  duration: 1335, // 22:15 in seconds
  pace: 5.3, // 5:18 per km
  calories: 285,
  territoriesClaimed: 7
};

// Mock Runner Profile
export const mockRunnerProfile: RunnerProfile = {
  id: 'current-user',
  name: 'Runner',
  totalDistance: 127.5,
  totalTerritories: 45,
  currentTerritoryOwned: 234000,
  personalBests: {
    longestRun: 12.8,
    fastestPace: 4.2,
    mostTerritories: 15
  }
};

// Mock Recent Activities
export const mockRecentActivities = [
  {
    id: 'run-1',
    date: '2024-01-15',
    distance: 4.2,
    duration: '22:15',
    pace: '5:18',
    territoriesClaimed: 7
  },
  {
    id: 'run-2',
    date: '2024-01-13',
    distance: 6.8,
    duration: '35:42',
    pace: '5:15',
    territoriesClaimed: 12
  },
  {
    id: 'run-3',
    date: '2024-01-11',
    distance: 3.5,
    duration: '18:30',
    pace: '5:17',
    territoriesClaimed: 5
  }
];

// Mock Leaderboard Data
export const mockLeaderboard = [
  {
    id: 'current-user',
    name: 'You',
    territories: 45,
    totalArea: 234000,
    rank: 3
  },
  {
    id: 'rival-1',
    name: 'SpeedRunner',
    territories: 67,
    totalArea: 345000,
    rank: 1
  },
  {
    id: 'rival-2',
    name: 'TerritoryKing',
    territories: 52,
    totalArea: 289000,
    rank: 2
  },
  {
    id: 'rival-3',
    name: 'FastFeet',
    territories: 38,
    totalArea: 198000,
    rank: 4
  },
  {
    id: 'rival-4',
    name: 'RunnerX',
    territories: 31,
    totalArea: 167000,
    rank: 5
  }
];

// Mock Achievements
export const mockAchievements = [
  {
    id: 'first-territory',
    title: 'First Territory',
    description: 'Claim your first territory',
    icon: '🏆',
    unlocked: true,
    unlockedAt: new Date('2024-01-01')
  },
  {
    id: 'territory-master',
    title: 'Territory Master',
    description: 'Own 50 territories',
    icon: '👑',
    unlocked: false,
    progress: 45,
    target: 50
  },
  {
    id: 'speed-demon',
    title: 'Speed Demon',
    description: 'Run at sub-4:00 pace',
    icon: '⚡',
    unlocked: false,
    progress: 4.2,
    target: 4.0
  },
  {
    id: 'marathon-runner',
    title: 'Marathon Runner',
    description: 'Complete a 42km run',
    icon: '🏃‍♂️',
    unlocked: false,
    progress: 12.8,
    target: 42.0
  }
];

// Utility function to get territory color based on status
export const getTerritoryColor = (status: Territory['status']) => {
  switch (status) {
    case 'owned':
      return {
        color: '#CAFF00',
        fillColor: 'rgba(202,255,0,0.3)'
      };
    case 'enemy':
      return {
        color: '#FF3B30',
        fillColor: 'rgba(255,59,48,0.3)'
      };
    case 'neutral':
      return {
        color: '#2A2A2A',
        fillColor: 'rgba(42,42,42,0.3)'
      };
    default:
      return {
        color: '#2A2A2A',
        fillColor: 'rgba(42,42,42,0.3)'
      };
  }
};

// Utility function to format time
export const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// Utility function to format pace
export const formatPace = (paceMinutesPerKm: number): string => {
  const minutes = Math.floor(paceMinutesPerKm);
  const seconds = Math.floor((paceMinutesPerKm - minutes) * 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// Utility function to format distance
export const formatDistance = (distanceKm: number): string => {
  return distanceKm.toFixed(1);
};

// Utility function to calculate area in human-readable format
export const formatArea = (squareMeters: number): string => {
  if (squareMeters >= 1000000) {
    return `${(squareMeters / 1000000).toFixed(1)} km²`;
  } else if (squareMeters >= 10000) {
    return `${(squareMeters / 10000).toFixed(1)} ha`;
  } else {
    return `${squareMeters.toLocaleString()} m²`;
  }
};
