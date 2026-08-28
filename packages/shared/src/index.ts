// Cross-platform services
export * from './services/config';
export type { GoalCategory, MissionType, Mission } from './services/missions';
export {
  MISSION_TEMPLATES, ACTIVE_MISSION_TEMPLATES, MISSION_SOURCE_LABEL,
  GOAL_TO_CATEGORY, generateDailyMissions, generateBlueprint, updateMissionProgress,
} from './services/missions';
export * from './services/missionStore';
export * from './services/claimEngine';
export * from './services/store';
export * from './services/pushNotificationService';
export * from './services/supabase';
export * from './services/auth';
export * from './services/profile';
export * from './services/passiveIncome';
export { calculatePersonalRecords, formatRecordValue, getRecordLabel } from './services/personalRecords';
export type { PersonalRecord as PersonalRecordEntry } from './services/personalRecords';
export * from './services/sync';
export * from './services/nutrition';

// Cross-platform hooks
export * from './hooks/useAuth';
export * from './hooks/useGameEngine';

// Types
export * from './types/game';

// Lib
export * from './lib/avatarUtils';
