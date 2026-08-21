import 'server-only';
import initSqlJs from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';

// The committed snapshot at resources/bible.db is the sole data source — no
// runtime download from daily-bible. To update it, run
// `npm run vendor-bible-db`, commit the result, and redeploy.
const DB_PATH = path.join(process.cwd(), 'resources', 'bible.db');
const SQL_JS_DIST = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist');

export class BibleDbUnavailableError extends Error {}

// sql.js (WASM, not a native addon) has no N-API environment-cleanup-hook
// concept, so — unlike better-sqlite3, which crashed here (SIGABRT in
// RemoveEnvironmentCleanupHook when its native Database/Statement objects
// were finalized against a Node Environment Vercel had already torn down)
// — caching the loaded WASM module across requests is safe. Only the
// lightweight per-request Database instance (a view over the file buffer)
// is created fresh each call.
let sqlModulePromise = null;

function loadSqlModule() {
  if (!sqlModulePromise) {
    sqlModulePromise = initSqlJs({ locateFile: (file) => path.join(SQL_JS_DIST, file) });
  }
  return sqlModulePromise;
}

export async function openDb() {
  try {
    const SQL = await loadSqlModule();
    const buf = fs.readFileSync(DB_PATH);
    return new SQL.Database(buf);
  } catch (err) {
    throw new BibleDbUnavailableError(`bible.db not found or unreadable at ${DB_PATH}`, { cause: err });
  }
}

/** Runs a parameterized SELECT and returns all rows as plain objects. */
export function queryAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    return rows;
  } finally {
    stmt.free();
  }
}

/** Runs a parameterized SELECT and returns the first row, or undefined. */
export function queryOne(db, sql, params = []) {
  return queryAll(db, sql, params)[0];
}
