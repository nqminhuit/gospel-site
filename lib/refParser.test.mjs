import assert from 'node:assert/strict';
import test from 'node:test';
import initSqlJs from 'sql.js';
import { parseRef, getVersesForRef, hasCompleteText } from './refParser.js';

const SQL = await initSqlJs();
test('strict parsing rejects malformed, reversed, and excessive expansions', () => {
  for (const ref of ['Ga 2,13junk', 'Ga 2,13..14', 'Ga 2,22-13', 'Ga 0,1', 'Ga 1,1-99,1', 'Ga 2,' + '1.'.repeat(32) + '1']) {
    assert.throws(() => parseRef(ref), ref);
  }
  assert.equal(parseRef('Mt 5,20-22a.27-28').segments[0].ranges.length, 2);
});
test('cross-chapter reads include intermediate chapters and detect missing tails', () => {
  const db = new SQL.Database();
  try {
    db.run('CREATE TABLE verses(book TEXT,chapter INTEGER,verse INTEGER,verse_suffix TEXT,text TEXT)');
    for (const [chapter, start, end] of [[1, 50, 51], [2, 1, 25], [3, 1, 2]]) {
      for (let verse = start; verse <= end; verse++) db.run("INSERT INTO verses VALUES ('Ga',?,?,'','text')", [chapter, verse]);
    }
    const ref = 'Ga 1,50-3,2';
    const rows = getVersesForRef(db, ref);
    assert.equal(rows.length, 29);
    assert.equal(hasCompleteText(rows, ref), true);
    db.run('DELETE FROM verses WHERE chapter=2 AND verse=25');
    assert.equal(hasCompleteText(getVersesForRef(db, ref), ref), false);
  } finally { db.close(); }
});
test('suffix queries require the requested endpoints', () => {
  const db = new SQL.Database();
  try {
    db.run("CREATE TABLE verses(book TEXT,chapter INTEGER,verse INTEGER,verse_suffix TEXT,text TEXT); INSERT INTO verses VALUES ('Ga',2,13,'a','text')");
    assert.equal(hasCompleteText(getVersesForRef(db, 'Ga 2,13a-13b'), 'Ga 2,13a-13b'), false);
    db.run("INSERT INTO verses VALUES ('Ga',2,13,'b','text')");
    assert.equal(hasCompleteText(getVersesForRef(db, 'Ga 2,13a-13b'), 'Ga 2,13a-13b'), true);
    db.run("DELETE FROM verses WHERE verse_suffix='b'; INSERT INTO verses VALUES ('Ga',2,13,'c','text')");
    assert.equal(hasCompleteText(getVersesForRef(db, 'Ga 2,13a-13c'), 'Ga 2,13a-13c'), false);
  } finally { db.close(); }
});
