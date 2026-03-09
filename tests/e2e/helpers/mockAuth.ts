import { Page } from '@playwright/test';

// Must match the `storageKey` set in src/shared/services/supabase.ts
const SUPABASE_STORAGE_KEY = 'runivo-auth';

function b64url(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

const now = Math.floor(Date.now() / 1000);
const fakeJwt = [
  b64url({ alg: 'HS256', typ: 'JWT' }),
  b64url({
    sub: 'user-e2e-1',
    email: 'test@runivo.app',
    role: 'authenticated',
    aud: 'authenticated',
    exp: now + 7200,
    iat: now,
  }),
  'fakesig',
].join('.');

const FAKE_SESSION = {
  access_token: fakeJwt,
  refresh_token: 'fake-refresh-token',
  expires_in: 7200,
  expires_at: now + 7200,
  token_type: 'bearer',
  user: {
    id: 'user-e2e-1',
    email: 'test@runivo.app',
    role: 'authenticated',
    aud: 'authenticated',
    created_at: '2024-01-01T00:00:00Z',
  },
};

const FAKE_PROFILE = [
  {
    id: 'user-e2e-1',
    username: 'TestRunner',
    level: 5,
    xp: 1200,
    coins: 300,
    diamonds: 10,
    energy: 80,
    subscription_tier: 'free',
    total_distance_km: 42.5,
    total_runs: 15,
    phone: null,
    subscription_expires_at: null,
  },
];

/**
 * Sets up a fake Supabase session before each E2E test.
 * Uses Playwright's storageState (direct localStorage injection) rather than
 * trying to patch localStorage.getItem in the browser, which is unreliable.
 *
 * Call BEFORE page.goto().
 */
const FAKE_PLAYER = {
  id: 'user-e2e-1',
  username: 'TestRunner',
  level: 5,
  xp: 1200,
  coins: 300,
  diamonds: 10,
  energy: 80,
  lastEnergyRegen: Date.now(),
  totalDistanceKm: 42.5,
  totalRuns: 15,
  totalTerritoriesClaimed: 25,
  totalEnemyCaptured: 0,
  streakDays: 3,
  lastRunDate: '2024-01-01',
  lastIncomeCollection: Date.now(),
  unlockedAchievements: [],
  createdAt: Date.now(),
};

export async function mockAuth(page: Page) {
  // 1. Use addInitScript to set localStorage before any JS runs
  await page.addInitScript(
    ({ storageKey, session, profile, supabaseLocalBase, player }) => {
      // Onboarding bypass
      localStorage.setItem('runivo-onboarding-complete', 'true');
      // Set session using exact storage key
      localStorage.setItem(storageKey, JSON.stringify(session));

      // Seed IndexedDB with player data so Profile page doesn't show loading.
      // IMPORTANT: must open at the SAME version the app uses (6) and close
      // the connection afterwards — otherwise the app's openDB(6) upgrade is
      // blocked forever by our lingering v4 connection.
      const seedIDB = () => {
        const openReq = window.indexedDB.open('runivo', 6);
        openReq.onupgradeneeded = (event: IDBVersionChangeEvent) => {
          const db = (event.target as IDBOpenDBRequest).result;
          const oldVersion = event.oldVersion;
          if (oldVersion < 1) {
            const runStore = db.createObjectStore('runs', { keyPath: 'id' });
            runStore.createIndex('startTime', 'startTime');
            runStore.createIndex('synced', 'synced');
            db.createObjectStore('territories', { keyPath: 'hexId' });
            db.createObjectStore('player', { keyPath: 'id' });
            db.createObjectStore('pendingActions', { keyPath: 'id', autoIncrement: true });
          }
          if (oldVersion < 2) db.createObjectStore('missions', { keyPath: 'id' });
          if (oldVersion < 3 && !db.objectStoreNames.contains('profile')) {
            db.createObjectStore('profile', { keyPath: 'playerId' });
          }
          if (oldVersion < 4) {
            if (db.objectStoreNames.contains('profile')) db.deleteObjectStore('profile');
            db.createObjectStore('profile', { keyPath: 'playerId' });
          }
          if (oldVersion < 5) {
            if (db.objectStoreNames.contains('territories')) db.deleteObjectStore('territories');
            db.createObjectStore('territories', { keyPath: 'id' });
          }
          if (oldVersion < 6) {
            db.createObjectStore('settings', { keyPath: 'id' });
          }
        };
        openReq.onsuccess = (event: Event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          try {
            const tx = db.transaction('player', 'readwrite');
            tx.objectStore('player').put(player);
            tx.oncomplete = () => db.close(); // ← CRITICAL: release connection so app can open at v6
          } catch {
            db.close();
          }
        };
        openReq.onerror = () => { /* ignore */ };
      };
      seedIDB();

      // Intercept all fetch to Supabase endpoints (any host — local or cloud)
      const _orig = window.fetch.bind(window);
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
            ? input.href
            : (input as Request).url;

        const isSupabase = url.includes('supabase.co') || url.includes(supabaseLocalBase);

        if (isSupabase && (url.includes('/auth/v1/token') || url.includes('/auth/v1/user'))) {
          return new Response(JSON.stringify(session), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (isSupabase && url.includes('/rest/v1/profiles')) {
          return new Response(JSON.stringify(profile), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (isSupabase && (url.includes('/rest/v1/') || url.includes('/realtime/v1/'))) {
          return new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return _orig(input, init);
      };
    },
    {
      storageKey: SUPABASE_STORAGE_KEY,
      session: FAKE_SESSION,
      profile: FAKE_PROFILE,
      supabaseLocalBase: 'http://127.0.0.1:54321',
      player: FAKE_PLAYER,
    }
  );
}
