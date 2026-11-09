import assert from 'node:assert/strict';
import test from 'node:test';
import initSqlJs from 'sql.js';
import { readVerifiedReading } from './reading.js';

const SQL = await initSqlJs();
const date = '2026-11-09';
const url = 'https://www.vaticannews.va/vi/loi-chua-hang-ngay/2026/11/09.html';
const readSource = (db, day = date) => readVerifiedReading(db, day, 'vatican-vi');
const readCache = (db, day = date, calendar = 'roman-general', option = 'day') => readVerifiedReading(db, day, calendar, option);
function fixture(withSources = true) {
  const db = new SQL.Database();
  db.run(`CREATE TABLE daily_readings(date TEXT PRIMARY KEY,lectionary_key TEXT,gospel_ref TEXT);
    CREATE TABLE verses(book TEXT,chapter INTEGER,verse INTEGER,verse_suffix TEXT,text TEXT);
    INSERT INTO daily_readings VALUES ('2026-11-09','ordinary_32_mon_II','Ga 2,13');
    INSERT INTO verses VALUES ('Ga',2,13,'','Gospel text');`);
  if (withSources) db.run(`CREATE TABLE daily_reading_sources(date TEXT PRIMARY KEY,gospel_ref TEXT,source_url TEXT,source_date TEXT,verified_at TEXT,celebration TEXT)`);
  return db;
}
function verify(db, options = {}) {
  db.run('INSERT INTO daily_reading_sources VALUES (?,?,?,?,?,?)', [date, options.ref ?? 'Ga 2,13', options.url ?? url,
    options.date ?? date, options.at ?? '2026-11-09T00:00:00Z', options.label ?? null]);
}
function addCache(db) {
  db.run(`CREATE TABLE reading_calendars(calendar_id TEXT,rules_version TEXT,source_url TEXT);
    CREATE TABLE reading_calendar_days(calendar_id TEXT,date TEXT,mass_option TEXT,rules_version TEXT,entry_key TEXT,celebration TEXT,observance TEXT);
    CREATE TABLE reading_date_acceptances(calendar_id TEXT,date TEXT,mass_option TEXT,review_id INTEGER);
    CREATE TABLE reading_date_reviews(id INTEGER,calendar_id TEXT,rules_version TEXT,date TEXT,mass_option TEXT,gospel_ref TEXT,evidence_url TEXT,evidence_date TEXT,review_note TEXT,celebration TEXT,reviewed_at TEXT);
    CREATE TABLE reading_entries(calendar_id TEXT,rules_version TEXT,entry_key TEXT,mass_option TEXT,review_id INTEGER);
    CREATE TABLE reading_entry_reviews(id INTEGER,calendar_id TEXT,rules_version TEXT,entry_key TEXT,mass_option TEXT,gospel_ref TEXT,evidence_url TEXT,evidence_date TEXT,review_note TEXT,reviewed_at TEXT);
    INSERT INTO reading_calendars VALUES ('roman-general','v1','https://example.test/calendar');
    INSERT INTO reading_calendar_days VALUES ('roman-general','2026-11-09','day','v1','proper:lateran:day','Cung hiến Thánh đường La-tê-ra-nô','dedication_of_the_lateran_basilica'),
      ('roman-general','2027-11-09','day','v1','proper:lateran:day','Cung hiến Thánh đường La-tê-ra-nô','dedication_of_the_lateran_basilica');
    INSERT INTO reading_entries VALUES ('roman-general','v1','proper:lateran:day','day',1);`);
  db.run('INSERT INTO reading_entry_reviews VALUES (?,?,?,?,?,?,?,?,?,?)', [1, 'roman-general', 'v1', 'proper:lateran:day', 'day', 'Ga 2,13-22', url, date, 'Reviewed invariant proper Gospel', '2026-11-09T00:00:00Z']);
  for (let verse = 14; verse <= 22; verse++) db.run("INSERT INTO verses VALUES ('Ga',2,?,'','text')", [verse]);
}

