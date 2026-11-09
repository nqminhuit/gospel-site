import 'server-only';
import { openDb, queryOne } from './bibleDb.js';
import { getVersesForRef } from './refParser.js';

export { BibleDbUnavailableError } from './bibleDb.js';

/** Reads only an exact-date, source-verified reference from the snapshot. */
export async function getReadingForDate(dateStr) {
  const db = await openDb();
  try {
    return readVerifiedReading(db, dateStr);
  } finally {
    db.close();
  }
}

// Exported for deterministic tests against in-memory SQLite. A legacy snapshot
// is unavailable, not verified: don't turn calendar predictions into Mass data.
export function readVerifiedReading(db, dateStr) {
  const hasSources = queryOne(
    db,
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'daily_reading_sources'",
  );
  if (!hasSources) return { date: dateStr, notFound: true };
  const row = queryOne(
    db,
    `SELECT dr.gospel_ref, s.source_url, s.verified_at, s.celebration
     FROM daily_readings dr JOIN daily_reading_sources s ON s.date = dr.date
     WHERE dr.date = ? AND s.source_date = dr.date
       AND s.gospel_ref = dr.gospel_ref AND s.verified_at <> '' AND s.source_url = ?`,
    [dateStr, `https://www.vaticannews.va/vi/loi-chua-hang-ngay/${dateStr.replaceAll('-', '/')}.html`],
  );
  if (!row || !row.gospel_ref) return { date: dateStr, notFound: true };

  let verseRows;
  try {
    verseRows = getVersesForRef(db, row.gospel_ref);
  } catch (e) {
    console.error(`[reading] failed to parse/query gospel_ref "${row.gospel_ref}" for ${dateStr}`, e);
    return { date: dateStr, notFound: true };
  }
  if (verseRows.length === 0) return { date: dateStr, notFound: true };
  const verses = verseRows.map((v) => v.text).join(' ').trim();

  // Never label a verified feast with the unverified generic weekday name.
  // An empty celebration is preferable to a confidently wrong label.
  return {
    date: dateStr,
    ref: row.gospel_ref,
    verses,
    label: row.celebration || null,
    verified: true,
    sourceUrl: row.source_url,
    verifiedAt: row.verified_at,
  };
}
