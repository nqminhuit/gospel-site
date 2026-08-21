#!/usr/bin/env node
// Daily health check for resources/bible.db, run by
// .github/workflows/check-readings.yml.
//
// This deliberately checks a *window* of upcoming days, not just today: by the
// time today is broken, visitors are already seeing "Chưa có dữ liệu", so the
// whole point is to fail while there's still time to refresh the data.
//
// It reuses lib/reading.js — the exact code path app/page.js renders with — so
// "the check passes" means "the site renders". There is no second
// implementation here that could drift from the real one.
//
// Scope: availability and internal consistency only. Whether a gospel_ref is
// the *right* reference for a date is upstream's business (daily-bible crawls
// it from vaticannews.va); verifying that here would mean re-implementing
// ~270 lines of HTML extraction that breaks whenever their markup changes.
//
// Must run with --conditions=react-server so the `server-only` guard in lib/
// resolves to a no-op instead of throwing.

import { getReadingForDate, BibleDbUnavailableError } from '../lib/reading.js';
import { openDb, queryOne } from '../lib/bibleDb.js';
import { parseRef } from '../lib/refParser.js';

const TZ = 'Asia/Ho_Chi_Minh';

class ConfigError extends Error {}

function intEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    throw new ConfigError(`${name} must be a non-negative number, got ${JSON.stringify(raw)}`);
  }
  return Math.floor(n);
}

function todayInVietnam() {
  // en-CA gives YYYY-MM-DD; the site computes "today" exactly this way.
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  // UTC arithmetic — no local timezone or DST can shift the result.
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function daysBetween(fromStr, toStr) {
  const [fy, fm, fd] = fromStr.split('-').map(Number);
  const [ty, tm, td] = toStr.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}

/**
 * getReadingForDate() collapses every failure into `notFound` — right for the
 * page, useless for an alert. Re-query to say *why* it's missing, so the
 * workflow log names the fix instead of just the symptom.
 */
function diagnose(db, dateStr) {
  const row = queryOne(db, 'SELECT lectionary_key, gospel_ref FROM daily_readings WHERE date = ?', [
    dateStr,
  ]);
  if (!row) {
    return 'no row in daily_readings — date is outside the DB range (extend it upstream with importYear)';
  }
  if (!row.gospel_ref) {
    return `lectionary_key=${row.lectionary_key}, but gospel_ref is NULL — reading not crawled yet upstream`;
  }
  try {
    parseRef(row.gospel_ref);
  } catch (e) {
    return `gospel_ref "${row.gospel_ref}" does not parse: ${e.message}`;
  }
  return `gospel_ref "${row.gospel_ref}" parses but matches no rows in verses — verse text is missing (re-run the verses crawler upstream)`;
}

function annotate(level, message) {
  // GitHub renders these as inline annotations on the run summary.
  if (process.env.GITHUB_ACTIONS) console.log(`::${level}::${message}`);
}

async function main() {
  // Read inside main() so a bad value is reported by the handler below
  // instead of crashing at module load with a raw stack trace.
  //
  // LOOKAHEAD_DAYS: how far ahead to require readings. Two weeks is enough
  // lead time to notice, re-crawl upstream, and redeploy before a gap is
  // visible. CLIFF_WARN_DAYS: how early to complain about the DB's last date,
  // since extending the table is a separate upstream job (importYear).
  const LOOKAHEAD_DAYS = intEnv('LOOKAHEAD_DAYS', 14);
  const CLIFF_WARN_DAYS = intEnv('CLIFF_WARN_DAYS', 45);

  const today = todayInVietnam();
  const dates = Array.from({ length: LOOKAHEAD_DAYS + 1 }, (_, i) => addDays(today, i));
  const last = dates[dates.length - 1];

  console.log(`Checking readings for ${today} .. ${last} (${dates.length} days, ${TZ})\n`);

  const failures = [];
  let maxDate = null;
  let cliffDays = null;
  let cliffTooClose = false;

  const db = await openDb();
  try {
    for (const date of dates) {
      let reading;
      try {
        reading = await getReadingForDate(date);
      } catch (e) {
        // A BibleDbUnavailableError here means the file itself is gone or
        // unreadable — nothing date-specific left to check, so stop.
        if (e instanceof BibleDbUnavailableError) throw e;
        failures.push({ date, reason: `threw: ${e.message}` });
        continue;
      }

      if (reading.notFound) {
        failures.push({ date, reason: diagnose(db, date) });
        continue;
      }
      if (!reading.verses || reading.verses.trim() === '') {
        failures.push({ date, reason: 'resolved to empty verse text' });
        continue;
      }

      const label = reading.label ?? '(no label)';
      console.log(`  OK   ${date}  ${reading.ref.padEnd(22)} ${reading.verses.length} chars  ${label}`);
    }

    // The DB is a fixed table, not a rolling window — warn before it runs out.
    maxDate = queryOne(db, 'SELECT MAX(date) AS d FROM daily_readings')?.d ?? null;
    cliffDays = maxDate ? daysBetween(today, maxDate) : null;
    cliffTooClose = cliffDays !== null && cliffDays < CLIFF_WARN_DAYS;
  } finally {
    db.close();
  }

  console.log('');
  if (failures.length > 0) {
    console.log(`FAIL — ${failures.length} of ${dates.length} day(s) have no usable reading:\n`);
    for (const f of failures) {
      console.log(`  ${f.date}: ${f.reason}`);
      annotate('error', `${f.date}: ${f.reason}`);
    }
    console.log('\nFix: refresh resources/bible.db from daily-bible (npm run vendor-bible-db), then commit.');
  }

  if (cliffTooClose) {
    const msg = `bible.db ends at ${maxDate}, only ${cliffDays} day(s) away — extend the table upstream (importYear) before it runs out`;
    console.log(`\n${msg}`);
    annotate('error', msg);
  }

  if (failures.length === 0 && !cliffTooClose) {
    console.log(`PASS — all ${dates.length} day(s) render, data runs through ${maxDate} (${cliffDays} days).`);
    return 0;
  }
  return 1;
}

try {
  process.exitCode = await main();
} catch (e) {
  let msg;
  if (e instanceof BibleDbUnavailableError) {
    msg = `bible.db is missing or unreadable: ${e.message}`;
  } else if (e instanceof ConfigError) {
    msg = `bad configuration: ${e.message}`;
  } else {
    // Genuinely unexpected — keep the stack, it's the only debugging aid a
    // scheduled run leaves behind.
    msg = `check failed: ${e.stack ?? e.message}`;
  }
  console.error(msg);
  annotate('error', msg.split('\n')[0]);
  process.exitCode = 1;
}
