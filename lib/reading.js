import 'server-only';
import { openDb, queryOne } from './bibleDb.js';
import { getVersesForRef, hasCompleteText, equivalentRefs } from './refParser.js';

export { BibleDbUnavailableError } from './bibleDb.js';

export async function getReadingForDate(dateStr) {
  const db = await openDb();
  try { return readVerifiedReading(db, dateStr); }
  finally { db.close(); }
}

export function readVerifiedReading(
  db, dateStr, calendar = process.env.READING_CALENDAR || 'vatican-vi',
  option = process.env.READING_MASS_OPTION || 'day',
) {
  const missing = { date: dateStr, notFound: true };
  const date = new Date(dateStr + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== dateStr || option !== 'day') return missing;
  let row;
  let resolutionMethod;
  if (calendar === 'vatican-vi') {
    if (!queryOne(db, "SELECT name FROM sqlite_master WHERE type='table' AND name='daily_reading_sources'")) return missing;
    row = queryOne(db, `SELECT dr.gospel_ref,s.source_url,s.verified_at,s.celebration,s.source_date AS evidence_date
      FROM daily_readings dr JOIN daily_reading_sources s ON s.date=dr.date
      WHERE dr.date=? AND s.source_date=dr.date AND s.gospel_ref=dr.gospel_ref AND s.verified_at<>'' AND s.source_url=?`,
    [dateStr, `https://www.vaticannews.va/vi/loi-chua-hang-ngay/${dateStr.replaceAll('-', '/')}.html`]);
    resolutionMethod = 'source_checked';
    if (row && queryOne(db, "SELECT name FROM sqlite_master WHERE type='table' AND name='reading_observations'")) {
      const latest = queryOne(db, `SELECT gospel_ref FROM reading_observations WHERE date=? AND calendar_id='vatican-vi' AND mass_option='day' AND source_url=? ORDER BY julianday(observed_at) DESC,id DESC LIMIT 1`, [dateStr, row.source_url]);
      if (latest && !equivalentRefs(row.gospel_ref, latest.gospel_ref)) return missing;
    }
  } else {
    if (!queryOne(db, "SELECT name FROM sqlite_master WHERE type='table' AND name='reading_calendars'")) return missing;
    row = queryOne(db, `SELECT r.gospel_ref,r.evidence_url AS source_url,r.reviewed_at AS verified_at,r.celebration,r.rules_version,r.evidence_date,c.source_url AS calendar_source_url
      FROM reading_date_acceptances a
      JOIN reading_date_reviews r ON r.id=a.review_id AND r.calendar_id=a.calendar_id AND r.date=a.date AND r.mass_option=a.mass_option AND r.evidence_date=a.date
      JOIN reading_calendars c ON c.calendar_id=r.calendar_id AND c.rules_version=r.rules_version
      WHERE a.calendar_id=? AND a.date=? AND a.mass_option=? AND r.review_note<>'' AND r.evidence_url<>'' AND r.reviewed_at<>''`, [calendar, dateStr, option]);
    resolutionMethod = 'source_checked';
    if (!row) {
      // An invalidated local choice must not silently become an ordinary day.
      if (queryOne(db, 'SELECT review_id FROM reading_date_acceptances WHERE calendar_id=? AND date=? AND mass_option=?', [calendar, dateStr, option])) return missing;
      row = queryOne(db, `SELECT r.gospel_ref,r.evidence_url AS source_url,r.reviewed_at AS verified_at,
        d.celebration,d.entry_key,d.rules_version,r.evidence_date,c.source_url AS calendar_source_url,d.observance
        FROM reading_calendar_days d
        JOIN reading_calendars c ON c.calendar_id=d.calendar_id AND c.rules_version=d.rules_version
        JOIN reading_entries e ON e.calendar_id=d.calendar_id AND e.rules_version=d.rules_version AND e.entry_key=d.entry_key AND e.mass_option=d.mass_option
        JOIN reading_entry_reviews r ON r.id=e.review_id AND r.calendar_id=e.calendar_id AND r.rules_version=e.rules_version AND r.entry_key=e.entry_key AND r.mass_option=e.mass_option
        WHERE d.calendar_id=? AND d.date=? AND d.mass_option=? AND d.entry_key<>'' AND r.review_note<>'' AND r.evidence_url<>'' AND r.reviewed_at<>''`, [calendar, dateStr, option]);
      resolutionMethod = 'calendar_resolved';
    }
  }
  // The pinned Vietnam provider misplaces the Vietnamese Martyrs. A warm
  // derived cache must not hide that unresolved calendar-policy problem.
  // Independently reviewed exact-date choices do not derive from that provider.
  if (resolutionMethod === 'calendar_resolved' && calendar === 'vietnam' && row?.rules_version?.startsWith('romcal-')) return missing;
  if (!row?.gospel_ref) return missing;
  let verseRows;
  try {
    verseRows = getVersesForRef(db, row.gospel_ref);
    if (!hasCompleteText(verseRows, row.gospel_ref)) return missing;
  } catch (error) {
    console.error(`[reading] invalid/unavailable ref "${row.gospel_ref}" for ${dateStr}`, error);
    return missing;
  }
  return {
    date: dateStr, ref: row.gospel_ref, verses: verseRows.map(v => v.text).join(' ').trim(),
    label: row.celebration || null, verified: true,
    sourceUrl: row.source_url, verifiedAt: row.verified_at,
    resolutionMethod, calendarId: calendar, massOption: option,
    evidenceDate: row.evidence_date || null, entryKey: row.entry_key || null,
    rulesVersion: row.rules_version || null, calendarSourceUrl: row.calendar_source_url || null,
    observance: row.observance || null,
  };
}
