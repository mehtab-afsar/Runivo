/**
 * Where a notification's action_url should open (PRD N6). Pure, so every
 * path the server sends is covered by a test (notificationRoutes.test.ts).
 *
 *   /run                          Run tab (streak at risk, run reminder)
 *   /run/:id, /run/summary/:id    that activity's summary
 *   /feed, /feed?post=:id         Feed (kudos and comments)
 *   /territory-map[?filter=…], /map, /territory/:id   Territory map
 *   /store                        PACE Store; /store/mine → My rewards
 *   /training                     Training plan
 *   /notifications /missions /leaderboard /events /clubs /lobby /history
 *   /profile                      your profile; /profile/:id → that runner
 *   / or unknown                  nothing (the app opens where it was)
 */
export interface Route { screen: string; params?: Record<string, unknown> }

const UUIDISH = /^[0-9a-f-]{8,}$/i;
const FILTERS = new Set(['stale', 'mine', 'rivals', 'all']);

const SIMPLE: Record<string, Route> = {
  '/run':           { screen: 'Main', params: { screen: 'Run' } },
  '/feed':          { screen: 'Main', params: { screen: 'Feed' } },
  '/profile':       { screen: 'Main', params: { screen: 'Profile' } },
  '/store':         { screen: 'PACEStore' },
  '/store/mine':    { screen: 'MyRewards' },
  '/training':      { screen: 'TrainingPlan' },
  '/notifications': { screen: 'Notifications' },
  '/missions':      { screen: 'Missions' },
  '/leaderboard':   { screen: 'Leaderboard' },
  '/events':        { screen: 'Events' },
  '/clubs':         { screen: 'Club' },
  '/lobby':         { screen: 'Lobby' },
  '/history':       { screen: 'History' },
  '/year':          { screen: 'YearInRunivo' },
};

export function resolveNotificationRoute(actionUrl: string | null | undefined): Route | null {
  if (!actionUrl) return null;
  const [rawPath, query = ''] = actionUrl.trim().split('?');
  const path = rawPath.replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(query);

  if (SIMPLE[path]) return SIMPLE[path];

  if (path === '/territory-map' || path === '/map' || path.startsWith('/territory/')) {
    const filter = params.get('filter');
    return { screen: 'TerritoryMap', params: filter && FILTERS.has(filter) ? { initialFilter: filter } : undefined };
  }

  const run = path.match(/^\/run\/(?:summary\/)?([^/]+)$/);
  if (run && UUIDISH.test(run[1])) return { screen: 'RunSummary', params: { runId: run[1] } };

  const profile = path.match(/^\/profile\/([^/]+)$/);
  if (profile && UUIDISH.test(profile[1])) return { screen: 'UserProfile', params: { userId: profile[1] } };

  return null;
}
