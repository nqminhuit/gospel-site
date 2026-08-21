#!/usr/bin/env bash
# Replaces resources/bible.db with the current copy from daily-bible's master
# branch. Used by .github/workflows/check-readings.yml only *after* the check
# has already failed — the site itself never fetches anything at runtime.
#
# Mirrors scripts/vendor-bible-db.js, which does the same job from a local
# sibling checkout. Keep the journal-mode handling in the two in sync.
set -euo pipefail

SRC_URL=${SRC_URL:-https://raw.githubusercontent.com/nqminhuit/daily-bible/master/resources/bible.db}
DEST=${DEST:-resources/bible.db}

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
candidate="$tmp/bible.db"

echo "Fetching $SRC_URL"
curl -fsSL --retry 3 --retry-delay 2 -o "$candidate" "$SRC_URL"

# A 404 or a proxy error page would download as a perfectly valid file, so
# check it's really SQLite before letting it near the committed database.
if [[ $(head -c 15 "$candidate") != "SQLite format 3" ]]; then
  echo "::error::Downloaded file is not a SQLite database ($(wc -c < "$candidate") bytes)"
  exit 1
fi

integrity=$(sqlite3 "$candidate" 'PRAGMA integrity_check;')
if [[ $integrity != "ok" ]]; then
  echo "::error::Downloaded database failed integrity_check: $integrity"
  exit 1
fi

rows=$(sqlite3 "$candidate" "SELECT COUNT(*) FROM daily_readings WHERE gospel_ref IS NOT NULL AND gospel_ref <> '';")
if [[ $rows -lt 1 ]]; then
  echo "::error::Downloaded database has no readings at all — refusing to use it"
  exit 1
fi

# daily-bible ships WAL, which needs a writable directory even to *open* the
# file read-only (it creates a -shm sidecar). Vercel's filesystem is read-only
# outside /tmp, so every request would fail. The classic rollback journal needs
# no sidecar for reads.
sqlite3 "$candidate" 'PRAGMA journal_mode=DELETE;' > /dev/null
rm -f "$candidate-wal" "$candidate-shm"

before=$(sqlite3 "$DEST" "SELECT COUNT(*) FROM daily_readings WHERE gospel_ref IS NOT NULL AND gospel_ref <> '';" 2>/dev/null || echo 0)
mv "$candidate" "$DEST"
rm -f "$DEST-wal" "$DEST-shm"

echo "Synced $DEST: readings with a gospel_ref went from $before to $rows"
