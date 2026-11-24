# Nutrition tracker (parked for v2)

Calorie and macro tracking, the weight log, barcode food scan and the welcome
flow: 23 files, about 3,300 lines. Parked here while `FEATURES.NUTRITION_TRACKER`
is `false` (`src/config/features.ts`).

Nothing in the app imports this folder, so Metro never bundles it. It is also
left out of `tsc` (`apps/mobile/tsconfig.json`) and ESLint (`eslint.config.mjs`),
so it is **not checked and can drift** from the rest of the app until it is
restored.

## What stayed behind (still live)

- `packages/shared/src/services/nutrition.ts` (+ test): `estimateRunCalories` is
  used by the dashboard and the run summary; `computeNutritionTargets` is used here.
- `nutrition_profile`, `nutrition_log`, `weight_logs` tables in `store.native.ts`
  (`CREATE TABLE IF NOT EXISTS`), and the matching reads/writes. Existing local
  databases keep working and the data is not lost.
- The sync push for `nutrition_logs` / `nutrition_profiles` in `sync.ts`, and the
  Supabase tables (`20261118000012_training.sql`).
- The coach's `nutrition_coach` capability chip, gated on the flag.

## Restoring it

1. Move this folder back to `apps/mobile/src/features/nutrition` (the files'
   `@features/nutrition/...` imports are written for that path).
2. In `AppNavigator.tsx`, import `CalorieTrackerScreen` and `NutritionSetupScreen`,
   add `CalorieTracker: { burnKcal?: number } | undefined` and
   `NutritionSetup: undefined` to `RootStackParamList`, and add the two
   `Stack.Screen`s (gate them on `FEATURES.NUTRITION_TRACKER`).
3. Remove `src/features/_archived` from `apps/mobile/tsconfig.json` if nothing else is
   parked, add `'nutrition'` back to `FEATURES` in `eslint.config.mjs`, then run
   `npm run typecheck` and fix what drifted.
4. Add a way in (nothing navigates to these screens today), and set the flag to `true`.
