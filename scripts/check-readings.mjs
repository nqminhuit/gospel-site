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
// Scope: availability and internal consistency only. Liturgical correctness
// depends on the approved upstream calendar, scoped reviews, and passage audits.
// Rendering and diagnostics share one evidence/text path; no source fetch or
// independent calendar/parser implementation belongs in this availability check.
//
// Must run with --conditions=react-server so the `server-only` guard in lib/
// resolves to a no-op instead of throwing.

import { readVerifiedReading, diagnoseReading, BibleDbUnavailableError } from '../lib/reading.js';
import { openDb, queryOne } from '../lib/bibleDb.js';

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

function annotate(level, message) {
  // GitHub renders these as inline annotations on the run summary.
  if (process.env.GITHUB_ACTIONS) console.log(`::${level}::${message}`);
}

async function main() {
  // Read inside main() so a bad value is reported by the handler below
  // instead of crashing at module load with a raw stack trace.
  //
  // LOOKAHEAD_DAYS: how far ahead to require readings — enough lead time for
  // the sync/crawl/merge cycle to finish before a gap is visible, without
  // alerting on data that upstream legitimately hasn't published yet.
  // CLIFF_WARN_DAYS: how early to complain about the DB's last date, since
  // extending supported calendar definitions/evidence is a separate upstream
  // operation; generating legacy importYear estimates does not approve readings.
  const LOOKAHEAD_DAYS = intEnv('LOOKAHEAD_DAYS', 2);
  const CLIFF_WARN_DAYS = intEnv('CLIFF_WARN_DAYS', 45);
  const calendar = process.env.READING_CALENDAR || 'vietnam';

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
        // One consistent in-memory snapshot for the full check and diagnostics.
        reading = readVerifiedReading(db, date);
      } catch (e) {
        failures.push({ date, reason: `threw: ${e.message}` });
        continue;
      }

      if (reading.notFound) {
        failures.push({ date, reason: diagnoseReading(db, date) });
        continue;
      }
      if (!reading.verified || !['source_checked', 'calendar_resolved'].includes(reading.resolutionMethod)) {
        failures.push({ date, reason: 'reading has no supported resolution method' });
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
    maxDate = calendar === 'vatican-vi'
      ? queryOne(db, 'SELECT MAX(date) AS d FROM daily_readings')?.d ?? null
      : queryOne(db, "SELECT name FROM sqlite_master WHERE type='table' AND name='reading_calendars'")
        ? queryOne(db, `SELECT MAX(d.date) AS d FROM reading_calendar_days d JOIN reading_calendars c ON c.calendar_id=d.calendar_id AND c.rules_version=d.rules_version WHERE d.calendar_id=? AND d.mass_option='day'`, [calendar])?.d ?? null
        : null;
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
    console.log('\nNext: review the scoped diagnosis upstream. Re-sync only a reviewed compatible snapshot (npm run vendor-bible-db); another crawl or legacy-key import does not approve a reading.');
  }

  if (cliffTooClose) {
    const action = calendar === 'vatican-vi'
      ? 'extend upstream source-policy dates and reviewed evidence'
      : 'import the next year\'s supported calendar definitions upstream; legacy importYear estimates are not sufficient';
    const msg = `stored date range ends at ${maxDate}, only ${cliffDays} day(s) away — ${action}`;
    console.log(`\n${msg}`);
    annotate('error', msg);
  }

  if (failures.length === 0 && !cliffTooClose) {
    console.log(`PASS — all ${dates.length} day(s) render (checked window only). Stored date rows/definitions end at ${maxDate ?? '(no imported range)'}; this is not an archive reading-coverage guarantee.`);
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
