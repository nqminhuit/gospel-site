#!/usr/bin/env node
// Updates resources/bible.db — the app's sole data source, read directly at
// runtime with no network fetch (see lib/bibleDb.js) — from a sibling
// checkout of https://github.com/nqminhuit/daily-bible. Run this whenever
// the reading data needs to be refreshed, then commit and redeploy.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const sourcePath = path.join(__dirname, '..', '..', 'daily-bible', 'resources', 'bible.db');
const destPath = path.join(__dirname, '..', 'resources', 'bible.db');

if (!fs.existsSync(sourcePath)) {
  console.error(`No daily-bible checkout found at ${sourcePath}.`);
  console.error('Clone https://github.com/nqminhuit/daily-bible as a sibling directory, or copy its resources/bible.db to resources/bible.db manually.');
  process.exit(1);
}

fs.mkdirSync(path.dirname(destPath), { recursive: true });
fs.copyFileSync(sourcePath, destPath);

// daily-bible ships its DB in WAL journal mode, which needs a writable
// directory even to *open* the file read-only (it creates a -shm sidecar
// for the shared-memory index). Vercel's deployment filesystem is read-only
// outside /tmp, so switch the vendored copy to the classic rollback
// journal — reads never need a sidecar file in that mode. Requires the
// `sqlite3` CLI locally; not a project dependency.
try {
  execFileSync('sqlite3', [destPath, 'PRAGMA journal_mode=DELETE;']);
} catch (err) {
  console.error('Failed to set journal_mode=DELETE — is the `sqlite3` CLI installed?');
  throw err;
}
fs.rmSync(`${destPath}-shm`, { force: true });
fs.rmSync(`${destPath}-wal`, { force: true });

console.log(`Copied ${sourcePath} -> ${destPath} (journal_mode=DELETE)`);
