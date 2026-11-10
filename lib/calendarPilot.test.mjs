import assert from 'node:assert/strict';
import test from 'node:test';
import initSqlJs from 'sql.js';
import { readVerifiedReading, diagnoseReading } from './reading.js';

const SQL = await initSqlJs();
const date = '2026-02-20';
const version = 'vietnam-national-pilot-fixture-v1';
const key = 'formulary:ash_wednesday:YEAR_A:YEAR_2:day';
const directive = 'https://hdgmvietnam.com/chi-tiet/uy-ban-phung-tu-thong-bao-ve-viec-cu-hanh-le-tro-nam-2026';
const gospel = 'https://hdgmvietnam.com/chi-tiet/cha-hien-dien-noi-kin-an-14-2-2018-thu-tu-le-tro--31941';
function fixture() {
  const db = new SQL.Database();
  db.run(`CREATE TABLE verses(book TEXT,chapter INTEGER,verse INTEGER,verse_suffix TEXT,text TEXT);
    CREATE TABLE reading_calendars(calendar_id TEXT,rules_version TEXT,source_url TEXT);
    CREATE TABLE reading_calendar_days(calendar_id TEXT,date TEXT,mass_option TEXT,rules_version TEXT,entry_key TEXT,celebration TEXT,observance TEXT);
    CREATE TABLE reading_calendar_day_details(calendar_id TEXT,date TEXT,mass_option TEXT,rules_version TEXT,entry_key TEXT,definition_json TEXT);
    CREATE TABLE reading_entries(calendar_id TEXT,rules_version TEXT,entry_key TEXT,mass_option TEXT,review_id INTEGER);
    CREATE TABLE reading_entry_reviews(id INTEGER,calendar_id TEXT,rules_version TEXT,entry_key TEXT,mass_option TEXT,gospel_ref TEXT,evidence_url TEXT,evidence_date TEXT,review_note TEXT,reviewed_at TEXT);
    CREATE TABLE reading_date_acceptances(calendar_id TEXT,date TEXT,mass_option TEXT,review_id INTEGER);
    CREATE TABLE reading_date_reviews(id INTEGER,calendar_id TEXT,rules_version TEXT,date TEXT,mass_option TEXT,gospel_ref TEXT,evidence_url TEXT,evidence_date TEXT,review_note TEXT,celebration TEXT,reviewed_at TEXT);`);
  db.run("INSERT INTO reading_calendars VALUES ('vietnam',?,'https://hdgmvietnam.com/')", [version]);
  db.run("INSERT INTO reading_calendar_days VALUES ('vietnam',?,'day',?,?,'Lễ Tro','ash_wednesday')", [date, version, key]);
  db.run("INSERT INTO reading_entries VALUES ('vietnam',?,?,'day',1)", [version, key]);
  db.run("INSERT INTO reading_entry_reviews VALUES (1,'vietnam',?,?,'day','Mt 6,1-6.16-18',?,?,'Reviewed named Ash Mass Gospel','2026-11-10T00:00:00Z')", [version, key, gospel, date]);
  const definition = { date, observance: 'friday_after_ash_wednesday', temporal: 'friday_after_ash_wednesday', seasons: ['lent'],
    mass: { formulary: 'ash_wednesday', celebration: 'Lễ Tro' }, source_url: directive, review_note: 'National directive item 3; Lent starts February 18' };
  db.run("INSERT INTO reading_calendar_day_details VALUES ('vietnam',?,'day',?,?,?)", [date, version, key, JSON.stringify(definition)]);
  for (const verse of [1, 2, 3, 4, 5, 6, 16, 17, 18]) db.run("INSERT INTO verses VALUES ('Mt',6,?,'',?)", [verse, `Text ${verse}`]);
  return db;
}

test('national pilot retains distinct Mass, season, Gospel evidence and calendar directive', () => {
  const db = fixture();
  try {
    const r = readVerifiedReading(db, date, 'vietnam');
    assert.equal(r.ref, 'Mt 6,1-6.16-18');
    assert.equal(r.label, 'Lễ Tro');
    assert.equal(r.observance, 'ash_wednesday');
    assert.equal(r.calendarObservance, 'friday_after_ash_wednesday');
    assert.equal(r.massFormulary, 'ash_wednesday');
    assert.deepEqual(r.seasons, ['lent']);
    assert.equal(r.calendarSourceUrl, directive);
    assert.equal(r.sourceUrl, gospel); // Retain the real, historically reused URL.
    assert.equal(r.evidenceDate, date); // Reading's heading, not the old slug or publication date.
  } finally { db.close(); }
});

test('national pilot warm entry requires matching definition proof, not just a new version name', () => {
  for (const operation of [
    'DELETE FROM reading_calendar_day_details',
    "UPDATE reading_calendar_day_details SET rules_version='stale'",
    "UPDATE reading_calendar_day_details SET definition_json='broken'",
  ]) {
    const db = fixture();
    try {
      db.run(operation);
      assert.equal(readVerifiedReading(db, date, 'vietnam').notFound, true);
      assert.match(diagnoseReading(db, date, 'vietnam'), /calendar definition|calendar definition evidence/);
    } finally { db.close(); }
  }
});

test('independent exact-date evidence survives corrupt optional calendar metadata', () => {
  for (const payload of ['broken', JSON.stringify({ date, source_url: 'javascript:bad' })]) {
    const db = fixture();
    try {
      db.run("INSERT INTO reading_date_reviews VALUES (1,'vietnam',?,?,'day','Mt 6,1-6.16-18',?,?,'Independent exact-date review','Exact-date Ash Mass','2026-11-10T00:00:00Z')", [version, date, gospel, date]);
      db.run("INSERT INTO reading_date_acceptances VALUES ('vietnam',?,'day',1)", [date]);
      db.run('UPDATE reading_calendar_day_details SET definition_json=?', [payload]);
      const r = readVerifiedReading(db, date, 'vietnam');
      assert.equal(r.ref, 'Mt 6,1-6.16-18');
      assert.equal(r.resolutionMethod, 'source_checked');
      assert.equal(r.label, 'Exact-date Ash Mass');
      assert.equal(r.calendarSourceUrl, 'https://hdgmvietnam.com/');
    } finally { db.close(); }
  }
});

test('national pilot unsupported day gives its actual rule ambiguity instead of a Gospel crawl recommendation', () => {
  const db = fixture();
  try {
    const unknown = '2026-11-15';
    db.run("INSERT INTO reading_calendar_days VALUES ('vietnam',?,'day',?,'','','ordinary_time_33_sunday')", [unknown, version]);
    const definition = { date: unknown, observance: 'ordinary_time_33_sunday', unsupported_reason: 'Vietnamese Martyrs external solemnity national default unresolved' };
    db.run("INSERT INTO reading_calendar_day_details VALUES ('vietnam',?,'day',?,'',?)", [unknown, version, JSON.stringify(definition)]);
    assert.deepEqual(readVerifiedReading(db, unknown, 'vietnam'), { date: unknown, notFound: true });
    assert.match(diagnoseReading(db, unknown, 'vietnam'), /Martyrs external solemnity national default unresolved/);
  } finally { db.close(); }
});
