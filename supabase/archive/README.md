# Archived migrations

`migrations_2026/` holds the 178 migration files written between March and
November 2026. They were replaced on 18 November 2026 by one file per feature
in `supabase/migrations/` (base, accounts, moderation, runs, territory, PACE,
store, social, notifications, clubs, events, training, races).

A database built from the 13 feature files was checked against one built from
these 178: every table, column, function, trigger, policy, index, grant
(including column grants), storage bucket, realtime table, scheduled job and
starting row is the same, and the database tests give the same results.

The Supabase CLI never reads this folder. The files are kept because their
headers explain why things are the way they are; search here when a feature
file's design needs its history.

Live databases created before the switch: run `scripts/switch-migrations.sh`
once (see the script for what it does).
