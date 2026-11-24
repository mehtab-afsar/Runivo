/**
 * Sync service: keeps the local SQLite store (runivo.db, via ./store) and Supabase in step.
 *
 * Local-first. The phone is the source of truth while offline and every write lands in
 * SQLite first; Supabase is the authority once a write is confirmed.
 *
 *   Writes   SQLite (optimistic) → Supabase. Runs are uploaded, then scored by the
 *            idempotent `process-run-territory` edge function (PostGIS steal/claim,
 *            PACE). Territory and PACE are server-authoritative: the client never pushes them.
 *   Reads    Supabase → SQLite. Pulls never overwrite a record with unsynced local changes.
 *   Queue    There is no queue table. What still has to go up is derived from the local
 *            rows (a run's `synced` / `serverProcessed`, a route's `synced`), so a crash
 *            mid-sync just resumes on the next one. Failed pushes are retried with
 *            exponential backoff (syncQueue); status is observable via onSyncStatusChange.
 *   Entry    initialSync() at launch, postRunSync() after every finished run.
 *
 * This file only re-exports. The code lives in ./sync/:
 *   syncQueue      status, retry/backoff, reporting of recovered failures
 *   syncErrorReporting  forwards those failures to errorReporting.ts (Sentry)
 *   syncAuth       the authenticated-user guard shared by every push/pull
 *   syncPush       uploading unsynced runs
 *   syncScoring    server scoring of an uploaded run, plus its follow-ups
 *   uploadTrace    GPS trace simplification for upload
 *   syncPull       runs, own territories, map-viewport polygons
 *   syncProfile    profile push/pull
 *   syncRoutes     saved routes + nearby public routes
 *   syncNutrition  nutrition logs and profile
 *   syncFeed       feed posts
 *   syncFlows      initialSync / postRunSync
 * (Realtime channels, live friend runs and club chat, are not part of this service: see
 * liveRunSharing.ts and the clubs services.)
 */
export { setAiCoachEnabled } from './sync/syncScoring';
export {
  getSyncStatus, onSyncStatusChange, setSyncErrorListener,
  type SyncStatus, type SyncErrorReport,
} from './sync/syncQueue';
export { forwardSyncErrorsToErrorReporting } from './sync/syncErrorReporting';
export { pushProfile, pullProfile } from './sync/syncProfile';
export { uploadTrace } from './sync/uploadTrace';
export { pushUnsyncedRuns } from './sync/syncPush';
export { pullRuns, pullTerritories, pullMapPolygons } from './sync/syncPull';
export {
  pushSavedRoutes, pullSavedRoutes, findRoutesNearby, type NearbyRoute,
} from './sync/syncRoutes';
export { pushNutritionLogs, pushNutritionProfile } from './sync/syncNutrition';
export { initialSync, postRunSync } from './sync/syncFlows';
export { createFeedPost } from './sync/syncFeed';

// DATABASE helper: safe select from the local store for offline reads.
export { getDB } from './store';
