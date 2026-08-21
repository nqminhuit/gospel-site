import 'server-only';
import { openDb, queryOne } from './bibleDb.js';
import { getVersesForRef } from './refParser.js';
import { parseLectionaryKey } from './lectionaryKey.js';
import { getVietnameseLabel } from './vietnameseLabels.js';

export { BibleDbUnavailableError } from './bibleDb.js';

/**
 * @param {string} dateStr 'YYYY-MM-DD'
 * @returns {Promise<{date:string, ref:string, verses:string, label:string|null} | {date:string, notFound:true}>}
 */
export async function getReadingForDate(dateStr) {
  const db = await openDb();
  try {
    const row = queryOne(db, 'SELECT lectionary_key, gospel_ref FROM daily_readings WHERE date = ?', [
      dateStr,
    ]);

    if (!row || !row.gospel_ref) {
      return { date: dateStr, notFound: true };
    }

    let verseRows;
    try {
      verseRows = getVersesForRef(db, row.gospel_ref);
    } catch (e) {
      console.error(`[reading] failed to parse/query gospel_ref "${row.gospel_ref}" for ${dateStr}`, e);
      return { date: dateStr, notFound: true };
    }
    if (verseRows.length === 0) {
      return { date: dateStr, notFound: true };
    }
    const verses = verseRows
      .map((v) => v.text)
      .join(' ')
      .trim();

    let label = null;
    try {
      label = getVietnameseLabel(parseLectionaryKey(row.lectionary_key));
    } catch (e) {
      console.error(`[reading] failed to derive label for key "${row.lectionary_key}"`, e);
    }

    return { date: dateStr, ref: row.gospel_ref, verses, label };
  } finally {
    db.close();
  }
}
