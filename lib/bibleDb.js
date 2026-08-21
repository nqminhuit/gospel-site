import 'server-only';
import Database from 'better-sqlite3';
import path from 'node:path';

// The committed snapshot at resources/bible.db is the sole data source — no
// runtime download from daily-bible. To update it, run
// `npm run vendor-bible-db`, commit the result, and redeploy.
const DB_PATH = path.join(process.cwd(), 'resources', 'bible.db');

export class BibleDbUnavailableError extends Error {}

let db = null;

export function getDb() {
  if (!db) {
    try {
      db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
    } catch (err) {
      throw new BibleDbUnavailableError(`bible.db not found or unreadable at ${DB_PATH}`, { cause: err });
    }
  }
  return db;
}
