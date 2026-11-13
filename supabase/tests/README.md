# Database tests

`v1_integrity.test.sql` checks the PACE ledger, territory geometry and store redemption, `v1_notifications.test.sql` checks notification timing, limits and campaigns, and `v1_store.test.sql` checks partner rewards (every redemption gate, code pools, two runners racing for the last code, partner reports), against a real Postgres with PostGIS. `_stub_supabase.sql` stands in for the parts of Supabase the migration needs: roles, `auth.uid()`, and the tables it touches.

## Run

You need Postgres 15+ with PostGIS 3.

```
createdb runivo_test
psql -d runivo_test -v ON_ERROR_STOP=1 \
  -f supabase/tests/_stub_supabase.sql \
  -f supabase/migrations/20261106000001_v1_pace_and_territory_integrity.sql \
  -f supabase/tests/v1_integrity.test.sql \
  -f supabase/tests/_stub_notifications.sql \
  -f supabase/migrations/20261106000002_v1_notifications.sql \
  -f supabase/tests/v1_notifications.test.sql \
  -f supabase/tests/_stub_store.sql \
  -f supabase/migrations/20261106000003_pace_store_partners.sql \
  -f supabase/tests/v1_store.test.sql \
  -f supabase/tests/_stub_onboarding.sql \
  -f supabase/migrations/20261106000005_onboarding_profile.sql \
  -f supabase/tests/v1_onboarding.test.sql \
  -f supabase/migrations/20261106000006_partner_applications.sql \
  -f supabase/tests/v1_store_location.test.sql \
  -f supabase/tests/_stub_clubs.sql \
  -f supabase/migrations/20261106000007_clubs_near.sql \
  -f supabase/tests/v1_clubs_near.test.sql
dropdb runivo_test
```

Keep this order: each test runs right after its own migration, because a later migration can replace what an earlier test checks (the store migration rewrites `redeem_reward`, for example). The six suites run 168 checks.

The store migration changes `redeem_reward` to return JSON, so it runs after `v1_integrity.test.sql`, which checks the earlier version. The store test needs the `dblink` extension (in Postgres contrib) for its concurrency check.

Each check prints `ok  <what>`; the first failure stops the run with `FAILED: <what>`.

To test a signed-in user, the stub reads `test.role` and `test.uid`:

```sql
SELECT set_config('test.role', 'authenticated', false);
SELECT set_config('test.uid', '<user id>', false);
```
