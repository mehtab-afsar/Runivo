-- Consolidate paid subscription tiers to 'premium'
UPDATE profiles
SET subscription_tier = 'premium'
WHERE subscription_tier IN ('runner-plus', 'territory-lord', 'empire-builder');

-- Drop existing check constraint and replace with 2-tier constraint
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_subscription_tier_check;

ALTER TABLE profiles
ADD CONSTRAINT profiles_subscription_tier_check
CHECK (subscription_tier IN ('free', 'premium'));
