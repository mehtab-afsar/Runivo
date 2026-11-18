/**
 * Runivo's one icon set. Every icon the app draws for stored data (award
 * icons, club badges, saved-route icons, ranks) comes from this table, in
 * one style (Phosphor) and four brand tones, so the app never mixes emoji
 * glyphs, stray hex colours and vector icons.
 *
 * Data keeps its old keys (the emoji or route key already saved in the
 * database); this file decides how each one is drawn.
 */
import {
  PersonSimpleRun, Fire, Lightning, Barbell, Trophy, Globe, Shield, Sword, Mountains, Waves,
  Star, Target, Rocket, Diamond, Crown, Medal, Flag, MapTrifold, Wind, Leaf, PersonSimpleWalk,
  Users, ChartBar, LockSimple, Hexagon, Spiral, CastleTurret, Buildings, Sneaker, TShirt,
  SunHorizon, Ticket, CalendarCheck, NavigationArrow, Footprints, Bicycle, TreeEvergreen,
  ArrowClockwise, PathIcon, Bird, Sun, Moon, Cookie, Coffee, Heart, Sparkle, Lightbulb,
  type Icon,
} from 'phosphor-react-native';
import type { AppColors } from '@theme';

/** The four tones icons may use. Never a raw hex at a call site. */
export type Tone = 'green' | 'amber' | 'lavender' | 'ink';

export function toneColors(C: AppColors, tone: Tone): { fg: string; bg: string } {
  switch (tone) {
    case 'green':    return { fg: C.red, bg: C.greenBg };
    case 'amber':    return { fg: C.orange, bg: C.orangeBg };
    case 'lavender': return { fg: C.lavenderInk, bg: C.lavender };
    default:         return { fg: C.t1, bg: C.surface };
  }
}

export interface Glyph { Icon: Icon; tone: Tone; label: string }

const g = (Icon: Icon, tone: Tone, label: string): Glyph => ({ Icon, tone, label });

/** Keyed by the stored emoji (variation selectors removed) or route key. */
const GLYPHS: Record<string, Glyph> = {
  // Sport and movement
  '🏃': g(PersonSimpleRun, 'green', 'Runner'),
  '🚶': g(PersonSimpleWalk, 'green', 'Walker'),
  '🚴': g(Bicycle, 'lavender', 'Cycle'),
  '👟': g(Sneaker, 'amber', 'Stride'),
  '🎽': g(TShirt, 'ink', 'Race vest'),
  '🦶': g(Footprints, 'ink', 'Footprint'),
  '💪': g(Barbell, 'ink', 'Strong'),
  // Effort and speed
  '🔥': g(Fire, 'amber', 'Fire'),
  '⚡': g(Lightning, 'lavender', 'Lightning'),
  '🚀': g(Rocket, 'lavender', 'Rocket'),
  '💨': g(Wind, 'ink', 'Wind'),
  // Winning
  '🏆': g(Trophy, 'amber', 'Trophy'),
  '🏅': g(Medal, 'amber', 'Medal'),
  '🎖': g(Medal, 'amber', 'Medal'),
  '👑': g(Crown, 'amber', 'Crown'),
  '⭐': g(Star, 'amber', 'Star'),
  '🌟': g(Star, 'amber', 'Star'),
  '💎': g(Diamond, 'lavender', 'Diamond'),
  '💯': g(Target, 'green', 'Hundred'),
  '🎯': g(Target, 'green', 'Target'),
  '🎟': g(Ticket, 'lavender', 'Ticket'),
  // Territory
  '🗺': g(MapTrifold, 'green', 'Map'),
  '⬡': g(Hexagon, 'green', 'Zone'),
  '⚔': g(Sword, 'amber', 'Battle'),
  '🛡': g(Shield, 'green', 'Shield'),
  '🌀': g(Spiral, 'green', 'Loop'),
  '🏰': g(CastleTurret, 'ink', 'Castle'),
  '🏯': g(CastleTurret, 'ink', 'Tower'),
  '🌆': g(Buildings, 'ink', 'City'),
  '🧭': g(NavigationArrow, 'lavender', 'Compass'),
  '🌍': g(Globe, 'green', 'Global'),
  // Nature
  '🏔': g(Mountains, 'lavender', 'Mountain'),
  '⛰': g(Mountains, 'lavender', 'Mountain'),
  '🌊': g(Waves, 'lavender', 'Waves'),
  '🌿': g(Leaf, 'green', 'Nature'),
  '🌱': g(Leaf, 'green', 'Nature'),
  '🌲': g(TreeEvergreen, 'green', 'Trail'),
  '🦅': g(Bird, 'ink', 'Eagle'),
  '🌅': g(SunHorizon, 'amber', 'Sunrise'),
  '☀': g(Sun, 'amber', 'Sun'),
  '🌙': g(Moon, 'lavender', 'Moon'),
  // Misc
  '📅': g(CalendarCheck, 'ink', 'Calendar'),
  '📊': g(ChartBar, 'ink', 'Chart'),
  '👥': g(Users, 'ink', 'People'),
  '🔒': g(LockSimple, 'ink', 'Locked'),
  '🍪': g(Cookie, 'amber', 'Snack'),
  '☕': g(Coffee, 'amber', 'Coffee'),
  '❤': g(Heart, 'amber', 'Heart'),
  '✨': g(Sparkle, 'lavender', 'Spark'),
  '💡': g(Lightbulb, 'amber', 'Tip'),
  // Saved-route icons (stored by key)
  run: g(PersonSimpleRun, 'green', 'Run'),
  flame: g(Fire, 'amber', 'Fire'),
  waves: g(Waves, 'lavender', 'Waves'),
  mountain: g(Mountains, 'lavender', 'Hills'),
  star: g(Star, 'amber', 'Star'),
  target: g(Target, 'green', 'Target'),
  tree: g(TreeEvergreen, 'green', 'Trail'),
  loop: g(ArrowClockwise, 'ink', 'Loop'),
  zap: g(Lightning, 'lavender', 'Fast'),
  route: g(PathIcon, 'ink', 'Route'),
  map: g(MapTrifold, 'green', 'Map'),
  trophy: g(Trophy, 'amber', 'Trophy'),
};

const FALLBACK: Glyph = g(Flag, 'ink', 'Flag');

/** How a stored emoji or icon key is drawn. Unknown keys get a neutral flag, never the raw emoji. */
export function glyphFor(key: string | null | undefined): Glyph {
  if (!key) return FALLBACK;
  return GLYPHS[key] ?? GLYPHS[key.replace(/️/g, '')] ?? FALLBACK;
}

/** True when the key has its own icon (not the fallback flag). */
export function hasGlyph(key: string | null | undefined): boolean {
  return !!key && glyphFor(key) !== FALLBACK;
}

/** Icons a runner can pick for a saved route (stored as the key). */
export const ROUTE_ICON_KEYS = ['run', 'loop', 'route', 'map', 'tree', 'mountain', 'waves', 'flame', 'zap', 'target', 'star', 'trophy'] as const;
