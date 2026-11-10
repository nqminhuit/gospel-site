import 'server-only';
import { queryAll } from './bibleDb.js';

// Mirrors daily-bible/internal/scripture: bounded parsing and constant-size SQL.
const REF_RE = /^([A-Za-zÀ-ỹ]{1,3})\s+(\d+),(.+)$/u;
const CROSS_RE = /^(\d+)([a-zA-Z]?)-(\d+),(\d+)([a-zA-Z]?)$/;
const SEG_RE = /^(\d+)([a-zA-Z]?)(?:-(\d+)([a-zA-Z]?))?$/;
const OPEN_END = Number.MAX_SAFE_INTEGER;
const CHAPTERS = {
  Mt: [25,23,17,25,48,34,29,34,38,42,30,50,58,36,39,28,27,35,30,34,46,46,39,51,46,75,66,20],
  Mc: [45,28,35,41,43,56,37,38,50,52,33,44,37,72,47,20],
  Lc: [80,52,38,44,39,49,50,56,62,42,54,59,35,35,32,31,37,43,48,47,38,71,56,53],
  Ga: [51,25,36,54,47,71,53,59,41,42,57,50,38,31,27,33,26,40,42,31,25],
};
const positive = value => {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) throw new Error('expected positive integer');
  return n;
};

export function parseRef(ref) {
  if (new TextEncoder().encode(ref).length > 1024) throw new Error('reference exceeds 1024 bytes');
  const m = REF_RE.exec(ref.trim());
  if (!m) throw new Error('invalid reference');
  const book = m[1];
  let chapter = positive(m[2]);
  const parts = m[3].split('.');
  if (parts.length > 32) throw new Error('too many segments');
  const segments = [];
  let rangeCount = 0;
  const add = (ch, range) => {
    if (++rangeCount > 32) throw new Error('too many expanded ranges');
    if (segments.at(-1)?.chapter !== ch) segments.push({ chapter: ch, ranges: [] });
    segments.at(-1).ranges.push(range);
  };
  for (const raw of parts) {
    const part = raw.trim();
    const cross = CROSS_RE.exec(part);
    if (cross) {
      const start = positive(cross[1]);
      const endChapter = positive(cross[3]);
      const end = positive(cross[4]);
      if (endChapter <= chapter || endChapter - chapter >= 32 - rangeCount) throw new Error('invalid cross-chapter range');
      for (let ch = chapter; ch < endChapter; ch++) {
        add(ch, { start: ch === chapter ? start : 1, startSuffix: ch === chapter ? cross[2] : '', end: OPEN_END, endSuffix: '' });
      }
      add(endChapter, { start: 1, startSuffix: '', end, endSuffix: cross[5] });
      chapter = endChapter;
      continue;
    }
    const match = SEG_RE.exec(part);
    if (!match) throw new Error('invalid verse segment');
    const start = positive(match[1]);
    const end = match[3] ? positive(match[3]) : start;
    const startSuffix = match[2] || '';
    const endSuffix = match[4] || '';
    if (end < start || (end === start && startSuffix && endSuffix && endSuffix < startSuffix)) throw new Error('reversed range');
    add(chapter, { start, end, startSuffix, endSuffix });
  }
  return { book, segments };
}

function buildChapterQuery(book, segment) {
  const conditions = [];
  const params = [book, segment.chapter];
  for (const r of segment.ranges) {
    if (!r.startSuffix && !r.endSuffix) {
      conditions.push("(verse BETWEEN ? AND ? AND verse_suffix = '')");
      params.push(r.start, r.end);
    } else if (r.start === r.end) {
      if (r.startSuffix && r.endSuffix) {
        conditions.push('(verse = ? AND verse_suffix >= ? AND verse_suffix <= ?)');
        params.push(r.start, r.startSuffix, r.endSuffix);
      } else if (r.startSuffix) {
        conditions.push('(verse = ? AND verse_suffix >= ?)'); params.push(r.start, r.startSuffix);
      } else {
        conditions.push('(verse = ? AND verse_suffix <= ?)'); params.push(r.start, r.endSuffix);
      }
    } else {
      const startOp = r.startSuffix ? '>=' : '=';
      const endOp = r.endSuffix ? '<=' : '=';
      conditions.push(`((verse = ? AND verse_suffix ${startOp} ?) OR (verse > ? AND verse < ? AND verse_suffix = '') OR (verse = ? AND verse_suffix ${endOp} ?))`);
      params.push(r.start, r.startSuffix, r.start, r.end, r.end, r.endSuffix);
    }
  }
  return {
    sql: `SELECT book,chapter,verse,verse_suffix,text FROM verses WHERE book=? AND chapter=? AND (${conditions.join(' OR ')}) ORDER BY verse,verse_suffix`, params,
  };
}

export function getVersesForRef(db, ref) {
  const { book, segments } = parseRef(ref);
  return segments.flatMap(segment => {
    const { sql, params } = buildChapterQuery(book, segment);
    return queryAll(db, sql, params);
  });
}

// Mirrors scripture.NormalizeGospelRef, including canonical Gospel bounds.
// Syntax parsing alone cannot distinguish an absent verse from an impossible one.
export function normalizeGospelRef(ref) {
  const normalized = ref.replaceAll('–', '-').replaceAll('—', '-').trim().replace(/\s+/g, ' ');
  const parsed = parseRef(normalized);
  const chapters = CHAPTERS[parsed.book];
  if (!chapters || (normalized.match(/[0-9]+/g) || []).some(n => Number(n) > 80)) throw new Error('invalid Gospel reference');
  for (const segment of parsed.segments) {
    const last = chapters[segment.chapter - 1];
    if (!last || segment.ranges.some(span => span.start > last || (span.end !== OPEN_END && span.end > last))) throw new Error('reference exceeds Gospel chapter bounds');
  }
  return normalized;
}

export function equivalentRefs(a, b) {
  try {
    const canonical = ref => {
      const p = parseRef(normalizeGospelRef(ref));
      return JSON.stringify([p.book, p.segments.map(s => [s.chapter, s.ranges.map(r => [r.start, r.startSuffix, r.end, r.endSuffix])])]);
    };
    return canonical(a) === canonical(b);
  } catch { return false; }
}

export function hasCompleteText(rows, ref) {
  const parsed = parseRef(ref);
  const chapters = CHAPTERS[parsed.book];
  if (!chapters || !rows.length || rows.some(row => !row.text?.trim())) return false;
  if ((ref.match(/[0-9]+/g) || []).some(n => Number(n) > 80)) return false;
  return parsed.segments.every(segment => {
    const last = chapters[segment.chapter - 1];
    if (!last) return false;
    return segment.ranges.every(span => {
      const end = span.end === OPEN_END ? last : span.end;
      if (end > last || span.start > last) return false;
      const selected = rows.filter(row => row.book === parsed.book && row.chapter === segment.chapter && row.verse >= span.start && row.verse <= end);
      const seen = new Set(selected.map(row => row.verse));
      const suffix = (verse, value) => selected.some(row => row.verse === verse && (!row.verse_suffix || row.verse_suffix === value));
      if (span.start === end && span.startSuffix && span.endSuffix && !selected.some(row => !row.verse_suffix)) {
        for (let code = span.startSuffix.charCodeAt(0); code <= span.endSuffix.charCodeAt(0); code++) {
          if (!suffix(span.start, String.fromCharCode(code))) return false;
        }
      }
      return seen.size === end - span.start + 1 && seen.has(span.start)
        && (!span.startSuffix || suffix(span.start, span.startSuffix))
        && (!span.endSuffix || suffix(end, span.endSuffix));
    });
  });
}
