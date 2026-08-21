import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const DB_URL =
  process.env.BIBLE_DB_URL ??
  'https://raw.githubusercontent.com/nqminhuit/daily-bible/master/resources/bible.db';

const parsedTtl = Number(process.env.BIBLE_DB_CACHE_TTL_MS);
const CACHE_TTL_MS = Number.isFinite(parsedTtl) && process.env.BIBLE_DB_CACHE_TTL_MS !== undefined
  ? parsedTtl
  : 60 * 60 * 1000; // 1h default
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
  await fs.writeFile(tmpPath, buf);
  await fs.rename(tmpPath, CACHE_PATH);
}

/** Returns a local filesystem path to a usable bible.db copy. */
export async function ensureFreshDbPath() {
  let stat = null;
  try {
    stat = await fs.stat(CACHE_PATH);
  } catch {
    // no cache yet
  }

  const isFresh = stat && Date.now() - stat.mtimeMs < CACHE_TTL_MS;
  if (isFresh) return CACHE_PATH;

  if (!inFlight) {
    inFlight = downloadDb().finally(() => {
      inFlight = null;
    });
  }

  try {
    await inFlight;
    return CACHE_PATH;
  } catch (err) {
    if (stat) {
      console.error('[bibleDbSource] refresh failed, serving stale cache:', err);
      return CACHE_PATH;
    }
    throw new BibleDbUnavailableError('No local bible.db and download failed', { cause: err });
  }
}
