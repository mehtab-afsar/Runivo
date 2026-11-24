import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '@navigation/AppNavigator';
import type { StoredRun } from '@shared/services/store';

export type RunSummaryNav   = NativeStackNavigationProp<RootStackParamList>;
export type RunSummaryRoute = RouteProp<RootStackParamList, 'RunSummary'>;

/** What the runner typed in the edit sheet (title, notes, audience). */
export interface EditedMeta {
  title: string;
  description: string;
  visibility: string;
}

/** The feed post behind this run: kudos and comments live on it. */
export interface RunPost {
  id: string;
  likes: number;
  comments: number;
}

/** The server's verdict once it has scored the run. */
export type ServerResult = NonNullable<StoredRun['serverResult']>;

export interface ExtraStat { label: string; value: string }
export interface PrLine { title: string; sub: string }

/** One slice of the PACE-earned bar. */
export interface PacePart {
  key: string;
  label: string;
  value: number;
  color: string;
}

export type ConfirmState = 'checking' | 'confirmed' | 'pending';
