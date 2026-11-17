# Database tests

Each `*.test.sql` file checks one area of the schema (PACE ledger, territory,
notifications, store, clubs, races, moderation and so on) against a real
Postgres with PostGIS. Each check prints `ok  <what>`; the first failure stops
that file with `FAILED: <what>`.

## Run

You need Postgres 15+ with PostGIS 3 (`psql` and `createdb` on your PATH).

```
supabase/tests/run.sh          # every test
supabase/tests/run.sh races    # only tests whose name contains "races"
```

`run.sh` builds one database from `_supabase_base.sql` (a stand-in for the
parts of Supabase the schema needs: the auth, storage and cron schemas, roles,
`auth.uid()` and Supabase's default grants) plus every file in
`supabase/migrations`, then runs each test inside a transaction that rolls
back. A few tests say on their first lines that they stand alone: they build
the handful of tables they need on an empty database and load one archived
migration, and `run.sh` gives each of those its own empty database.

The store test needs the `dblink` extension (Postgres contrib) for its
concurrency check.

## Signed-in users

Tests act as a runner by setting what `auth.uid()` and `auth.role()` read:

```sql
SELECT set_config('test.role', 'authenticated', true);
SELECT set_config('test.uid', '<user id>', true);
```

Create runners by inserting into `auth.users`; the sign-up trigger creates
their profiles. Set `runivo.trusted_writer = 'on'` for fixture rows that
normally only the server may write.
