import 'server-only';

// Ported from daily-bible's internal/api/ref.go (ParseRefMultiChapter +
// queryChapterSegment). Keep in sync with that file; verify against
// internal/api/ref_test.go's cases when changing this.

// Matches "21-19,1": startVerse-endChapter,endVerse (crossing into the next chapter)
const CROSS_CHAPTER_RE = /^(\d+)([a-zA-Z]?)-(\d+),(\d+)([a-zA-Z]?)$/;
const REF_RE = /^([A-Za-zÀ-ỹ]{1,3})\s+(\d+),(.+)$/u;
const SEG_RE = /(\d+)([a-zA-Z]?)(?:-(\d+)([a-zA-Z]?))?/g;

/**
 * @param {string} ref e.g. "Mt 22,34-40", "Mt 5,20-22a.27-28", "Mt 18,21-19,1"
 * @returns {{ book: string, segments: { chapter: number, ranges: object[] }[] }}
 */
export function parseRef(ref) {
  const trimmed = ref.trim();
  const m = REF_RE.exec(trimmed);
  if (!m) throw new Error(`invalid ref: ${ref}`);

  const book = m[1];
  const chapter = Number(m[2]);
  const versePart = m[3];

  const segments = [];
  const findOrCreate = (ch) => {
    let seg = segments.find((s) => s.chapter === ch);
    if (!seg) {
      seg = { chapter: ch, ranges: [] };
      segments.push(seg);
    }
    return seg;
  };

  let currentChapter = chapter;
  for (const rawPart of versePart.split('.')) {
    const part = rawPart.trim();
    const cm = CROSS_CHAPTER_RE.exec(part);
    if (cm) {
      const [, startVerse, startSuffix, endChapterStr, endVerse, endSuffix] = cm;
      findOrCreate(currentChapter).ranges.push({
        start: Number(startVerse),
        startSuffix,
        end: 999,
        endSuffix: '',
      });
      currentChapter = Number(endChapterStr);
      findOrCreate(currentChapter).ranges.push({
        start: 1,
        startSuffix: '',
        end: Number(endVerse),
        endSuffix,
      });
    } else {
      for (const sm of part.matchAll(SEG_RE)) {
        const start = Number(sm[1]);
        const startSuffix = sm[2] || '';
        const end = sm[3] ? Number(sm[3]) : start;
        const endSuffix = sm[4] || '';
        findOrCreate(currentChapter).ranges.push({ start, startSuffix, end, endSuffix });
      }
    }
  }

  if (segments.length === 0) throw new Error(`no verse ranges in ref: ${ref}`);
  return { book, segments };
}

function buildChapterQuery(book, seg) {
  const conditions = [];
  const params = [book, seg.chapter];

  for (const r of seg.ranges) {
    if (!r.startSuffix && !r.endSuffix) {
      conditions.push("(verse BETWEEN ? AND ? AND (verse_suffix = '' OR verse_suffix IS NULL))");
      params.push(r.start, r.end);
    } else if (r.start === r.end) {
      if (r.startSuffix && r.endSuffix) {
        conditions.push('(verse = ? AND verse_suffix >= ? AND verse_suffix <= ?)');
        params.push(r.start, r.startSuffix, r.endSuffix);
      } else if (r.startSuffix) {
        conditions.push('(verse = ? AND verse_suffix >= ?)');
        params.push(r.start, r.startSuffix);
      } else {
        conditions.push('(verse = ? AND verse_suffix <= ?)');
        params.push(r.start, r.endSuffix);
      }
    } else {
      const inner = [];
      for (let v = r.start; v <= r.end; v++) {
        if (v === r.start && r.startSuffix) {
          inner.push('(verse = ? AND verse_suffix >= ?)');
          params.push(v, r.startSuffix);
        } else if (v === r.end && r.endSuffix) {
          inner.push('(verse = ? AND verse_suffix <= ?)');
          params.push(v, r.endSuffix);
        } else {
          inner.push("(verse = ? AND (verse_suffix = '' OR verse_suffix IS NULL))");
          params.push(v);
        }
      }
      conditions.push(`(${inner.join(' OR ')})`);
    }
  }

  const sql = `SELECT book, chapter, verse, verse_suffix, text FROM verses
               WHERE book = ? AND chapter = ? AND (${conditions.join(' OR ')})
               ORDER BY verse, verse_suffix`;
  return { sql, params };
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} ref
 * @returns {{book:string, chapter:number, verse:number, verse_suffix:string, text:string}[]}
 */
export function getVersesForRef(db, ref) {
  const { book, segments } = parseRef(ref);
  const rows = [];
  for (const seg of segments) {
    const { sql, params } = buildChapterQuery(book, seg);
    rows.push(...db.prepare(sql).all(...params));
  }
  return rows;
}
