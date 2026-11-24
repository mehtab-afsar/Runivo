#!/bin/bash
# Loads the App Review seeds on a fresh database built from every migration, then
# the cleanup script, so a migration can't silently break reviewer prep again.
# Needs Postgres 15+ with PostGIS (psql, createdb on PATH). Usage: supabase/tests/seeds.sh
set -uo pipefail
cd "$(dirname "$0")/../.."
DB=${TEST_DB:-runivo_seeds}
PSQL="psql -X -q -v ON_ERROR_STOP=1"
dropdb --if-exists "$DB" >/dev/null 2>&1; createdb "$DB" || exit 1
$PSQL -d "$DB" -f supabase/tests/_supabase_base.sql >/dev/null 2>&1 || { echo "base failed"; exit 1; }
for f in supabase/migrations/*.sql; do
  $PSQL -d "$DB" -f "$f" >/dev/null 2>/tmp/runivo_seed.log || { echo "migration failed: $f"; cat /tmp/runivo_seed.log; exit 1; }
done
# The reviewer account the seeds look up (created in Auth in production).
$PSQL -d "$DB" -c "INSERT INTO auth.users (id, email, raw_user_meta_data, created_at)
  VALUES (gen_random_uuid(), 'runivo.tester1@example.com', '{\"username\":\"tester\"}', now() - interval '30 days')" >/dev/null || exit 1
status=0
for f in supabase/seed/demo_data.sql supabase/seed/demo_data_v1.sql supabase/seed/demo_cleanup.sql; do
  if out=$($PSQL -d "$DB" -f "$f" 2>&1); then printf '  ok    %s\n' "$f"; else printf '  FAIL  %s\n%s\n' "$f" "$out"; status=1; fi
done
dropdb --if-exists "$DB" >/dev/null 2>&1
exit $status
