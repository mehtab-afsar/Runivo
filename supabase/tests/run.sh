#!/bin/bash
# Database tests. Needs Postgres 15+ with PostGIS (psql, createdb on PATH).
#
#   supabase/tests/run.sh            # every test
#   supabase/tests/run.sh races      # tests whose name contains "races"
#   DATABASE_URL=postgresql://... supabase/tests/run.sh   # test that database (CI: local Supabase)
#
# Without DATABASE_URL, builds one database from _supabase_base.sql (a stand-in
# for Supabase's auth, storage and cron) plus every file in supabase/migrations.
# Each test rolls back what it does. Standalone tests (they say so on lines 1-3)
# build their own few tables on an empty database instead; with DATABASE_URL
# they're skipped, since their tables would clash with the real ones.
set -uo pipefail
cd "$(dirname "$0")/../.."
DB=${TEST_DB:-runivo_test}
FILTER=${1:-}
PSQL="psql -X -q -v ON_ERROR_STOP=1"

if [ -n "${DATABASE_URL:-}" ]; then
  TARGET="$DATABASE_URL"
else
  dropdb --if-exists "$DB" >/dev/null 2>&1; createdb "$DB" || exit 1
  $PSQL -d "$DB" -f supabase/tests/_supabase_base.sql >/dev/null 2>&1 || { echo "base failed"; exit 1; }
  for f in supabase/migrations/*.sql; do
    $PSQL -d "$DB" -f "$f" >/dev/null 2>/tmp/runivo_mig.log || { echo "migration failed: $f"; cat /tmp/runivo_mig.log; exit 1; }
  done
  TARGET="$DB"
fi

pass=0; fail=0; skipped=0
for t in supabase/tests/*.test.sql; do
  name=$(basename "$t" .test.sql)
  [[ -n "$FILTER" && "$name" != *"$FILTER"* ]] && continue
  if head -3 "$t" | grep -qiE 'stands alone|self-contained|builds a stand-in'; then
    if [ -n "${DATABASE_URL:-}" ]; then printf '  skip  %-40s standalone\n' "$name"; skipped=$((skipped+1)); continue; fi
    dropdb --if-exists "${DB}_alone" >/dev/null 2>&1; createdb "${DB}_alone"
    psql -X -q -d "${DB}_alone" -c 'create extension if not exists postgis; create extension if not exists pgcrypto' >/dev/null 2>&1
    out=$($PSQL -d "${DB}_alone" -f "$t" 2>&1); ok=$?
  else
    out=$($PSQL -d "$TARGET" -f "$t" 2>&1); ok=$?
  fi
  checks=$(grep -c 'ok  ' <<<"$out")
  if [ $ok -eq 0 ]; then pass=$((pass+1)); printf '  ok    %-40s %3d checks\n' "$name" "$checks"
  else fail=$((fail+1)); printf '  FAIL  %-40s %s\n' "$name" "$(grep -E 'ERROR|FAILED' <<<"$out" | head -1)"; fi
done
[ -z "${DATABASE_URL:-}" ] && dropdb --if-exists "${DB}_alone" >/dev/null 2>&1
echo "$pass passed, $fail failed, $skipped skipped"
[ $fail -eq 0 ]
