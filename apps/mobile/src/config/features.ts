export const FEATURES = {
  // Core
  DASHBOARD:    true,
  RUN_TRACKING: true,
  PROFILE:      true,

  // Social
  SOCIAL_FEED: true,
  CLUBS:       true,
  EVENTS:      true,

  // Gamification
  DAILY_MISSIONS: true,
  GEAR_TRACKING:  true,

  // Intelligence
  AI_COACH:          true,
  NUTRITION_TRACKER: true,
  CHAT:              true,
} as const;

export const FEATURE_LABELS: Partial<Record<keyof typeof FEATURES, string>> = {
  SOCIAL_FEED:       'Social Feed',
  AI_COACH:          'AI Running Coach',
  CLUBS:             'Clubs & Teams',
  EVENTS:            'Events',
  DAILY_MISSIONS:    'Daily Missions',
  GEAR_TRACKING:     'Shoe Tracker',
  NUTRITION_TRACKER: 'Nutrition Tracker',
  CHAT:              'Chat',
};
