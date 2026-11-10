# Lời Chúa hằng ngày (Daily Gospel)

A small Next.js 15 / React 19 site that displays the daily Gospel reading (Tin Mừng), with a calendar to browse readings for other dates.

## Purpose

- Show an evidence-backed Gospel selection using either accepted exact-date evidence or a supported calendar plus a reviewed reusable entry; never infer it from an estimated seasonal key
- Let visitors pick another date on the calendar to read that day's Gospel

## Installation and Running

### Requirements
- Node.js 24+
- npm or yarn

### Installation Steps
1. Clone the repository

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm start
   ```

Open [http://localhost:3000](http://localhost:3000) in the browser to view the site.

## Project Structure

- **app/**: Next.js pages (app router)
  - `page.js`: Home page (Gospel of the day + calendar), server-rendered
  - `layout.js`: Common layout
- **components/**: Reusable components (`CalendarWrapper.jsx`, `CalendarSection.js`, `ErrorBoundary.js`)
- **lib/**: Server-only data access — reads and queries the committed SQLite database directly
- **public/**: Static assets (icons)
- **resources/bible.db**: the app's sole data source, committed to this repo (see "Data source" below)
- **scripts/vendor-bible-db.js**: refreshes `resources/bible.db` from a sibling checkout of `daily-bible`
- **scripts/check-readings.mjs**: daily health check for the committed database (see "Monitoring" below)
- **.github/scripts/sync-bible-db.sh**: CI-only re-sync of `resources/bible.db` from `daily-bible`
- **.github/scripts/commit-db.sh**: CI-only commit of a refreshed `resources/bible.db` to `master`

## Data source

The page queries the committed `resources/bible.db` directly with `sql.js`; it
never fetches a Gospel or calls the Go API at runtime. `lib/bibleDb.js` opens the
snapshot read-only; `DB_PATH` can select a temporary snapshot for tests.
`lib/refParser.js` matches `daily-bible/internal/scripture` parsing/query semantics
and rejects missing/partial verse text.

`lib/reading.js` implements the shared evidence contract:

- Default `READING_CALENDAR=vatican-vi`: matching accepted exact-date provenance,
  canonical dated source URL, reference and timestamp. A later conflicting
  observation of that same source is unavailable pending review.
- Explicit supported calendar: current versioned definition plus a reviewed
  reusable entry; a scoped date-specific acceptance takes precedence. Weekday
  Gospel keys can repeat across I/II first-reading cycles; Sunday A/B/C and
  proper/memorial identities remain separate. Keys are opaque to the frontend.
  An existing stale date decision blocks silent fallback to an ordinary entry.
- The unreviewed Vietnam Romcal provider misplaces the Vietnamese Martyrs.
  Derived `vietnam` entries with automatic `romcal-` rules versions are blocked,
  including warm caches. Reviewed national definitions need their own rules
  version; named diocesan/parish adapters are not implemented yet and must not be
  relabeled national. Independent valid exact-date choices remain separate evidence.
- Only `READING_MASS_OPTION=day` is currently supported. Other options, missing
  definitions/reviews, unsupported dates and incomplete text are unavailable.
- No fallback across calendar scopes, stale rules, or estimated `lectionary_key`
  values. A different-calendar observation cannot poison a reviewed local entry.
- Labels come from the resolved observance/reviewed date, never a seasonal guess.
  The UI distinguishes `source_checked` from `calendar_resolved` and links the
  **actual evidence**, potentially from another year, not an invented future page.

Roman General remains an evaluation profile; automatic Vietnam-provider export
and reuse are disabled upstream pending reviewed national/local rules. Neither
namespace confirms this site's national, diocesan or parish calendar. Vietnamese source language proves no jurisdiction.
Confirm calendar scope, default options and local exceptions before activating a
profile or repairing the full archive. See the upstream
[policy and operator contract](https://github.com/nqminhuit/daily-bible/blob/master/data/calendar-policy.md).
The November 15, 2026 calendar discrepancy is not automatically resolved.

A supported warm cache renders historical/future dates without dated-page records
or HTTP. Legacy references remain audit data, not automatically approved readings.
`npm test` covers both resolution methods, scope/version isolation, genuine
citations, date-only exceptions, strict parsing and complete verse ranges.

To refresh data, use `npm run vendor-bible-db` with a sibling `daily-bible` checkout,
then review and commit the snapshot. Coordinate schema compatibility and rollback
snapshots with upstream; publishing the Go implementation alone does not update
this frontend. Never publish an almost-empty archive merely to satisfy a new
provenance check. Production and CI must set the same `READING_CALENDAR`.

## Monitoring

The snapshot is not a rolling runtime download. Stored date count/non-null refs
are not availability guarantees: inspect supported calendar definitions, reviews,
conflicts and verse completeness. Archive recovery should reuse approved entries,
not require one crawl per historical date or grandfather all old predictions.

`.github/workflows/check-readings.yml` runs daily at 00:10 Asia/Ho_Chi_Minh. It
checks a **window of upcoming days**, not just today, since by the time today is
broken the site is already degraded. Then:

1. All dates have supported scoped evidence and complete text → done; no crawl is needed.
2. Something missing → re-sync `resources/bible.db` from `daily-bible`'s master
   branch, check again, and commit the fresher database directly to `master`,
   which triggers a Vercel redeploy. This may import only upstream's reviewed,
   compatible data; it does not itself approve predictions or calendar changes.
3. Still missing after syncing → **fail the workflow** (email notification).
   Upstream needs the missing calendar/entry/date review or a verse-store repair.
   The healer crawls only genuine reference gaps; a crawl alone cannot approve a
   local-calendar selection.

So being merely out of date heals itself with no human in the loop, and you're
only notified when a person is actually needed. The site never fetches anything
at runtime — the sync runs in CI, and only after a check has already failed.

Run `npm run check-readings`. Set repository variable `READING_CALENDAR` to match
production (default `vatican-vi`). For a temporary reviewed-cache snapshot:

```sh
DB_PATH=/tmp/reading-audit.db READING_CALENDAR=roman-general npm run check-readings
```

Additional environment settings:
- `LOOKAHEAD_DAYS` (default `2`) — how far ahead readings are required
- `CLIFF_WARN_DAYS` (default `45`) — how early to complain that the database is running out of dates

It reuses `lib/reading.js`, the same code path the page renders with, so a pass
means the page has supported evidence and complete text. It diagnoses missing
reviews/definitions rather than demanding per-date crawls. Liturgical correctness
still depends on the explicitly approved upstream calendar, scope and mappings.
Scheduled source audits are separate from these availability checks.

## Deployment
Automatic deployment when pushing changes to the main branch. This is a
server-rendered (SSR) app — production requires `next start` (or Vercel's
standard Next.js SSR deploy), not a static file server.

### Manual Deployment Steps
1. Build production:
 ```bash
 npm run build
 ```

2. Start server:
 ```bash
 npm start
 ```

## Contributing

All contributions are welcome! Please create an issue or pull request.
