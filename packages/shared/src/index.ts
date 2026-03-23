// Cross-platform services
export * from './services/config';
// missions — export functions/constants only; MissionType is already in types/game.ts
export type { GoalCategory } from './services/missions';
export { MISSION_TEMPLATES, GOAL_TO_CATEGORY, generateDailyMissions, updateMissionProgress } from './services/missions';
export * from './services/missionStore';
export * from './services/claimEngine';
export * from './services/store';
export * from './services/appleHealthService';
export * from './services/pushNotificationService';
export * from './services/supabase';
export * from './services/auth';
export * from './services/profile';
export * from './services/passiveIncome';
export * from './services/personalRecords';
export * from './services/diamonds';
export * from './services/sync';

// Cross-platform hooks
export * from './hooks/useAuth';
export * from './hooks/useGameEngine';

// Types
export * from './types/game';

// Lib
export * from './lib/avatarUtils';
