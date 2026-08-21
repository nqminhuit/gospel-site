import 'server-only';
import { getDb } from './bibleDb';
import { getVersesForRef } from './refParser';
import { parseLectionaryKey } from './lectionaryKey';
import { getVietnameseLabel } from './vietnameseLabels';

export { BibleDbUnavailableError } from './bibleDbSource';

/**
 * @param {string} dateStr 'YYYY-MM-DD'
 * @returns {Promise<{date:string, ref:string, verses:string, label:string|null} | {date:string, notFound:true}>}
 */
export async function getReadingForDate(dateStr) {
  const db = await getDb();
  const row = db
    .prepare('SELECT lectionary_key, gospel_ref FROM daily_readings WHERE date = ?')
    .get(dateStr);

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
}
