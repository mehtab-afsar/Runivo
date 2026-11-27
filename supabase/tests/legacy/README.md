# Legacy migrations used by tests

Three standalone tests (`close_user_id_rpcs`, `mission_verified_distance`,
`storage_listing`) apply one old migration each to a stand-in schema. Those
three files live here. The other 175 files from the pre-squash history (178 in
all, March to November 2026) were deleted after commit `9e5cf19`; recover any
of them with `git show 9e5cf19:docs/archive/supabase-migrations/migrations_2026/<file>`.
They are not read by the Supabase CLI or `supabase/tests/run.sh`.
