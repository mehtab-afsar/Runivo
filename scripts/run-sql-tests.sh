#!/usr/bin/env bash
# Runs the database tests in supabase/tests against a database that already has
# every migration applied (a local `supabase start`, or a scratch Postgres with
# the Supabase roles and auth schema).
#
#   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres scripts/run-sql-tests.sh
#
# Skipped: tests whose header says to run them after a _stub_*.sql file. Those are
# the older suites that build a fake Supabase around one migration (see
# supabase/tests/README.md); on a full stack the stub would clash with the real
# auth schema.
set -u
: "${DATABASE_URL:?set DATABASE_URL to the database to test}"
cd "$(dirname "$0")/.."

pass=0; fail=0; skipped=0; failed=()
for f in supabase/tests/*.test.sql; do
  if head -8 "$f" | grep -q '_stub_'; then
    echo "skip  $f (needs a stub)"; skipped=$((skipped + 1)); continue
  fi
  if psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 -f "$f" >/tmp/sqltest.out 2>&1; then
    echo "ok    $f"; pass=$((pass + 1))
  else
    echo "FAIL  $f"; sed -n '1,12p' /tmp/sqltest.out | sed 's/^/        /'
    fail=$((fail + 1)); failed+=("$f")
  fi
done

echo
echo "passed $pass, failed $fail, skipped $skipped"
[ "$fail" -eq 0 ]
