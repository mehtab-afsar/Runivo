# Runivo

Run to claim territory. Expo / React Native app (`apps/mobile`), a marketing and admin site (`apps/web`), shared game logic (`packages/shared`), and a Supabase backend (`supabase/`).

## Layout

| Path | What it is |
|---|---|
| `apps/mobile` | The app. Feature folders under `src/features`, shared UI and helpers under `src/shared`, design tokens under `src/theme`. |
| `packages/shared` | Game engine, local store (SQLite), sync, and types used by the app. Imported as `@shared/...`. |
| `apps/web` | Next.js site: marketing, legal, support, password reset, partner admin. Deployed from `vercel.json`. |
| `supabase/migrations` | The database, one file per feature (base, accounts, moderation, runs, territory, PACE, store, social, notifications, clubs, events, training, races). RLS and `SECURITY DEFINER` functions are the security boundary. New changes go in a new file named for its feature, e.g. `20261201000001_clubs_invites.sql`. The 178 files before the switch are in `docs/archive/supabase-migrations`. Tests: `supabase/tests/run.sh`. |
| `supabase/functions` | Edge functions (run scoring, rewards, push, webhooks). `_shared/runEngine.ts` is a generated, git-ignored copy of the engine. |
| `supabase/tests` | SQL tests. See `supabase/tests/README.md`. |
| `docs/` | Current docs. `docs/archive/` holds older audits that are partly out of date. |

## Set up

```
npm ci                 # also applies patches/ via patch-package
cp .env.example .env   # mobile needs EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
npm run ios            # or: npm run android (runs expo from apps/mobile)
```

## Checks (CI runs the same)

```
npm run typecheck
npx tsc --noEmit --project packages/shared/tsconfig.json
npm run lint           # fails on errors; there are known warnings
npm test               # vitest: shared logic, mobile helpers, pure edge-function helpers
```

## Things that bite

- **Engine copy.** `packages/shared/src/engine/runEngine.ts` is the only copy to edit. `supabase/functions/_shared/runEngine.ts` is generated from it (git-ignored; Supabase only bundles files under `supabase/functions`). `npm install` generates it; after editing the engine run `npm run engine:sync`. Deploy functions with `npm run functions:deploy -- <name>`, not a bare `supabase functions deploy`, which would ship a stale copy. A test and CI fail if the copy is stale.
- **New privileged SQL functions.** Postgres grants `EXECUTE` on new functions to everyone. End the migration with `REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon, authenticated` (and grant it back only to the roles that need it), and add the name to `supabase/tests/function_privileges.test.sql`.
- **Supabase calls are lazy.** A query builder sends nothing until it is awaited or `.then` is called. A bare `supabase.rpc(...)` statement does nothing.
- **Subscriptions are switched off for testing** in three places that must agree: `packages/shared/src/engine/entitlements.ts`, the `app_settings.subscriptions_enabled` row (`supabase/migrations/20261118000001_base.sql`), and `supabase/functions/_shared/subscriptions.ts`.
- **Web twins.** `packages/shared/src/services/*.ts` files that have a `.native.ts` sibling are web variants Metro never loads, but TypeScript resolves to them. Tests of `store.ts` do not test the shipped SQLite store.

## Before a release

Work through [docs/SECURITY_CHECKLIST.md](docs/SECURITY_CHECKLIST.md) and, before an App Store submission, [docs/APP_STORE_CHECKLIST.md](docs/APP_STORE_CHECKLIST.md) (with [docs/APP_REVIEW_NOTES.md](docs/APP_REVIEW_NOTES.md) and [docs/MODERATION.md](docs/MODERATION.md)). Current findings and what is still open: [docs/AUDIT_2026-11.md](docs/AUDIT_2026-11.md).
