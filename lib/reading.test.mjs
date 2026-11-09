import assert from 'node:assert/strict';
import test from 'node:test';
import initSqlJs from 'sql.js';
import { readVerifiedReading } from './reading.js';

const SQL = await initSqlJs();
const date = '2026-11-09';
const url = 'https://www.vaticannews.va/vi/loi-chua-hang-ngay/2026/11/09.html';

function fixture(withSources = true) {
  const db = new SQL.Database();
  db.run(`CREATE TABLE daily_readings(date TEXT PRIMARY KEY,lectionary_key TEXT,gospel_ref TEXT);
    CREATE TABLE verses(book TEXT,chapter INTEGER,verse INTEGER,verse_suffix TEXT,text TEXT);
    INSERT INTO daily_readings VALUES ('2026-11-09','ordinary_32_mon_II','Ga 2,13');
    INSERT INTO verses VALUES ('Ga',2,13,'','Gospel of the feast');`);
  if (withSources) db.run(`CREATE TABLE daily_reading_sources(date TEXT PRIMARY KEY,gospel_ref TEXT,source_url TEXT,source_date TEXT,verified_at TEXT,celebration TEXT)`);
  return db;
}

function verify(db, options = {}) {
  db.run('INSERT INTO daily_reading_sources VALUES (?,?,?,?,?,?)', [
    date, options.ref ?? 'Ga 2,13', options.url ?? url, options.date ?? date,
    options.at ?? '2026-11-09T00:00:00Z', options.label ?? null,
  ]);
}

test('legacy snapshot or unverified reading cannot be displayed as a Mass reading', () => {
  for (const withSources of [false, true]) {
    const db = fixture(withSources);
    try { assert.deepEqual(readVerifiedReading(db,date),{date,notFound:true}); }
    finally { db.close(); }
  }
});

test('exact-date proof is required, not another date with the same key', () => {
  for (const options of [{ref:'Lc 17,1-6'}, {date:'2026-11-08'}, {url:url.replace('09.html','08.html')}, {at:''}]) {
    const db = fixture();
    try {
      verify(db,options);
      assert.deepEqual(readVerifiedReading(db,date),{date,notFound:true});
    } finally { db.close(); }
  }
});

test('verified feast does not inherit the ordinary weekday label', () => {
  const db = fixture();
  try {
    verify(db);
    const reading = readVerifiedReading(db,date);
    assert.equal(reading.verified,true);
    assert.equal(reading.ref,'Ga 2,13');
    assert.equal(reading.verses,'Gospel of the feast');
    assert.equal(reading.label,null);
    assert.equal(reading.sourceUrl,url);
  } finally { db.close(); }
});

test('reviewed celebration label is displayed rather than a predicted key label', () => {
  const db = fixture();
  try {
    verify(db,{label:'Cung hiến Thánh đường La-tê-ra-nô'});
    assert.equal(readVerifiedReading(db,date).label,'Cung hiến Thánh đường La-tê-ra-nô');
  } finally { db.close(); }
});

test('verified reference without verse text is unavailable', () => {
  const db = fixture();
  try {
    verify(db);
    db.run('DELETE FROM verses');
    assert.deepEqual(readVerifiedReading(db,date),{date,notFound:true});
  } finally { db.close(); }
});
