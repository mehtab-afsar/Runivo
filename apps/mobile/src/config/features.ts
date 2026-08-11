export const FEATURES = {
  // Core
  DASHBOARD:    true,
  RUN_TRACKING: true,
  PROFILE:      true,

  // Social
  SOCIAL_FEED: true,
  // Flipped on for the closed-club pilot — the target cohort already knows
  // each other, and club chat is what makes a steal shared social knowledge
  // instead of an easy-to-ignore private push. Already audited/fixed, just
  // re-exposing a working feature — not new engineering. Revert to false if
  // the pilot doesn't need it, or before a broader public launch that hasn't
  // separately validated Clubs.
  CLUBS:       true,
  // Split into hosted (in-app RSVP) vs curated (outbound registration link)
  // events, day-one launch surface — see 20260811000002_events_hosted_curated.sql.
  // The real bugs that were sitting under this flag (dead Past tab, unwired
  // join button, racy participant count, unvalidated date crash, empty share
  // handler) are fixed alongside the split, not just the new fields.
  EVENTS:      true,

  // Gamification
  DAILY_MISSIONS: true,
  GEAR_TRACKING:  false,

  // Intelligence
  // All 10 LLM-calling modes now share SAFETY_GUARDRAILS (medical/injury,
  // disordered eating, training-load sustainability, scope fence) plus a
  // deterministic pre-model red-flag check for coach_chat — see
  // supabase/functions/ai-coach/index.ts. The post-run debrief is properly
  // gated behind this flag via setAiCoachEnabled() (App.tsx → sync.ts), so
  // flipping this is now what actually turns the feature on end-to-end.
  AI_COACH:          true,
  NUTRITION_TRACKER: true,
} as const;

export const FEATURE_LABELS: Partial<Record<keyof typeof FEATURES, string>> = {
  SOCIAL_FEED:       'Social Feed',
  AI_COACH:          'AI Running Coach',
  CLUBS:             'Clubs & Teams',
  EVENTS:            'Events',
  DAILY_MISSIONS:    'Daily Missions',
  GEAR_TRACKING:     'Shoe Tracker',
  NUTRITION_TRACKER: 'Nutrition Tracker',
};
