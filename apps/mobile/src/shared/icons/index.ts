/**
 * Icons, one import: `import { GlyphIcon, GlyphBadge, UI } from '@mobile/shared/icons'`.
 *
 * Rules (the whole app):
 *  - No emoji in the app's own interface. Emoji only appear inside what
 *    people write (comments, posts, chat).
 *  - Stored emoji and icon keys are drawn with GlyphIcon / GlyphBadge.
 *  - Interface icons come from UI below, so one idea always has one icon.
 *  - Weights: regular by default, fill when on or inside a badge, bold only
 *    inside small pills at 14 pt or less.
 */
export { GlyphIcon, GlyphBadge } from './Glyph';
export { IconText } from './IconText';
export { glyphFor, hasGlyph, toneColors, ROUTE_ICON_KEYS, type Glyph, type Tone } from './glyphs';

import {
  HandsClapping, Lightbulb, LockSimple, WarningCircle, Check, Sparkle, Footprints, ThumbsUp,
  SunHorizon, Sun, Moon, Cookie,
} from 'phosphor-react-native';

/** One icon per idea in the interface. */
export const UI = {
  cheer: HandsClapping,
  thanks: ThumbsUp,
  tip: Lightbulb,
  locked: LockSimple,
  warning: WarningCircle,
  done: Check,
  pacex: Sparkle,
  foot: Footprints,
} as const;

/** Meals (nutrition). */
export const MEAL_ICONS = { breakfast: SunHorizon, lunch: Sun, dinner: Moon, snacks: Cookie } as const;
