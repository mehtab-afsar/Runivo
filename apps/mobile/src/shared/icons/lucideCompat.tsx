/**
 * One icon set for the whole app. Screens that used lucide-react-native now
 * get the same names from here, drawn with Phosphor (the set the design uses).
 * That removes a second icon library from the bundle (about 1.2 MB of JS).
 * Props match what those screens pass: size, color, strokeWidth, fill, style.
 */
import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import type { Icon as PhIcon, IconWeight } from 'phosphor-react-native';
import {
  AppleLogo, ArrowLeft as PhArrowLeft, SealCheck, Bell as PhBell, Buildings, CalendarCheck as PhCalendarCheck,
  CalendarDots, Camera as PhCamera, Crown as PhCrown, ChartBar, Check as PhCheck, CaretLeft, CaretRight,
  Diamond as PhDiamond, ArrowSquareOut, Flag as PhFlag, Flame as PhFlame, Campfire, Footprints as PhFootprints,
  Gift as PhGift, Heart as PhHeart, Heartbeat, Hourglass as PhHourglass, Bank, Lock as PhLock, EnvelopeSimple,
  MapPin as PhMapPin, Megaphone as PhMegaphone, ChatCircle, Signpost, Minus as PhMinus, DotsThree,
  Phone as PhPhone, Plus as PhPlus, PathIcon, MagnifyingGlass, PaperPlaneTilt, Export, ShareNetwork,
  Shield as PhShield, ShieldWarning, Star as PhStar, SunHorizon, Sword, Tree, Trophy as PhTrophy,
  UserPlus as PhUserPlus, Users as PhUsers, ForkKnife, Watch as PhWatch, X as PhX, Lightning,
} from 'phosphor-react-native';

export interface LucideCompatProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  /** Lucide's fill: anything but 'none' draws the filled Phosphor weight. */
  fill?: string;
  style?: StyleProp<ViewStyle>;
}
export type LucideIcon = React.ComponentType<LucideCompatProps>;

function wrap(Ph: PhIcon, name: string): LucideIcon {
  const C = ({ size = 24, color, strokeWidth = 2, fill, style }: LucideCompatProps) => {
    const weight: IconWeight = fill && fill !== 'none' ? 'fill' : strokeWidth >= 2.4 ? 'bold' : strokeWidth <= 1.4 ? 'light' : 'regular';
    return <Ph size={size} color={color} weight={weight} style={style} />;
  };
  C.displayName = name;
  return C;
}

export const Apple = wrap(AppleLogo, 'Apple');
export const ArrowLeft = wrap(PhArrowLeft, 'ArrowLeft');
export const BadgeCheck = wrap(SealCheck, 'BadgeCheck');
export const Bell = wrap(PhBell, 'Bell');
export const Building2 = wrap(Buildings, 'Building2');
export const CalendarCheck = wrap(PhCalendarCheck, 'CalendarCheck');
export const CalendarDays = wrap(CalendarDots, 'CalendarDays');
export const Camera = wrap(PhCamera, 'Camera');
export const Castle = wrap(Bank, 'Castle');
export const ChartColumn = wrap(ChartBar, 'ChartColumn');
export const Check = wrap(PhCheck, 'Check');
export const ChevronLeft = wrap(CaretLeft, 'ChevronLeft');
export const ChevronRight = wrap(CaretRight, 'ChevronRight');
export const Crown = wrap(PhCrown, 'Crown');
export const Diamond = wrap(PhDiamond, 'Diamond');
export const ExternalLink = wrap(ArrowSquareOut, 'ExternalLink');
export const Flag = wrap(PhFlag, 'Flag');
export const Flame = wrap(PhFlame, 'Flame');
export const FlameKindling = wrap(Campfire, 'FlameKindling');
export const Footprints = wrap(PhFootprints, 'Footprints');
export const Gift = wrap(PhGift, 'Gift');
export const Heart = wrap(PhHeart, 'Heart');
export const HeartPulse = wrap(Heartbeat, 'HeartPulse');
export const Hourglass = wrap(PhHourglass, 'Hourglass');
export const Landmark = wrap(Bank, 'Landmark');
export const Lock = wrap(PhLock, 'Lock');
export const Mail = wrap(EnvelopeSimple, 'Mail');
export const MapPin = wrap(PhMapPin, 'MapPin');
export const Megaphone = wrap(PhMegaphone, 'Megaphone');
export const MessageCircle = wrap(ChatCircle, 'MessageCircle');
export const Milestone = wrap(Signpost, 'Milestone');
export const Minus = wrap(PhMinus, 'Minus');
export const MoreHorizontal = wrap(DotsThree, 'MoreHorizontal');
export const Phone = wrap(PhPhone, 'Phone');
export const Plus = wrap(PhPlus, 'Plus');
export const Route = wrap(PathIcon, 'Route');
export const Search = wrap(MagnifyingGlass, 'Search');
export const Send = wrap(PaperPlaneTilt, 'Send');
export const Share = wrap(Export, 'Share');
export const Share2 = wrap(ShareNetwork, 'Share2');
export const Shield = wrap(PhShield, 'Shield');
export const ShieldAlert = wrap(ShieldWarning, 'ShieldAlert');
export const Star = wrap(PhStar, 'Star');
export const Sunrise = wrap(SunHorizon, 'Sunrise');
export const Swords = wrap(Sword, 'Swords');
export const TreePine = wrap(Tree, 'TreePine');
export const Trophy = wrap(PhTrophy, 'Trophy');
export const UserPlus = wrap(PhUserPlus, 'UserPlus');
export const Users = wrap(PhUsers, 'Users');
export const UtensilsCrossed = wrap(ForkKnife, 'UtensilsCrossed');
export const Watch = wrap(PhWatch, 'Watch');
export const X = wrap(PhX, 'X');
export const Zap = wrap(Lightning, 'Zap');
