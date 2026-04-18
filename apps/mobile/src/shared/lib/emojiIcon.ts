import {
  Activity, Flame, Zap, Dumbbell, Trophy, Globe, Shield, Swords,
  Mountain, Waves, Star, Target, Rocket, Gem, Crown, Medal,
  Flag, Map, Wind, Leaf, type LucideIcon,
} from 'lucide-react-native';

interface EmojiIconEntry { icon: LucideIcon; color: string }

const MAP: Record<string, EmojiIconEntry> = {
  '🏃': { icon: Activity,  color: '#D93518' },
  '🔥': { icon: Flame,     color: '#EA580C' },
  '⚡': { icon: Zap,       color: '#EAB308' },
  '💪': { icon: Dumbbell,  color: '#7C3AED' },
  '🏆': { icon: Trophy,    color: '#D97706' },
  '🌍': { icon: Globe,     color: '#0284C7' },
  '🛡️': { icon: Shield,    color: '#059669' },
  '⚔️': { icon: Swords,    color: '#DC2626' },
  '🏔️': { icon: Mountain,  color: '#78716C' },
  '⛰️': { icon: Mountain,  color: '#78716C' },
  '🌊': { icon: Waves,     color: '#0EA5E9' },
  '🌟': { icon: Star,      color: '#F59E0B' },
  '⭐': { icon: Star,      color: '#F59E0B' },
  '🎯': { icon: Target,    color: '#D93518' },
  '🚀': { icon: Rocket,    color: '#8B5CF6' },
  '💎': { icon: Gem,       color: '#06B6D4' },
  '👑': { icon: Crown,     color: '#D97706' },
  '🎖️': { icon: Medal,     color: '#D97706' },
  '🏅': { icon: Medal,     color: '#D97706' },
  '🗺️': { icon: Map,       color: '#0284C7' },
  '💨': { icon: Wind,      color: '#64748B' },
  '🌱': { icon: Leaf,      color: '#16A34A' },
  '🌿': { icon: Leaf,      color: '#16A34A' },
  '🌲': { icon: Leaf,      color: '#15803D' },
  // animal → symbolic fallbacks
  '🦅': { icon: Wind,      color: '#64748B' },
  '🐺': { icon: Shield,    color: '#475569' },
  '🦁': { icon: Crown,     color: '#D97706' },
  '🐉': { icon: Flame,     color: '#DC2626' },
  '🦊': { icon: Zap,       color: '#EA580C' },
  // misc
  '🩸': { icon: Flame,     color: '#DC2626' },
};

export function getEmojiIcon(emoji: string): EmojiIconEntry {
  return MAP[emoji] ?? { icon: Flag, color: '#9CA3AF' };
}
