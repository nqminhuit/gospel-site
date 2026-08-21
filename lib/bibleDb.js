import 'server-only';
import Database from 'better-sqlite3';
import { ensureFreshDbPath } from './bibleDbSource';

// Not just cached forever: after bibleDbSource atomically replaces the file
// on disk, an fd already open on the old inode keeps serving stale data
// (rename semantics), so we track mtime and reopen when it changes.
let cached = { db: null, path: null, mtimeMs: 0 };

export async function getDb() {
  const { path: dbPath, mtimeMs } = await ensureFreshDbPath();

  if (!cached.db || cached.path !== dbPath || cached.mtimeMs !== mtimeMs) {
    cached.db?.close();
    cached.db = new Database(dbPath, { readonly: true, fileMustExist: true });
    cached.path = dbPath;
    cached.mtimeMs = mtimeMs;
  }
  return cached.db;
}
