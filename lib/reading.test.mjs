import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import initSqlJs from 'sql.js';
import { readVerifiedReading, diagnoseReading } from './reading.js';

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
test('annual weekday Gospel entries reuse opaque keys across I/II first-reading cycles', () => {
  const db = fixture();
  try {
    addCache(db);
    const key = 'temporal:ordinary_time_31_tuesday:day';
    db.run("UPDATE reading_calendar_days SET date='2026-11-03', entry_key=?,observance='ordinary_time_31_tuesday',celebration='' WHERE date=?", [key, date]);
    db.run("UPDATE reading_calendar_days SET date='2023-11-07', entry_key=?,observance='ordinary_time_31_tuesday',celebration='' WHERE date='2027-11-09'", [key]);
    db.run('UPDATE reading_entries SET entry_key=?', [key]);
    db.run("UPDATE reading_entry_reviews SET entry_key=?,gospel_ref='Lc 14,15-24',evidence_date='2026-11-03',evidence_url='https://www.vaticannews.va/vi/loi-chua-hang-ngay/2026/11/03.html'", [key]);
    for (let n = 15; n <= 24; n++) db.run("INSERT INTO verses VALUES ('Lc',14,?,'',?)", [n, 'Text ' + n]);
    for (const d of ['2026-11-03', '2023-11-07']) {
      const reading = readCache(db, d);
      assert.equal(reading.ref, 'Lc 14,15-24');
      assert.equal(reading.entryKey, key);
      assert.equal(reading.evidenceDate, '2026-11-03');
      assert.equal(reading.resolutionMethod, 'calendar_resolved');
    }
    assert.equal(readVerifiedReading(db, '2023-11-07', 'vietnam').notFound, true);
  } finally { db.close(); }
});
test('unsupported Vietnam provider cannot drive a warm derived cache, but date evidence is independent', () => {
  const db = fixture();
  try {
    addCache(db);
    for (const table of ['reading_calendars', 'reading_calendar_days', 'reading_entries', 'reading_entry_reviews']) {
      db.run(`UPDATE ${table} SET calendar_id='vietnam',rules_version='romcal-3.0.0-dev.144-unreviewed'`);
    }
    assert.equal(readVerifiedReading(db, date, 'vietnam').notFound, true);
    db.run(`INSERT INTO reading_date_reviews(id,calendar_id,rules_version,date,mass_option,gospel_ref,evidence_url,evidence_date,review_note,reviewed_at,celebration) VALUES (1,'vietnam','romcal-3.0.0-dev.144-unreviewed',?,'day','Ga 2,13-22',?,?,'Independently reviewed scoped date','2026-11-09T11:00:00Z','Reviewed label')`, [date, url, date]);
    db.run("INSERT INTO reading_date_acceptances VALUES ('vietnam',?,'day',1)", [date]);
    const reading = readVerifiedReading(db, date, 'vietnam');
    assert.equal(reading.ref, 'Ga 2,13-22');
    assert.equal(reading.resolutionMethod, 'source_checked');
    assert.equal(reading.label, 'Reviewed label');
    assert.equal(diagnoseReading(db, date, 'vietnam'), 'reading is available');
    assert.equal(readVerifiedReading(db, '2027-11-09', 'vietnam').notFound, true);
    db.run("DELETE FROM verses WHERE book='Ga' AND chapter=2 AND verse=22");
    assert.match(diagnoseReading(db, date, 'vietnam'), /incomplete verse text/);
  } finally { db.close(); }
});
test('source diagnostics distinguish evidence conflicts from missing or invalid text', () => {
  const cases = [
    { setup: () => {}, expected: /no matching exact-date source verification/ },
    { setup: db => { verify(db); db.run('DELETE FROM verses'); }, expected: /incomplete verse text.*repair the shared verse store/ },
    { setup: db => {
      verify(db);
      db.run(`CREATE TABLE reading_observations(id INTEGER,date TEXT,calendar_id TEXT,mass_option TEXT,source_url TEXT,gospel_ref TEXT,observed_at TEXT)`);
      db.run("INSERT INTO reading_observations VALUES (1,?,'vatican-vi','day',?,'Lc 9,23-26','2026-11-09T12:00:00Z')", [date, url]);
    }, expected: /same dated Vatican page disagrees.*not verse text/ },
    { setup: db => { db.run("UPDATE daily_readings SET gospel_ref='Ga 99,1'"); verify(db, { ref: 'Ga 99,1' }); }, expected: /invalid or unreadable reference Ga 99,1/ },
  ];
  for (const { setup, expected } of cases) {
    const db = fixture();
    try { setup(db); assert.match(diagnoseReading(db, date, 'vatican-vi'), expected); }
    finally { db.close(); }
  }
});
test('calendar diagnostics distinguish unsupported rules, missing reviews and stale date choices', () => {
  const cases = [
    { setup: db => db.run('DELETE FROM reading_entries'), expected: /needs valid current reviewed Gospel evidence/ },
    { setup: db => db.run("UPDATE reading_calendars SET rules_version='new-version'"), expected: /no supported default daytime Mass definition/ },
    { setup: db => {
      for (const table of ['reading_calendars', 'reading_calendar_days', 'reading_entries', 'reading_entry_reviews']) {
        db.run(`UPDATE ${table} SET calendar_id='vietnam',rules_version='romcal-3.0.0-dev.144-unreviewed'`);
      }
    }, calendar: 'vietnam', expected: /unsupported calendar rules.*not another crawl or entry approval/ },
    { setup: db => {
      for (const table of ['reading_calendars', 'reading_calendar_days']) {
        db.run(`UPDATE ${table} SET calendar_id='vietnam',rules_version='romcal-3.0.0-dev.144-unreviewed'`);
      }
      db.run('DELETE FROM reading_entries');
    }, calendar: 'vietnam', expected: /unsupported calendar rules/ },
    { setup: db => db.run("INSERT INTO reading_date_acceptances VALUES ('roman-general',?,'day',999)", [date]), expected: /date-specific selection needs valid current evidence.*never fall back/ },
    { setup: db => db.run('DELETE FROM verses'), expected: /incomplete verse text.*not the reference cache/ },
  ];
  for (const { setup, expected, calendar = 'roman-general' } of cases) {
    const db = fixture();
    try { addCache(db); setup(db); assert.match(diagnoseReading(db, date, calendar), expected); }
    finally { db.close(); }
  }
});
test('diagnostics use the same inputs without changing public missing output', () => {
  const db = fixture();
  try {
    assert.match(diagnoseReading(db, '2026-02-30'), /invalid calendar date/);
    assert.match(diagnoseReading(db, date, 'roman-general', 'vigil'), /unsupported Mass option vigil/);
    assert.match(diagnoseReading(db, date, 'roman-general'), /not installed/);
    assert.deepEqual(readVerifiedReading(db, date, 'roman-general'), { date, notFound: true });
    addCache(db);
    assert.equal(diagnoseReading(db, date, 'roman-general'), 'reading is available');
    assert.equal(readCache(db).ref, 'Ga 2,13-22');
  } finally { db.close(); }
});
test('monitoring uses one file snapshot for its full window and diagnostics', () => {
  const db = fixture();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gospel-checker-snapshot-'));
  try {
    verify(db);
    db.run("INSERT INTO daily_readings VALUES ('2026-11-10','estimate','Ga 2,13'),('2026-11-11','estimate','Ga 2,13')");
    db.run("INSERT INTO daily_reading_sources VALUES ('2026-11-10','Ga 2,13','https://www.vaticannews.va/vi/loi-chua-hang-ngay/2026/11/10.html','2026-11-10','2026-11-09T00:00:00Z',NULL)");
    addCache(db);
    const database = path.join(dir, 'fixture.db');
    const counts = path.join(dir, 'reads.json');
    const preload = path.join(dir, 'fixture-clock.mjs');
    fs.writeFileSync(database, db.export());
    // The clock and file-read counter affect this disposable child only.
    fs.writeFileSync(preload, `import fs from 'node:fs';
      const OriginalDate=Date;
      globalThis.Date=class extends OriginalDate {
        constructor(...args){super(...(args.length?args:['2026-11-09T00:00:00Z']));}
        static now(){return new OriginalDate('2026-11-09T00:00:00Z').getTime();}
      };
      let reads=0;const original=fs.readFileSync;
      fs.readFileSync=function(file,...args){if(file===process.env.DB_PATH)reads++;return original.call(this,file,...args);};
      process.on('exit',()=>fs.writeFileSync(${JSON.stringify(counts)},JSON.stringify({reads})));
    `);
    for (const { overrides, status, expected } of [
      { overrides: {}, status: 1, expected: /2026-11-11: no matching exact-date source verification/ },
      { overrides: { LOOKAHEAD_DAYS: '1' }, status: 0, expected: /PASS — all 2 day\(s\) render.*not an archive reading-coverage guarantee/ },
      { overrides: { LOOKAHEAD_DAYS: '1', CLIFF_WARN_DAYS: '45' }, status: 1, expected: /extend upstream source-policy dates and reviewed evidence/ },
      { overrides: { READING_CALENDAR: 'roman-general', LOOKAHEAD_DAYS: '0', CLIFF_WARN_DAYS: '1000' }, status: 1, expected: /supported calendar definitions upstream; legacy importYear estimates are not sufficient/ },
    ]) {
      const result = spawnSync(process.execPath, ['--import', preload, '--conditions=react-server', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', 'scripts/check-readings.mjs'], {
        env: { ...process.env, DB_PATH: database, READING_CALENDAR: 'vatican-vi', READING_MASS_OPTION: 'day', LOOKAHEAD_DAYS: '2', CLIFF_WARN_DAYS: '0', ...overrides },
        encoding: 'utf8', timeout: 15000,
      });
      assert.equal(result.status, status, result.stderr);
      assert.match(result.stdout, expected);
      assert.equal(JSON.parse(fs.readFileSync(counts, 'utf8')).reads, 1);
    }
  } finally { db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
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
