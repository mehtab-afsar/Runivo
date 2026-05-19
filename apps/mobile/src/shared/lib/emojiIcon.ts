import {
  Pulse, Fire, Lightning, Barbell, Trophy, Globe, Shield, Sword,
  Mountains, Waves, Star, Target, Rocket, Diamond, Crown, Medal,
  Flag, MapTrifold, Wind, Leaf, type Icon,
} from 'phosphor-react-native';

interface EmojiIconEntry { icon: Icon; color: string }

const MAP: Record<string, EmojiIconEntry> = {
  '🏃': { icon: Pulse,       color: '#D93518' },
  '🔥': { icon: Fire,        color: '#EA580C' },
  '⚡': { icon: Lightning,   color: '#EAB308' },
  '💪': { icon: Barbell,     color: '#7C3AED' },
  '🏆': { icon: Trophy,      color: '#D97706' },
  '🌍': { icon: Globe,       color: '#0284C7' },
  '🛡️': { icon: Shield,      color: '#059669' },
  '⚔️': { icon: Sword,       color: '#DC2626' },
  '🏔️': { icon: Mountains,   color: '#78716C' },
  '⛰️': { icon: Mountains,   color: '#78716C' },
  '🌊': { icon: Waves,       color: '#0EA5E9' },
  '🌟': { icon: Star,        color: '#F59E0B' },
  '⭐': { icon: Star,        color: '#F59E0B' },
  '🎯': { icon: Target,      color: '#D93518' },
  '🚀': { icon: Rocket,      color: '#8B5CF6' },
  '💎': { icon: Diamond,     color: '#06B6D4' },
  '👑': { icon: Crown,       color: '#D97706' },
  '🎖️': { icon: Medal,       color: '#D97706' },
  '🏅': { icon: Medal,       color: '#D97706' },
  '🗺️': { icon: MapTrifold,  color: '#0284C7' },
  '💨': { icon: Wind,        color: '#64748B' },
  '🌱': { icon: Leaf,        color: '#16A34A' },
  '🌿': { icon: Leaf,        color: '#16A34A' },
  '🌲': { icon: Leaf,        color: '#15803D' },
  // animal → symbolic fallbacks
  '🦅': { icon: Wind,        color: '#64748B' },
  '🐺': { icon: Shield,      color: '#475569' },
  '🦁': { icon: Crown,       color: '#D97706' },
  '🐉': { icon: Fire,        color: '#DC2626' },
  '🦊': { icon: Lightning,   color: '#EA580C' },
  // misc
  '🩸': { icon: Fire,        color: '#DC2626' },
};

export function getEmojiIcon(emoji: string): EmojiIconEntry {
  return MAP[emoji] ?? { icon: Flag, color: '#9CA3AF' };
}
