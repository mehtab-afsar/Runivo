// Types shared by the live run screen and its extracted pieces. Everything here is
// type-only, so nothing imports the screen (or the navigator) at runtime.
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/AppNavigator';
import type { useActiveRun } from '../hooks/useActiveRun';
import type { sportFor } from '../constants/activities';
import type { useWorkoutMode } from '@features/training/hooks/useWorkoutMode';
import type { useToast } from '@mobile/shared/hooks/useToast';

export type ActiveRunNav = NativeStackNavigationProp<RootStackParamList>;
export type ActiveRun = ReturnType<typeof useActiveRun>;
export type ActiveRunSport = ReturnType<typeof sportFor>;
export type ActiveRunWorkout = ReturnType<typeof useWorkoutMode>;
export type ShowToast = ReturnType<typeof useToast>['showToast'];
export type LatLng = { lat: number; lng: number };

export type BannerTone = 'own' | 'rival' | 'warn' | 'good';
export interface LiveBanner { text: string; tone: BannerTone }
export interface LoopRowData { label: string; detail: string; pct: number }
