import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const DB_URL =
  process.env.BIBLE_DB_URL ??
  'https://raw.githubusercontent.com/nqminhuit/daily-bible/master/resources/bible.db';

const ttlEnv = process.env.BIBLE_DB_CACHE_TTL_MS;
const parsedTtl = Number(ttlEnv);
const CACHE_TTL_MS =
  ttlEnv !== undefined && ttlEnv !== '' && Number.isFinite(parsedTtl) ? parsedTtl : 60 * 60 * 1000; // 1h default
const CACHE_PATH = path.join(os.tmpdir(), 'gospel-site-bible.db');

export class BibleDbUnavailableError extends Error {}

// Dedupes concurrent refreshes within a single warm process only — not a
// cross-instance lock. Multiple cold-starting serverless instances may each
// download independently; harmless since the write below is atomic.
let inFlight = null;

async function downloadDb() {
  const res = await fetch(DB_URL, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`bible.db download failed: HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const tmpPath = `${CACHE_PATH}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.writeFile(tmpPath, buf);
    await fs.rename(tmpPath, CACHE_PATH);
  } catch (err) {
    await fs.unlink(tmpPath).catch(() => {});
    throw err;
  }
}

/** Returns { path, mtimeMs } for a usable local bible.db copy. */
export async function ensureFreshDbPath() {
  let stat = null;
  try {
    stat = await fs.stat(CACHE_PATH);
  } catch {
    // no cache yet
  }

  const isFresh = stat && Date.now() - stat.mtimeMs < CACHE_TTL_MS;
  if (isFresh) return { path: CACHE_PATH, mtimeMs: stat.mtimeMs };

  if (!inFlight) {
    inFlight = downloadDb().finally(() => {
      inFlight = null;
    });
  }

  try {
    await inFlight;
    const freshStat = await fs.stat(CACHE_PATH);
    return { path: CACHE_PATH, mtimeMs: freshStat.mtimeMs };
  } catch (err) {
    if (stat) {
      console.error('[bibleDbSource] refresh failed, serving stale cache:', err);
      return { path: CACHE_PATH, mtimeMs: stat.mtimeMs };
    }
    throw new BibleDbUnavailableError('No local bible.db and download failed', { cause: err });
  }
}
