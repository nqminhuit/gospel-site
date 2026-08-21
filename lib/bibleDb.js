import 'server-only';
import Database from 'better-sqlite3';
import path from 'node:path';

// The committed snapshot at resources/bible.db is the sole data source — no
// runtime download from daily-bible. To update it, run
// `npm run vendor-bible-db`, commit the result, and redeploy.
const DB_PATH = path.join(process.cwd(), 'resources', 'bible.db');

export class BibleDbUnavailableError extends Error {}

// Deliberately NOT cached at module scope: better-sqlite3's native Database/
// Statement objects register a cleanup hook tied to the Node "Environment"
// they were created in. Vercel's serverless runtime can tear down and
// recreate that Environment across invocations within the same warm
// process, so a handle cached across requests can get GC-finalized against
// an Environment that no longer exists — a hard native crash
// (RemoveEnvironmentCleanupHook: assert env != nullptr), not a catchable JS
// error. Open fresh and close per request instead (see lib/reading.js).
export function openDb() {
  try {
    return new Database(DB_PATH, { readonly: true, fileMustExist: true });
  } catch (err) {
    throw new BibleDbUnavailableError(`bible.db not found or unreadable at ${DB_PATH}`, { cause: err });
  }
}
