import {
  Pulse, Fire, Waves, Mountains, Star, Target, TreeEvergreen, ArrowClockwise,
  Lightning, PathIcon as RouteIcon, MapTrifold, Trophy, type Icon,
} from 'phosphor-react-native';

export interface RouteIconOption { key: string; Icon: Icon; color: string; }

// Single source of truth for a saved route's icon+color — was previously
// hand-duplicated (RouteCard.tsx as a Record, SaveRouteSheet.tsx as an array
// of the same 12 entries), so adding a route icon meant remembering to update
// both. RouteCard needs O(1) lookup by key; SaveRouteSheet's picker needs the
// full ordered list — both are derived from this one array.
export const ROUTE_ICON_OPTIONS: RouteIconOption[] = [
  { key: 'run',      Icon: Pulse,          color: '#D93518' },
  { key: 'flame',    Icon: Fire,           color: '#EA580C' },
  { key: 'waves',    Icon: Waves,          color: '#0EA5E9' },
  { key: 'mountain', Icon: Mountains,      color: '#78716C' },
  { key: 'star',     Icon: Star,           color: '#F59E0B' },
  { key: 'target',   Icon: Target,         color: '#D93518' },
  { key: 'tree',     Icon: TreeEvergreen,  color: '#15803D' },
  { key: 'loop',     Icon: ArrowClockwise, color: '#7C3AED' },
  { key: 'zap',      Icon: Lightning,      color: '#EAB308' },
  { key: 'route',    Icon: RouteIcon,      color: '#6B6B6B' },
  { key: 'map',      Icon: MapTrifold,     color: '#0284C7' },
  { key: 'trophy',   Icon: Trophy,         color: '#D97706' },
];

export const ROUTE_ICON_MAP: Record<string, { Icon: Icon; color: string }> =
  Object.fromEntries(ROUTE_ICON_OPTIONS.map(({ key, Icon, color }) => [key, { Icon, color }]));
