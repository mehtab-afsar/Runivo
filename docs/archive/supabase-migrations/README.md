# Archived migrations

`migrations_2026/` holds the 178 migration files written between March and
November 2026. They were replaced on 18 November 2026 by one file per feature
in `supabase/migrations/` (base, accounts, moderation, runs, territory, PACE,
store, social, notifications, clubs, events, training, races).

A database built from the 13 feature files was checked against one built from
these 178: every table, column, function, trigger, policy, index, grant
(including column grants), storage bucket, realtime table, scheduled job and
starting row is the same, and the database tests give the same results.

This folder was moved out of `supabase/` (on 24 November 2026) so the Supabase
CLI, `supabase db push` and `supabase functions deploy` never see it. Only two
things still read these files: `scripts/switch-migrations.sh` and the two
standalone database tests that `\i` a single file
(`supabase/tests/mission_verified_distance.test.sql`, `storage_listing.test.sql`).
The files are kept because their
headers explain why things are the way they are; search here when a feature
file's design needs its history.

Live databases created before the switch: run `scripts/switch-migrations.sh`
once (see the script for what it does).
