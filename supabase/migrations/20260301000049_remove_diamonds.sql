-- Economy simplification: merge diamonds into coins.
-- 1. Backfill: convert existing diamonds to coins at 10:1 rate
-- 2. Drop the diamonds column

-- Step 1: backfill before dropping
UPDATE profiles
SET coins = COALESCE(coins, 0) + COALESCE(diamonds, 0) * 10
WHERE diamonds IS NOT NULL AND diamonds > 0;

-- Step 2: drop column
ALTER TABLE profiles DROP COLUMN IF EXISTS diamonds;

-- Also drop diamonds_earned from runs table if it exists
ALTER TABLE runs DROP COLUMN IF EXISTS diamonds_earned;
