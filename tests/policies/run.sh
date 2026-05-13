#!/usr/bin/env bash
# tests/policies/run.sh — pgTAP runner for RLS policy tests
#
# Usage:
#   DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres \
#     tests/policies/run.sh
#
# Or via pnpm:
#   pnpm test:policies          # requires DATABASE_URL in env
#   pnpm test:policies:ci       # uses the default Supabase local URL
#
# Prerequisites: Perl + pg_prove (TAP::Parser::SourceHandler::pgTAP)
#   macOS:  cpanm TAP::Parser::SourceHandler::pgTAP
#           (or: brew install cpanminus && cpanm TAP::Parser::SourceHandler::pgTAP)
#   Linux:  cpanm TAP::Parser::SourceHandler::pgTAP
#           (or: apt-get install libtap-parser-sourcehandler-pgtap-perl)
#
# The pg_prove binary is installed by the CPAN module above.
# After install, verify with: pg_prove --version

set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set, e.g. postgresql://postgres:postgres@localhost:54322/postgres}"

# Move into this script's directory so glob patterns resolve correctly
cd "$(dirname "$0")"

found=0
for f in *.sql *.spec.sql; do
  # 00_setup.sql is \i-included by each spec file; do not invoke it directly
  case "$f" in 00_setup.sql) continue ;; esac
  # Skip glob literals if no files matched (bash nullglob not set)
  [ -e "$f" ] || continue
  echo "==> $f"
  pg_prove -d "$DATABASE_URL" "$f" || exit 1
  found=$((found + 1))
done

if [ "$found" -eq 0 ]; then
  echo "ERROR: no .sql or .spec.sql test files found in $(pwd)" >&2
  exit 1
fi

echo ""
echo "All $found pgTAP test file(s) passed."
