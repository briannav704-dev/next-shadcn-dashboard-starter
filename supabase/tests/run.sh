#!/usr/bin/env bash
# Applies all migrations to a throwaway local Postgres and runs the security tests.
# Usage: bash supabase/tests/run.sh   (needs Postgres 15+ binaries on PATH or PG_BIN)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
PG_BIN="${PG_BIN:-$(dirname "$(command -v initdb 2>/dev/null || ls /usr/lib/postgresql/*/bin/initdb | tail -1)")}"
WORK="$(mktemp -d)"
PORT="${PGTEST_PORT:-55432}"
cleanup() { "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

RUN_AS=()
if [ "$(id -u)" = "0" ]; then
  chown -R postgres "$WORK" 2>/dev/null || true
  RUN_AS=(runuser -u postgres --)
fi
"${RUN_AS[@]}" "$PG_BIN/initdb" -D "$WORK/data" -U postgres -A trust >/dev/null
"${RUN_AS[@]}" "$PG_BIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" start >/dev/null

PSQL=(psql -X -q -v ON_ERROR_STOP=1 -h "$WORK" -p "$PORT" -U postgres -d postgres)
"${PSQL[@]}" -f "$HERE/00_supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "migrate: $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
"${PSQL[@]}" -t -A -f "$HERE/10_security.test.sql" | grep '^ok' || { echo 'security tests FAILED'; exit 1; }
echo 'all database security tests passed'