test('legacy snapshot and unverified references are unavailable', () => {
  for (const withSources of [false, true]) {
    const db = fixture(withSources);
    try { assert.deepEqual(readSource(db), { date, notFound: true }); }
    finally { db.close(); }
  }
});
test('direct source evidence must match date, reference, URL, and timestamp', () => {
  for (const options of [{ ref: 'Lc 17,1-6' }, { date: '2026-11-08' }, { url: url.replace('09.html', '08.html') }, { at: '' }]) {
    const db = fixture();
    try { verify(db, options); assert.deepEqual(readSource(db), { date, notFound: true }); }
    finally { db.close(); }
  }
});
test('source checked output retains actual evidence and does not infer a label', () => {
  const db = fixture();
  try {
    verify(db);
    const reading = readSource(db);
    assert.equal(reading.verified, true);
    assert.equal(reading.resolutionMethod, 'source_checked');
    assert.equal(reading.ref, 'Ga 2,13');
    assert.equal(reading.label, null);
    assert.equal(reading.sourceUrl, url);
    assert.equal(reading.evidenceDate, date);
  } finally { db.close(); }
});
test('reviewed source label is displayed', () => {
  const db = fixture();
  try { verify(db, { label: 'Reviewed label' }); assert.equal(readSource(db).label, 'Reviewed label'); }
  finally { db.close(); }
});
test('one reviewed mapping resolves future dates without dated rows or source records', () => {
  const db = fixture(false);
  try {
    addCache(db);
    const reading = readCache(db, '2027-11-09');
    assert.equal(reading.ref, 'Ga 2,13-22');
    assert.equal(reading.resolutionMethod, 'calendar_resolved');
    assert.equal(reading.calendarId, 'roman-general');
    assert.equal(reading.sourceUrl, url);
    assert.equal(reading.evidenceDate, date); // not fabricated as the requested future date
    assert.equal(reading.label, 'Cung hiến Thánh đường La-tê-ra-nô');
    assert.equal(readCache(db, date, 'vietnam').notFound, true);
    assert.equal(readCache(db, date, 'roman-general', 'vigil').notFound, true);
  } finally { db.close(); }
});
test('stale rules and mismatched review identity are rejected', () => {
  for (const statement of ["UPDATE reading_calendars SET rules_version='v2'", "UPDATE reading_entry_reviews SET calendar_id='vietnam'", "DELETE FROM reading_entries"]) {
    const db = fixture();
    try { addCache(db); db.run(statement); assert.equal(readCache(db).notFound, true); }
    finally { db.close(); }
  }
});
test('other-scope source mismatch cannot poison a reviewed calendar mapping', () => {
  const db = fixture();
  try {
    addCache(db);
    verify(db, { ref: 'Lc 9,23-26' });
    assert.equal(readSource(db).notFound, true);
    assert.equal(readCache(db).ref, 'Ga 2,13-22');
  } finally { db.close(); }
});
test('date-specific acceptance does not promote or replace the shared entry', () => {
  const db = fixture();
  try {
    addCache(db);
    db.run('INSERT INTO reading_date_acceptances VALUES (?,?,?,?)', ['roman-general', date, 'day', 9]);
    db.run('INSERT INTO reading_date_reviews VALUES (?,?,?,?,?,?,?,?,?,?,?)', [9, 'roman-general', 'v1', date, 'day', 'Ga 2,13-14', url, date, 'Synthetic reviewed date-only choice', 'Date-only label', '2026-11-09T01:00:00Z']);
    assert.equal(readCache(db).ref, 'Ga 2,13-14');
    assert.equal(readCache(db).resolutionMethod, 'source_checked');
    assert.equal(readCache(db).label, 'Date-only label');
    assert.equal(readCache(db, '2027-11-09').ref, 'Ga 2,13-22');
    db.run("UPDATE reading_date_reviews SET rules_version='old'");
    assert.equal(readCache(db).notFound, true); // never fall back silently
    assert.equal(readCache(db, '2027-11-09').ref, 'Ga 2,13-22');
  } finally { db.close(); }
});
test('latest source conflict quarantines only the source-only selection', () => {
  const db = fixture();
  try {
    verify(db);
    db.run('CREATE TABLE reading_observations(id INTEGER,date TEXT,calendar_id TEXT,mass_option TEXT,source_url TEXT,gospel_ref TEXT,observed_at TEXT)');
    db.run('INSERT INTO reading_observations VALUES (1,?,?,?,?,?,?)', [date, 'vatican-vi', 'day', url, 'Lc 9,23-26', '2026-11-09T01:00:00Z']);
    assert.equal(readSource(db).notFound, true);
    addCache(db);
    assert.equal(readCache(db).ref, 'Ga 2,13-22');
  } finally { db.close(); }
});
test('missing, empty, and partial verse text remain unavailable', () => {
  for (const statement of ['DELETE FROM verses', 'DELETE FROM verses WHERE verse=20', "UPDATE verses SET text='' WHERE verse=20"]) {
    const db = fixture();
    try { addCache(db); db.run(statement); assert.equal(readCache(db).notFound, true); }
    finally { db.close(); }
  }
});
